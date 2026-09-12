from woa import WOAAuditor
from woa import all_biases

def get_score(item):
    return item["fitness_score"]

if __name__ == "__main__":
    
    auditor = WOAAuditor()
    result = auditor.run_audit()

    unique_records = {}

    for entry in all_biases:
        key = (entry["script_name"], entry["transformation_name"], entry["demographic_group"])
        unique_records[key] = entry

    ranked_biases = list(unique_records.values())
    ranked_biases.sort(key=get_score, reverse=True)

    all_biases.sort(key=get_score, reverse=True)
    print("\n--- RANKED AUDIT REPORT (HIGHEST TO LOWEST BIAS) ---")
    for i, bias in enumerate(ranked_biases, 1):
        print(f"Rank {i}: Score {bias['fitness_score']:.4f} | {bias['transformation_name']} ({bias['script_name']}) | Group: {bias['demographic_group']}")
