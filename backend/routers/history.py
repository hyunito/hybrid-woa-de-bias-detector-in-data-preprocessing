import os
import json
import time
from fastapi import APIRouter, HTTPException

from config import AUDITS_DIR, ACTIVE_AUDIT_RESULTS

router = APIRouter(tags=["History"])

@router.get("/api/history")
@router.get("/api/audit/history")
def get_audit_history():
    """Returns summary list of all past audits stored in the audits storage directory."""
    history = []
    if not os.path.exists(AUDITS_DIR):
        return history

    for filename in os.listdir(AUDITS_DIR):
        if not filename.endswith(".json"):
            continue
        file_path = os.path.join(AUDITS_DIR, filename)
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                audit_id = data.get("audit_id") or os.path.splitext(filename)[0]

                created_at = data.get("created_at")
                if not created_at:
                    mtime = os.path.getmtime(file_path)
                    created_at = time.strftime("%Y-%m-%d %H:%M", time.localtime(mtime))

                results = data.get("results", {})
                ranked = results.get("ranked_biases", [])
                recs = results.get("recommendations", [])

                highest_score = data.get("highest_bias_score")
                if highest_score is None:
                    highest_score = round(float(ranked[0]["fitness_score"]), 4) if ranked else 0.0
                else:
                    highest_score = round(float(highest_score), 4)

                root_cause = data.get("root_cause")
                if not root_cause:
                    if recs:
                        root_cause = recs[0].get("category") or recs[0].get("transformation_name")
                    elif ranked:
                        root_cause = ranked[0].get("transformation_name") or ranked[0].get("script_name")
                    else:
                        root_cause = "Pipeline Analysis"

                history.append({
                    "id": audit_id,
                    "auditId": audit_id,
                    "dateTime": created_at,
                    "rootCause": root_cause,
                    "biasScore": highest_score,
                    "totalFindings": data.get("total_ranked_findings", len(ranked)),
                    "isSelected": False
                })
        except Exception as err:
            print(f"[Storage] Error reading audit file {filename}: {err}")

    # Sort newest first
    history.sort(key=lambda x: x.get("dateTime", ""), reverse=True)
    return history


@router.delete("/api/history/{audit_id}")
@router.delete("/api/audit/history/{audit_id}")
def delete_audit_history(audit_id: str):
    """Deletes a specific audit record from storage and cache."""
    if audit_id in ACTIVE_AUDIT_RESULTS:
        del ACTIVE_AUDIT_RESULTS[audit_id]

    file_path = os.path.join(AUDITS_DIR, f"{audit_id}.json")
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            return {"message": f"Audit {audit_id} deleted successfully", "audit_id": audit_id}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete audit record: {e}")

    return {"message": f"Audit {audit_id} deleted from memory", "audit_id": audit_id}
