import os
from typing import Dict, Set

# Project directories
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATASET_DIR = os.path.abspath(os.path.join(BACKEND_DIR, "dataset"))
PIPELINE_DIR = os.path.abspath(os.path.join(BACKEND_DIR, "pipeline"))
PROJECT_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, ".."))

os.makedirs(DATASET_DIR, exist_ok=True)
os.makedirs(PIPELINE_DIR, exist_ok=True)

# 1 MB chunk buffer for streaming file uploads to disk
CHUNK_SIZE = 1024 * 1024

# Session registry for tracking uploaded files: session_id -> {"datasets": set(), "scripts": set()}
SESSION_REGISTRY: Dict[str, Dict[str, Set[str]]] = {}
