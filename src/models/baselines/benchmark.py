import sys
import os
import time
import psutil
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from src.models.woa import WOAAuditor

runs = 1
process = psutil.Process(os.getpid())


results = []
for run in range(runs):
    mem_before = process.memory_info().rss
    start_time = time.perf_counter()
    auditor = WOAAuditor()
    result = auditor.run_audit()
    end_time = time.perf_counter()

    mem_after = process.memory_info().rss
    execution_time = end_time - start_time
    peak_ram_mb = (mem_after - mem_before)/(1024 * 1024)

    results.append({
        "Run": run + 1,
        "fitness_score": result["max_fitness_score"],
        "script": result["script_name"],
        "transformation": result["transformation_name"],
        "demographic" : result["demographic_group"],
        "execution_time": execution_time,
        "peak_ram_mb": peak_ram_mb,
        "traceability": result["traceability"]
        
    })
    print(f"Transformation: {result["transformation_name"]} | Score: {result['max_fitness_score']:.4f}\nTime: {execution_time:.4f}s | Peak RAM Usage: {peak_ram_mb:.6f}MB | Traceability Rate: {result["traceability"]}")
    

