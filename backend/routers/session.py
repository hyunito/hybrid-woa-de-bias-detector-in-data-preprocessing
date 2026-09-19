import os
from fastapi import APIRouter

from core.config import DATASET_DIR, PIPELINE_DIR, SESSION_REGISTRY

router = APIRouter(prefix="/api/session", tags=["Session"])

@router.post("/cleanup/{session_id}")
def cleanup_session(session_id: str):
    """
    Safely deletes uploaded datasets and scripts associated with this session.
    Protects backend/pipeline/utils, tracker_setup.py, and core repository source files.
    """
    deleted_files = []
    if session_id in SESSION_REGISTRY:
        session_data = SESSION_REGISTRY[session_id]
        targets = list(session_data.get("datasets", set())) + list(session_data.get("scripts", set()))
        
        for fpath in targets:
            norm = os.path.normpath(fpath)
            # Never delete core utilities, tracker_setup, or configs
            if "utils" in norm or norm.endswith("tracker_setup.py") or norm.endswith(".gitignore") or norm.endswith(".json"):
                continue
            if os.path.exists(fpath) and os.path.isfile(fpath):
                try:
                    os.remove(fpath)
                    deleted_files.append(os.path.basename(fpath))
                except Exception as e:
                    print(f"[Cleanup Error] Failed to delete {fpath}: {e}")
        del SESSION_REGISTRY[session_id]

    print(f"[Session Cleanup] Session {session_id} cleaned up: {deleted_files}")
    return {
        "status": "success",
        "session_id": session_id,
        "deleted_files": deleted_files
    }

@router.post("/reset")
def reset_session():
    """
    Universal reset: purges all uploaded datasets, uploaded scripts, and active session registries.
    """
    deleted = []
    SESSION_REGISTRY.clear()
    for d in [DATASET_DIR, PIPELINE_DIR]:
        if not os.path.exists(d):
            continue
        for fname in os.listdir(d):
            fpath = os.path.join(d, fname)
            if os.path.isdir(fpath) or fname in ("tracker_setup.py", ".gitignore") or fname.endswith(".json"):
                continue
            try:
                os.remove(fpath)
                deleted.append(fname)
            except Exception as e:
                print(f"[Reset Error] Failed to delete {fname}: {e}")
    print(f"[Session Reset] Purged all session files: {deleted}")
    return {"status": "success", "purged_files": deleted}
