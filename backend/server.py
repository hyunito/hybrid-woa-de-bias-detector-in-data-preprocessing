import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Ensure backend and engine directories are in python search path
_backend_dir = os.path.dirname(os.path.abspath(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

_engine_dir = os.path.join(_backend_dir, "engine")
if _engine_dir not in sys.path:
    sys.path.insert(0, _engine_dir)

from routers.dashboard import router as dashboard_router
from routers.configuration import router as configuration_router
from routers.audit import router as audit_router
from routers.session import router as session_router

app = FastAPI(
    title="PROBA - Provenance-based Bias Auditor API"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register specialized domain routers
app.include_router(dashboard_router)
app.include_router(configuration_router)
app.include_router(audit_router)
app.include_router(session_router)

if __name__ == "__main__":
    uvicorn.run(
        "server:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=[
            os.path.join(_backend_dir, "routers"),
            os.path.join(_backend_dir, "engine"),
        ],
    )
