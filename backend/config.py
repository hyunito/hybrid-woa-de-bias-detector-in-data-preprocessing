import os
from typing import Dict, Set

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__)))
PIPELINE_DIR = os.path.abspath(os.path.join(BACKEND_DIR, "pipeline"))
PROJECT_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, ".."))
STORAGE_DIR = os.path.abspath(os.path.join(PROJECT_ROOT, "backend/storage"))
AUDITS_DIR = os.path.abspath(os.path.join(STORAGE_DIR, "audits"))

os.makedirs(PIPELINE_DIR, exist_ok=True)
os.makedirs(AUDITS_DIR, exist_ok=True)

# 1 MB chunk buffer for streaming file uploads to disk
CHUNK_SIZE = 1024 * 1024

SESSION_REGISTRY: Dict[str, Dict[str, Set[str]]] = {}
ACTIVE_AUDIT_RESULTS: Dict[str, dict] = {}
