import sys
import os
import time
import tracemalloc
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from de import DEAuditor

runs = 30
traceability = 0

results = []
for run in range(runs):
    tracemalloc.start()
    tracemalloc.reset_peak()
    
    start_time = time.perf_counter()

    de_auditor = DEAuditor()
    result = de_auditor.run_de()

    end_time = time.perf_counter()

    current_mem, peak_mem = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    execution_time = end_time - start_time
    peak_ram_mb = peak_mem / (1024 * 1024)   
    
    results.append({
        "Run": run + 1,
        "fitness_score": result["max_fitness_score"],
        "script": result["script_name"],
        "transformation": result["transformation_name"],
        "demographic": result["demographic_group"],
        "execution_time": execution_time,
        "peak_ram_mb": peak_ram_mb
    })
    if result['max_fitness_score'] == 1.6577509532428722:
            traceability = traceability + 1
    print(f"Transformation: {result['transformation_name']} | Score: {result['max_fitness_score']:.4f}\nTime: {execution_time:.4f}s | Peak RAM Usage: {peak_ram_mb:.6f}MB")

print(f"Traceability Rate: {traceability} / 30")