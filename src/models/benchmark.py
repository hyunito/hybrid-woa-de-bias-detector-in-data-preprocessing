import sys
import os
import time
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from src.models.woa import MetadataWOAAuditor
runs = 30
results = []
for run in range(runs):
    start_time = time.perf_counter()
    auditor = MetadataWOAAuditor()
    result = auditor.run_audit()
    end_time = time.perf_counter()

    execution_time = end_time - start_time

    results.append({
        "run": run + 1,
        "fitness_score": result["max_fitness_score"],
        "script": result["script_name"],
        "transformation": result["transformation_name"],
        "demographic" : result["demographic_group"],
        "execution_time": execution_time
    })
    print(f"Run {run+1:02d} | Score: {result['max_fitness_score']:.4f} | Time: {execution_time:.4f}s")
    

