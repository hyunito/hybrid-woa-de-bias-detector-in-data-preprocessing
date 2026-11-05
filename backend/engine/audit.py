import os
import sys

_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from engine import fitness
from engine.hybrid_woa import WOAAuditor
from engine.feedback import generate_mitigation_report


def get_fitness_score(bias_item):
    """Helper function: extracts the compound fitness score to rank findings."""
    return bias_item["fitness_score"]


def run_audit(spd_threshold: float = 0.0):
    """
    Executes the standalone CLI/backend audit pipeline:
    1. Runs the Whale Optimization Algorithm (WOA) scouting stage.
    2. Transitions seeds to Differential Evolution (DE) local refinement.
    3. Evaluates discovered bias hotspots against:
       - Fixed Disparate Impact (DI) Four-Fifths 80% Rule (DI < 0.80).
       - User-configured Statistical Parity Difference (SPD) Threshold (SPD > spd_threshold).
    """
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

    DI_CUTOFF = 0.80  # Four-Fifths rule: selection ratio below 80% is considered disparate impact
    filtered_biases = []

    for bias in ranked_biases:
        demo_grp = bias.get("demographic_group")
        if not demo_grp or demo_grp == "None":
            continue

        # Fetch granular disparity metrics from the fitness cache
        details = fitness.get_fitness_detail(
            bias["script_name"],
            bias["transformation_name"],
            demo_grp
        )
        spd = round(float(details["spd"]), 4)
        di = round(float(details["di"]), 4)

        bias["spd"] = spd
        bias["di"] = di
        bias["di_penalty"] = round(abs(1.0 - di), 4)

        fails_di = (di < DI_CUTOFF)
        fails_spd = (spd > spd_threshold)

        if fails_di or fails_spd:
            bias["fails_di"] = fails_di
            bias["fails_spd"] = fails_spd
            filtered_biases.append(bias)

    for rank_num, bias in enumerate(filtered_biases, 1):
        bias["rank"] = rank_num

    for bias in filtered_biases[:1]:
        score = bias["fitness_score"]
        trans = bias["transformation_name"]
        script = bias["script_name"]
        group = bias["demographic_group"]
        print(f"Rank {bias['rank']}: Score {score:.4f} | {trans} ({script}) | Group: {group}")

    return filtered_biases


if __name__ == "__main__":
    ranked_biases = run_audit()
    generate_mitigation_report(ranked_biases)
