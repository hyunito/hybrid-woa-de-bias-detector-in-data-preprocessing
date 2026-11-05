import sys
import os
import time
import tracemalloc
import fitness

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from woa import WOAAuditor

fitness.get_space_dimensions()
target_score = max(fitness._fitness_cache.values())

runs = 1
traceability = 0

results = []
for run in range(runs):
    tracemalloc.start()
    tracemalloc.reset_peak()
    
    start_time = time.perf_counter()

    woa_auditor = WOAAuditor()
    result = woa_auditor.run_woa()

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
    if abs(result['max_fitness_score'] - target_score) < 1e-6:
        traceability = traceability + 1
    print(f"Transformation: {result['transformation_name']} | Score: {result['max_fitness_score']:.4f}\nTime: {execution_time:.4f}s | Peak RAM Usage: {peak_ram_mb:.6f}MB")

#print(f"\nTarget Ground Truth Score: {target_score:.6f}")
#print(f"Traceability Rate: {traceability} / {runs} ({(traceability / runs) * 100:.1f}%)")
