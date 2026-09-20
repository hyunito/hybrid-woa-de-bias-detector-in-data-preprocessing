from hybrid_woa import WOAAuditor
from feedback import generate_mitigation_report


def get_fitness_score(bias_item):
    """Helper function: extracts the fitness score to help sort the list."""
    return bias_item["fitness_score"]

def run_audit(threshold=0.2):
    
    auditor = WOAAuditor()
    auditor.run_woa()

    # Retrieve all biases accumulated across both WOA and DE stages
    all_biases = auditor.all_biases

    unique_records = {}
    for entry in all_biases:
        key = (entry["script_name"], entry["transformation_name"], entry["demographic_group"])
        # If already exists, keep the one with higher fitness score
        if key not in unique_records or entry["fitness_score"] > unique_records[key]["fitness_score"]:
            unique_records[key] = entry

    ranked_biases = list(unique_records.values())
    ranked_biases.sort(key=get_fitness_score, reverse=True)

    filtered_biases = []
    for rank_num, bias in enumerate(ranked_biases, 1):
        bias["rank"] = rank_num
        score = bias.get("fitness_score", 0.0)
        if score > threshold:
            filtered_biases.append(bias)

    print(f"TOTAL EVALUATED BIASES (WOA + DE): {len(all_biases)}")
    print(f"UNIQUE CANDIDATES IDENTIFIED: {len(ranked_biases)}")
    print("\n--- RANKED AUDIT REPORT (HIGHEST TO LOWEST BIAS) ---")
    print("--- TOP 10 ---")

    for bias in filtered_biases[:10]:
        score = bias["fitness_score"]
        trans = bias["transformation_name"]
        script = bias["script_name"]
        group = bias["demographic_group"]
        source = bias.get("source", "HYBRID")
        print(f"Rank {bias['rank']}: Score {score:.4f} | [{source}] {trans} ({script}) | Group: {group}")

    return filtered_biases

if __name__ == "__main__":
    print("Running Bias Audit...")    
    ranked_biases = run_audit()
    generate_mitigation_report(ranked_biases)
