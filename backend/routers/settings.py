import os
import psycopg2
from fastapi import APIRouter
from pydantic import BaseModel

from config import PIPELINE_DIR, BACKEND_DIR, SESSION_REGISTRY

router = APIRouter(tags=["Settings"])

ENV_FILE = os.path.join(BACKEND_DIR, ".env")

class DatabaseConfigPayload(BaseModel):
    db_name: str
    db_user: str
    db_password: str
    db_host: str = "localhost"
    db_port: str = "5432"

def get_or_create_env() -> dict:
    """
    Reads backend/.env. If missing, creates one with default PostgreSQL parameters.
    """
    default_env = {
        "DB_NAME": "bias_audit_db",
        "DB_USER": "postgres",
        "DB_PASSWORD": "password123",
        "DB_HOST": "localhost",
        "DB_PORT": "5432"
    }
    if not os.path.exists(ENV_FILE):
        try:
            with open(ENV_FILE, "w", encoding="utf-8") as f:
                for k, v in default_env.items():
                    f.write(f"{k}={v}\n")
            print(f"[Settings] Created new default .env at {ENV_FILE}")
        except Exception as e:
            print(f"[Settings] Error creating default .env: {e}")

    env_vars = {}
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip()
    return env_vars

def write_env_dict(data: dict):
    """
    Writes updated key-value pairs to backend/.env and updates os.environ.
    """
    lines = []
    keys_written = set()
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                stripped = line.strip()
                if stripped.startswith("#") or not stripped:
                    lines.append(line)
                    continue
                if "=" in stripped:
                    k = stripped.split("=", 1)[0].strip()
                    if k in data:
                        lines.append(f"{k}={data[k]}\n")
                        keys_written.add(k)
                    else:
                        lines.append(line)
    for k, v in data.items():
        if k not in keys_written:
            lines.append(f"{k}={v}\n")

    with open(ENV_FILE, "w", encoding="utf-8") as f:
        f.writelines(lines)

    for k, v in data.items():
        os.environ[k] = str(v)

def check_db_connection(dbname: str, user: str, password: str, host: str, port: str):
    """
    Tests live connection to PostgreSQL with a 3-second timeout.
    """
    try:
        port_num = int(port) if str(port).isdigit() else 5432
        conn = psycopg2.connect(
            dbname=dbname,
            user=user,
            password=password,
            host=host,
            port=port_num,
            connect_timeout=3
        )
        conn.close()
        return True, None
    except Exception as e:
        return False, str(e)


# ==========================================
# Database Configuration Endpoints
# ==========================================

@router.get("/api/settings/database")
def get_database_settings():
    """
    Retrieves database credentials from backend/.env and tests live connection status.
    """
    env_vars = get_or_create_env()
    db_name = env_vars.get("DB_NAME", "bias_audit_db")
    db_user = env_vars.get("DB_USER", "postgres")
    db_pass = env_vars.get("DB_PASSWORD", "")
    db_host = env_vars.get("DB_HOST", "localhost")
    db_port = env_vars.get("DB_PORT", "5432")

    is_connected, error = check_db_connection(db_name, db_user, db_pass, db_host, db_port)

    return {
        "db_name": db_name,
        "db_user": db_user,
        "db_password": db_pass,
        "db_host": db_host,
        "db_port": db_port,
        "is_connected": is_connected,
        "connection_error": error
    }

@router.post("/api/settings/database")
def update_database_settings(payload: DatabaseConfigPayload):
    """
    Updates backend/.env with new database settings, applies to runtime environment,
    and tests connection.
    """
    write_env_dict({
        "DB_NAME": payload.db_name,
        "DB_USER": payload.db_user,
        "DB_PASSWORD": payload.db_password,
        "DB_HOST": payload.db_host,
        "DB_PORT": str(payload.db_port)
    })

    is_connected, error = check_db_connection(
        payload.db_name,
        payload.db_user,
        payload.db_password,
        payload.db_host,
        str(payload.db_port)
    )

    return {
        "status": "success",
        "is_connected": is_connected,
        "connection_error": error
    }

@router.get("/api/settings/database/status")
def get_database_status():
    """
    Lightweight health-check endpoint for BottomBar to verify PostgreSQL connection.
    """
    env_vars = get_or_create_env()
    is_connected, error = check_db_connection(
        env_vars.get("DB_NAME", os.getenv("DB_NAME", "bias_audit_db")),
        env_vars.get("DB_USER", os.getenv("DB_USER", "postgres")),
        env_vars.get("DB_PASSWORD", os.getenv("DB_PASSWORD", "")),
        env_vars.get("DB_HOST", os.getenv("DB_HOST", "localhost")),
        env_vars.get("DB_PORT", os.getenv("DB_PORT", "5432"))
    )
    return {
        "is_connected": is_connected,
        "connection_error": error
    }


# ==========================================
# Session Management & Reset Endpoints
# ==========================================

def _execute_cleanup(session_id: str):
    deleted_files = []
    if session_id in SESSION_REGISTRY:
        session_data = SESSION_REGISTRY[session_id]
        targets = list(session_data.get("datasets", set())) + list(session_data.get("scripts", set()))
        
        for fpath in targets:
            norm = os.path.normpath(fpath)
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

def _execute_reset():
    deleted = []
    SESSION_REGISTRY.clear()

    # 1. Purge pipeline uploaded scripts, datasets, and generated runtime files
    if os.path.exists(PIPELINE_DIR):
        for fname in os.listdir(PIPELINE_DIR):
            fpath = os.path.join(PIPELINE_DIR, fname)
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

@router.post("/api/session/cleanup/{session_id}")
def cleanup_session(session_id: str):
    return _execute_cleanup(session_id)

@router.post("/api/session/reset")
def reset_session():
    return _execute_reset()
