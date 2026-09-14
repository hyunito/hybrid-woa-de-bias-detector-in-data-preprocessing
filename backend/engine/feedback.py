import os
import json

RULES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rules")

def load_json(filename, default_value):
    """Reads a JSON file from the rules folder. If missing, returns default_value."""
    filepath = os.path.join(RULES_DIR, filename)
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return default_value

KNOWLEDGE_BASE = load_json("knowledge_base.json", {})
CATEGORY_RULES = load_json("category_rules.json", [])
REPORT_THRESHOLD = 0.2  

def classify_category(transformation_name):
    name_lower = transformation_name.lower()
    for rule in CATEGORY_RULES:
        category = rule.get("category", "generic_fallback")
        keywords = rule.get("keywords", [])
        for kw in keywords:
            if kw in name_lower:
                return category
    return "generic_fallback"


def clean_group_info(raw_group):
    if isinstance(raw_group, dict):
        return raw_group
    
    group_str = str(raw_group)
    if "|" in group_str and ":" in group_str:
        result = {}
        for part in group_str.split("|"):
            if ":" in part:
                k, v = part.split(":", 1)
                result[k.strip()] = v.strip()
        return result
    return {"subgroup": group_str}


def generate_mitigation_report(ranked_biases):
    total_filtered = len(ranked_biases)

    grouped_data = {}
    for item in ranked_biases:
        key = (item["transformation_name"], item["script_name"])
        if key not in grouped_data:
            grouped_data[key] = []
        grouped_data[key].append(item)

    recommendations = []
    for (trans_name, script_name), items in grouped_data.items():
        count = len(items)
        scores = [entry["fitness_score"] for entry in items]
        max_score = scores[0]
        avg_score = sum(scores) / count

        affected_groups = []
        seen_groups = set()
        for entry in items:
            cleaned_group = clean_group_info(entry.get("demographic_group", ""))
            group_key = str(sorted(cleaned_group.items()))
            if group_key not in seen_groups:
                seen_groups.add(group_key)
                affected_groups.append(cleaned_group)
        
        category = classify_category(trans_name)
        if category == "generic_fallback":
            first_group = affected_groups[0] if affected_groups else "affected subgroups"
            actions = [
                f"This step shows a bias score of {max_score:.2f} for subgroup ({first_group}). "
                f"Compare this subgroup's selection rate change across this transformation against "
                f"the dataset average to confirm if the effect is specific to this subgroup."
            ]
            references = []
        else:
            cat_data = KNOWLEDGE_BASE.get(category, KNOWLEDGE_BASE.get("general", {}))
            actions = cat_data.get("techniques", [])
            references = cat_data.get("references", [])

        recommendations.append({
            "transformation_name": trans_name,
            "script_name": script_name,
            "category": category,
            "max_score": round(max_score, 4),
            "avg_score": round(avg_score, 4),
            "occurrence_count": count,
            "affected_groups": affected_groups,
            "recommended_actions": actions,
            "references": references
        })

    def sort_by_max_bias(item):
        return item["max_score"]

    recommendations.sort(key=sort_by_max_bias, reverse=True)

    script_summary = {}
    for rec in recommendations:
        s_name = rec["script_name"]
        if s_name not in script_summary:
            script_summary[s_name] = []
        script_summary[s_name].append(rec)

    script_rollups = []
    for s_name, rec_list in script_summary.items():
        total_count = sum(r["occurrence_count"] for r in rec_list)
        highest_score = max(r["max_score"] for r in rec_list)

        script_rollups.append({
            "script_name": s_name,
            "total_occurrences": total_count,
            "max_score": highest_score
        })

    def sort_by_script_score(script_item):
        return script_item["max_score"]

    script_rollups.sort(key=sort_by_script_score, reverse=True)
    
    print_mitigation_report(recommendations, script_rollups)
    return recommendations, script_rollups


def print_mitigation_report(recommendations, script_rollups):
    """Prints a clear, formatted mitigation report to the console."""
    print("\n" + "=" * 84)
    print("PROBA - AUDIT MITIGATION & FEEDBACK RECOMMENDATION REPORT")
    print("=" * 84)

    if not recommendations:
        print("No bias findings exceeded the reporting threshold. Pipeline is within acceptable bounds.")
        print("=" * 84 + "\n")
        return

    for idx, rec in enumerate(recommendations, 1):
        print(f"\n[{idx}] TRANSFORMATION: {rec['transformation_name']}")
        print(f"    Script File    : {rec['script_name']}")
        print(f"    Category       : {rec['category'].capitalize()}")
        print(f"    Metrics        : Max Bias: {rec['max_score']:.4f} | Avg Bias: {rec['avg_score']:.4f} | Count: {rec['occurrence_count']}")
      
        
        print(f"    Affected Subgroups ({len(rec['affected_groups'])}):")
        for g_idx, grp in enumerate(rec['affected_groups'][:4], 1):
            if isinstance(grp, dict):
                group_text = ", ".join(f"{k}: {v}" for k, v in grp.items())
            else:
                group_text = str(grp)
            print(f"      * Group {g_idx}: {group_text}")
        if len(rec['affected_groups']) > 4:
            print(f"      * ... and {len(rec['affected_groups']) - 4} more subgroup(s)")

        print("\n    RECOMMENDED ACTIONS (Mitigation Techniques):")
        for a_idx, action in enumerate(rec["recommended_actions"], 1):
            print(f"      {a_idx}. {action}")

        if rec["references"]:
            print("\n    ACADEMIC REFERENCES & CITATIONS:")
            for r_idx, ref in enumerate(rec["references"], 1):
                print(f"      [{r_idx}] {ref['citation']}")
                print(f"          URL: {ref['url']}")
        else:
            print("\n    ACADEMIC REFERENCES:")
            print("      None (Data-driven statistical observation; fallback)")

        print("-" * 84)

    print("\n" + "=" * 84)
    print("PIPELINE SCRIPT ROOT-CAUSE SUMMARY (OVERALL ROLLUP)")
    print("=" * 84)
    print(f"{'Script File':<42} | {'Total Occurrences':<20} | {'Max Bias Score':<15}")
    print("-" * 84)
    for s in script_rollups:
        print(f"{s['script_name']:<42} | {s['total_occurrences']:<20} | {s['max_score']:<15.4f}")
    print("=" * 84 + "\n")
