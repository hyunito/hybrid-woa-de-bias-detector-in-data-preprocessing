import os
import json
import time
from fastapi import APIRouter, HTTPException
from config import AUDITS_DIR, ACTIVE_AUDIT_RESULTS
from engine.feedback import generate_mitigation_report

router = APIRouter(tags=["Results"])


def save_audit_result(audit_id: str, results: dict, threshold: float = 0.2) -> dict:
    """
    Canonical results and mitigation processor.
    Takes raw bias findings, generates actionable mitigation recommendations and script
    rollups, structures summary metrics, caches in active session memory, and persists
    the report to backend/storage/audits/{audit_id}.json.

    :param audit_id: Unique audit session identifier.
    :param results: Dictionary containing ranked_biases, provenance_records, chart_points,
                    and optionally pre-compiled recommendations and script_rollups.
    :param threshold: Disparity threshold applied during the audit.
    :return: The complete persisted audit record.
    """
    ranked = results.get("ranked_biases", [])

    # Generate actionable mitigations and pipeline rollups if not already provided
    recommendations = results.get("recommendations")
    script_rollups = results.get("script_rollups")
    if recommendations is None or script_rollups is None:
        recommendations, script_rollups = generate_mitigation_report(ranked)
        results["recommendations"] = recommendations
        results["script_rollups"] = script_rollups

    highest_score = round(float(ranked[0]["fitness_score"]), 4) if ranked else 0.0
    root_cause = (
        recommendations[0].get("category") or recommendations[0].get("transformation_name")
        if recommendations
        else (ranked[0].get("transformation_name") or ranked[0].get("script_name") if ranked else "Data Preprocessing")
    )

    record = {
        "audit_id": audit_id,
        "status": "completed",
        "created_at": time.strftime("%Y-%m-%d %H:%M"),
        "root_cause": root_cause,
        "highest_bias_score": highest_score,
        "threshold": threshold,
        "total_ranked_findings": len(ranked),
        "qualifying_recommendations": len(recommendations),
        "results": results
    }

    ACTIVE_AUDIT_RESULTS[audit_id] = record

    try:
        os.makedirs(AUDITS_DIR, exist_ok=True)
        file_path = os.path.join(AUDITS_DIR, f"{audit_id}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(record, f, indent=2)
        print(f"[Results] Saved audit report to {file_path}")
    except Exception as e:
        print(f"[Results] Failed to save audit report: {e}")

    return record


@router.get("/api/results/{audit_id}")
def get_audit_results(audit_id: str):
    """
    Retrieves completed audit findings for the specified audit session ID.
    Queries the active in-memory session cache first; if absent, loads the
    persisted JSON audit report from backend/storage/audits/.

    :param audit_id: The unique identifier of the audit session.
    :return: Full audit report dictionary containing ranked biases,
             mitigation recommendations, script rollups, and convergence curve data.
    """
    if audit_id in ACTIVE_AUDIT_RESULTS:
        return ACTIVE_AUDIT_RESULTS[audit_id]

    file_path = os.path.join(AUDITS_DIR, f"{audit_id}.json")
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                ACTIVE_AUDIT_RESULTS[audit_id] = data
                return data
        except Exception as err:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to read stored audit report for #{audit_id}: {err}"
            )

    raise HTTPException(
        status_code=404,
        detail=f"Audit results for #{audit_id} were not found in active cache or storage."
    )


@router.post("/api/results")
def store_audit_results(payload: dict):
    """
    Endpoint allowing clients to explicitly save or update an audit report.

    :param payload: Dictionary containing audit_id, results, and optional threshold.
    :return: Persisted audit record.
    """
    audit_id = payload.get("audit_id")
    if not audit_id:
        raise HTTPException(status_code=400, detail="Missing audit_id in payload.")
    results = payload.get("results", {})
    threshold = payload.get("threshold", 0.2)
    return save_audit_result(audit_id, results, threshold)
