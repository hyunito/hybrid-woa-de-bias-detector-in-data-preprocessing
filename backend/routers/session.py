import os
from fastapi import APIRouter

from config import PIPELINE_DIR, BACKEND_DIR, SESSION_REGISTRY

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
    Universal manual reset: purges all uploaded datasets, uploaded scripts, generated tracker
    configs/metadata, and active session registries, while preserving core utilities and .gitignore.
    """
    deleted = []
    SESSION_REGISTRY.clear()

    # 1. Purge pipeline uploaded scripts, datasets, and generated runtime files
    if os.path.exists(PIPELINE_DIR):
        for fname in os.listdir(PIPELINE_DIR):
            fpath = os.path.join(PIPELINE_DIR, fname)
            # Never delete utils directory, git files, or .gitignore
            if os.path.isdir(fpath) or fname.startswith(".git") or fname == ".gitignore":
                continue
            try:
                os.remove(fpath)
                deleted.append(f"pipeline/{fname}")
            except Exception as e:
                print(f"[Reset Error] Failed to delete {fpath}: {e}")

    # 2. Purge exported provenance metadata
    for p in [
        os.path.join(BACKEND_DIR, "storage", "provenance_metadata.json"),
        os.path.join(BACKEND_DIR, "provenance_metadata.json"),
        os.path.abspath(os.path.join(BACKEND_DIR, "..", "provenance_metadata.json")),
        os.path.join(PIPELINE_DIR, "provenance_metadata.json")
    ]:
        if os.path.exists(p) and os.path.isfile(p):
            try:
                os.remove(p)
                deleted.append(os.path.basename(p))
            except Exception as e:
                print(f"[Reset Error] Failed to delete {p}: {e}")

    print(f"[Session Reset] Purged all session files: {deleted}")
    return {"status": "success", "purged_files": deleted}
