import psutil
import os
import re

def get_peak_memory():
    """
    Returns the peak working set memory usage of the process on Windows in bytes.
    """
    process = psutil.Process(os.getpid())
    mem_info = process.memory_info()
    if hasattr(mem_info, 'peak_wset'):
        return mem_info.peak_wset
    return mem_info.rss

def log_audit_run(result, latency, peak_memory):
    """
    Appends the run metrics to data/woa_performance_logs.txt in a chronological manner.
    """
    log_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data")
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, "woa_performance_logs.txt")
    
    # Determine the next run number by scanning the log file
    run_num = 1
    if os.path.exists(log_path):
        try:
            with open(log_path, "r", encoding="utf-8") as f:
                content = f.read()
                runs = re.findall(r"Run (\d+) Status:", content)
                if runs:
                    run_num = max(int(r) for r in runs) + 1
        except Exception:
            pass
            
    peak_mem_mb = peak_memory / (1024 * 1024)
    
    log_entry = (
        f"Run {run_num} Status:\n"
        f"Algorithms Latency: {latency:.6f} seconds\n"
        f"Peak Memory Usage: {peak_mem_mb:.2f} MB\n"
        f"Bias: {result}\n\n"
    )
    
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(log_entry)
        
    print(f"Metrics successfully logged to: {os.path.abspath(log_path)}")
