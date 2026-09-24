import os
import sys
import subprocess
import signal

root_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(root_dir, "backend")
frontend_dir = os.path.join(root_dir, "frontend")


# Start backend
backend_proc = subprocess.Popen(
    [sys.executable, "server.py"],
    cwd=backend_dir,
    env=os.environ.copy()
)

# Start frontend
frontend_proc = subprocess.Popen(
    "npm run dev",
    cwd=frontend_dir,
    shell=True
)

def shutdown(sig, frame):
    print("\n[Shutting down servers...]")
    try:
        backend_proc.terminate()
    except Exception:
        pass
    try:
        frontend_proc.terminate()
    except Exception:
        pass
    sys.exit(0)

signal.signal(signal.SIGINT, shutdown)
signal.signal(signal.SIGTERM, shutdown)

try:
    backend_proc.wait()
    frontend_proc.wait()
except KeyboardInterrupt:
    shutdown(None, None)
