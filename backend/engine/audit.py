from woa import WOAAuditor, all_biases
from feedback import generate_mitigation_report, print_mitigation_report

REPORT_THRESHOLD = 0.2  

def get_fitness_score(bias_item):
    """Helper function: extracts the fitness score to help sort the list."""
    return bias_item["fitness_score"]

def run_audit():
    
    auditor = WOAAuditor()
    auditor.run_woa()

    unique_records = {}
    for entry in all_biases:
        key = (entry["script_name"], entry["transformation_name"], entry["demographic_group"])
        unique_records[key] = entry

    ranked_biases = list(unique_records.values())
    ranked_biases.sort(key=get_fitness_score, reverse=True)

    filtered_biases = []
    for rank_num, bias in enumerate(ranked_biases, 1):
        bias["rank"] = rank_num
        score = bias.get("fitness_score", 0.0)
        if score > REPORT_THRESHOLD:
            filtered_biases.append(bias)

    print("\n--- RANKED AUDIT REPORT (HIGHEST TO LOWEST BIAS) ---")
    for bias in filtered_biases:
        score = bias["fitness_score"]
        trans = bias["transformation_name"]
        script = bias["script_name"]
        group = bias["demographic_group"]
        print(f"Rank {bias['rank']}: Score {score:.4f} | {trans} ({script}) | Group: {group}")

    return filtered_biases

if __name__ == "__main__":
    print("Running Whale Optimization Algorithm (WOA) audit...")    
    ranked_biases = run_audit()
    generate_mitigation_report(ranked_biases)
    
