# import psycopg2
import os
from dotenv import load_dotenv
import json

# Cache for the loaded logs hierarchy
_logs_cache = None
_scripts = []
_transformations = {} 
_demographics = {}       
_fitness_cache = {} 

def load_provenance_data():
    global _logs_cache, _scripts, _transformations, _demographics,  _fitness_cache
    if _logs_cache is not None:
        return
    
    #load_dotenv()
    #db_name = os.getenv("DB_NAME")
    #db_user = os.getenv("DB_USER")
    #db_password = os.getenv("DB_PASSWORD")
    #db_host = os.getenv("DB_HOST", "localhost")
    #db_port = os.getenv("DB_PORT", "5432")
    
    rows = []
    # try:
    #     if 'db_name' in locals() or 'db_name' in globals():
    #         conn = psycopg2.connect(
    #             dbname=db_name,
    #             user=db_user,
    #             password=db_password,
    #             host=db_host,
    #             port=db_port
    #         )
    #         cursor = conn.cursor()
    #         cursor.execute("SELECT log_data FROM provenance_logs ORDER BY id ASC")
    #         for r in cursor.fetchall():
    #             val = r[0]
    #             if isinstance(val, str):
    #                 rows.append(json.loads(val))
    #             else:
    #                 rows.append(val)
    #         cursor.close()
    #         conn.close()
    # except Exception as e:
    #     print(f"Database connection failed, falling back to JSON: {e}")
        
    if not rows:
        possible_paths = [
            os.path.join(os.path.dirname(__file__), "..", "..", "data", "provenance_metadata.json"),
            os.path.join(os.path.dirname(__file__), "provenance_metadata.json"),
            "data/provenance_metadata.json",
            "provenance_metadata.json"
        ]
        for path in possible_paths:
            if os.path.exists(path):
                try:
                    with open(path, 'r') as f:
                        rows = json.load(f)
                    print(f"Successfully loaded fallback JSON from {path}")
                    break
                except Exception as json_err:
                    pass
                
    _scripts = []
    _transformations = {}
    _demographics = {}
    
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
        valid_demos = [k for k, v in demos.items() if v.get("total_count", 0) >= 30]
        _demographics[(script, trans)] = sorted(valid_demos)
        
        # pre-calculate
        rate_priv = log_data.get("highest_selection_rate")
        if rate_priv is None or rate_priv <= 0:
            rate_priv = 1.0
        for demo_key in valid_demos:
            target_data = demos.get(demo_key, {})
            rate_target = target_data.get("selection_rate_favorable_outcomes")
            if rate_target is None:
                rate_target = target_data.get("selection_rate", 0.0)
                
            spd = abs(rate_target - rate_priv)
            di = rate_target / (rate_priv + 1e-5)
            _fitness_cache[(script, trans, demo_key)] = spd + abs(1 - di)
        
    _logs_cache = True

def get_space_dimensions():
    load_provenance_data()
    return _scripts, _transformations, _demographics

def calculate_3d_fitness(s_idx, t_idx, d_idx):
    load_provenance_data()
    
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
    
    fitness_score = _fitness_cache.get((script_name, trans_name, demo_key), -999.0)
    
    return fitness_score, script_name, trans_name, demo_key