import os
import json
import psycopg2
from dotenv import load_dotenv

_logs_cache = None
_scripts = []
_transformations = {} 
_demographics = {}       
_fitness_cache = {} 


def load_provenance_data(rows, reload: bool = False):
    """
    Parses provenance log records, populates the discrete 3D search space dimensions
    (scripts, transformations, and intersectional demographic groups), and pre-computes
    compound disparity fitness scores into an in-memory cache.

    :param rows: List of JSONB provenance dictionaries from tracking pipeline.
    :param reload: When True, invalidates existing cache and re-computes dimensions.
    """
    global _logs_cache, _scripts, _transformations, _demographics, _fitness_cache
    if _logs_cache is not None and not reload:
        return
    
    _scripts = []
    _transformations = {}
    _demographics = {}
    _fitness_cache = {}
    
    for log_data in rows:
        script = log_data.get("script_name")
        trans = log_data.get("transformation_name")
        
        if not script or not trans:
            continue
            
        if script not in _scripts:
            _scripts.append(script)
            _transformations[script] = []
            
        if trans not in _transformations[script]:
            _transformations[script].append(trans)
            
        demos = log_data.get("intersectional_demographics", {})
        # Filter for statistically reliable demographic groups (sample count >= 30)
        valid_demos = [k for k, v in demos.items() if v.get("total_count", 0) >= 30]
        if not valid_demos and demos:
            valid_demos = list(demos.keys())
        _demographics[(script, trans)] = sorted(valid_demos)
        
        rate_priv = log_data.get("highest_selection_rate")
        if rate_priv is None or rate_priv <= 0:
            rate_priv = 1.0

        for demo_key in valid_demos:
            target_data = demos.get(demo_key, {})
            rate_target = target_data.get("selection_rate_favorable_outcomes")
            if rate_target is None:
                rate_target = target_data.get("selection_rate", 0.0)
                
            # Compound fairness objective: Statistical Parity Difference (SPD) + |1 - Disparate Impact (DI)|
            # Higher fitness indicates severe demographic disparity introduced by this transformation
            spd = abs(rate_target - rate_priv)
            di = rate_target / (rate_priv + 1e-5)
            _fitness_cache[(script, trans, demo_key)] = spd + abs(1 - di)
        
    _logs_cache = True


def _load_records_from_json(path: str):
    """Loads provenance records from local JSON fallback file if database is unavailable."""
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None


def get_space_dimensions(metadata_logs=None):
    """
    Returns the 3D search space dimensions: (scripts, transformations, demographics).
    Prioritizes passed metadata logs, then active memory cache, then PostgreSQL,
    and finally falls back to local provenance_metadata.json storage.

    :param metadata_logs: Optional list of provenance dictionaries to initialize with.
    :return: Tuple (_scripts, _transformations, _demographics)
    """
    if metadata_logs is not None:
        load_provenance_data(metadata_logs, reload=True)
        return _scripts, _transformations, _demographics

    if _logs_cache is not None and _scripts:
        return _scripts, _transformations, _demographics

    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    storage_path = os.path.join(backend_dir, "storage", "provenance_metadata.json")
    candidate_paths = [
        storage_path,
        os.path.join(backend_dir, "provenance_metadata.json"),
        os.path.abspath(os.path.join(backend_dir, "..", "provenance_metadata.json")),
        "provenance_metadata.json"
    ]
    path = next((p for p in candidate_paths if os.path.exists(p)), storage_path)
    env_file = os.path.join(backend_dir, ".env")
    if os.path.exists(env_file):
        load_dotenv(env_file)
    else:
        load_dotenv()

    records = None
    try:
        connection = psycopg2.connect(
            dbname=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            host=os.getenv('DB_HOST'),
            port=os.getenv('DB_PORT'),
        )
        cursor = connection.cursor()
        cursor.execute("""
            SELECT log_data
            FROM provenance_records
            ORDER BY id DESC
            LIMIT 1
        """)
        rows = cursor.fetchall()
        if rows:
            records = rows[0][0]
        else:
            records = _load_records_from_json(path)
        cursor.close()
        connection.close()

    except Exception:
        records = _load_records_from_json(path)

    if records:
        load_provenance_data(records)
        return _scripts, _transformations, _demographics

    return [], {}, {}


def calculate_3d_fitness(s_idx: float, t_idx: float, d_idx: float):
    """
    Maps 3D continuous/discrete coordinates to concrete pipeline entity names
    and retrieves the pre-computed compound bias fitness score.

    :param s_idx: Script index in search space.
    :param t_idx: Transformation step index for the selected script.
    :param d_idx: Demographic group index for the selected transformation.
    :return: Tuple (fitness_score, script_name, trans_name, demo_key)
    """
    if not _scripts:
        return 0.0, "None", "None", "None"
        
    script_name = _scripts[int(s_idx)]
    trans_list = _transformations.get(script_name, [])
    if not trans_list:
        return 0.0, script_name, "None", "None"
    trans_name = trans_list[int(t_idx)]

    demo_list = _demographics.get((script_name, trans_name), [])
    if not demo_list:
        return 0.0, script_name, trans_name, "None"
    demo_key = demo_list[int(d_idx)]
    
    fitness_score = _fitness_cache.get((script_name, trans_name, demo_key), 0.0)
    return fitness_score, script_name, trans_name, demo_key
