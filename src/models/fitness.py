import psycopg2
import os
from dotenv import load_dotenv
import json

_logs_cache = None
_scripts = []
_transformations = {} 
_demographics = {}       
_fitness_cache = {} 

def load_provenance_data(rows):
    global _logs_cache, _scripts, _transformations, _demographics,  _fitness_cache
    if _logs_cache is not None:
        return
    
                
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
    rows = []
    load_dotenv()
    try:
        connection = psycopg2.connect(
            dbname = os.getenv('DB_NAME'),
            user = os.getenv('DB_USER'),
            password = os.getenv('DB_PASSWORD'),
            host = os.getenv('DB_HOST'),
            port = os.getenv('DB_PORT'),
                )
        cursor = connection.cursor()

    except psycopg2.OperationalError as e:
        print(f"Could not connect to database: {e}")
        print("Will fall back to JSON file instead")

    cursor.execute("""
        SELECT log_data
        FROM provenance_records
        ORDER BY id DESC
        LIMIT 1""")
    rows = cursor.fetchall()

    if rows:
        records = rows[0][0]
    else:
        records = []

    load_provenance_data(records)
    return _scripts, _transformations, _demographics

def calculate_3d_fitness(s_idx, t_idx, d_idx):
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

if __name__ == '__main__':
    scripts, transformations, demographics = get_space_dimensions()
    #print(f"\nScripts: {scripts}")
    #print(f"Transformations: {transformations}")
    #print(f"Demographics: {demographics}")