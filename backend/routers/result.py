import os
import json
from fastapi import APIRouter, HTTPException

from config import AUDITS_DIR, ACTIVE_AUDIT_RESULTS

router = APIRouter(tags=["Results"])


@router.get("/api/results/{audit_id}")
@router.get("/api/audit/results/{audit_id}")
def get_audit_results(audit_id: str):
    """Retrieves completed audit findings from memory or persistent storage."""
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
            raise HTTPException(status_code=500, detail=f"Failed to read stored audit report: {err}")

    raise HTTPException(status_code=404, detail="Audit results not found")
