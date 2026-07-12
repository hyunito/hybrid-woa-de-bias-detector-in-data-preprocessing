import os
import datetime

def generate_text_report(result, latency, peak_mem, output_path="data/bias_audit_report.txt"):
    """
    Generates a structured plain text report of the bias audit, detailing overall execution metrics,
    highlighting the peak bias hotspot, and listing final positions and fitness scores of all search agents.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    max_bias = result.get("max_fitness_score", 0.0)
    script_name = result.get("script_name", "None")
    trans_name = result.get("transformation_name", "None")
    demo_group = result.get("demographic_group", "None")
    whales = result.get("whales", [])
    
    sorted_whales = sorted(whales, key=lambda w: w.get("fitness_score", -999.0), reverse=True)
    
    peak_mem_mb = peak_mem / (1024 * 1024)
    
    report_lines = [
        "============================================================",
        "BIAS AUDIT REPORT (WHALE OPTIMIZATION ALGORITHM)",
        f"Generated on: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "============================================================",
        "",
        "EXECUTIVE SUMMARY",
        "-----------------",
        "The metaheuristic audit successfully completed. The Whale Optimization",
        "Algorithm (WOA) scanned the multi-dimensional dataset preprocessing history",
        "to locate intersectional bias hotspots.",
        "",
        f"- Highest Bias Fitness Score: {max_bias:.6f}",
        f"- Target Pipeline Script:     {script_name}",
        f"- Data Transformation Step:   {trans_name}",
        f"- Most Vulnerable Group:      {demo_group}",
        "",
        "--------------------------",
        f"The search agent identified the demographic group:",
        f"  \"{demo_group}\"",
        f"during the \"{trans_name}\" step in \"{script_name}\"",
        f"as having the highest bias fitness score ({max_bias:.6f}).",
        "",
        "WHALE POPULATION FINAL STATE (Sorted by Bias Score)",
        "--------------------------------------------------",
        # Table Header
        f"{'Whale ID':<10} | {'Position [P, T, D]':<20} | {'Fitness Score':<15} | {'Script Name':<25} | {'Transformation':<25} | {'Demographic Group'}",
        "-" * 140
    ]
    
    # Add each whale row
    for w in sorted_whales:
        w_id = str(w.get("whale_id", "-"))
        pos = w.get("position", [])
        pos_str = f"[{pos[0]:.0f}, {pos[1]:.0f}, {pos[2]:.0f}]" if len(pos) >= 3 else "N/A"
        fit_str = f"{w.get('fitness_score', 0.0):.6f}"
        scr = w.get('script_name', 'None')
        tra = w.get('transformation_name', 'None')
        dem = w.get('demographic_group', 'None')
        
        row = f"{w_id:<10} | {pos_str:<20} | {fit_str:<15} | {scr:<25} | {tra:<25} | {dem}"
        report_lines.append(row)
        
    report_lines.append("")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines) + "\n")
        
    print(f"Detailed plain text audit report generated at: {os.path.abspath(output_path)}")
