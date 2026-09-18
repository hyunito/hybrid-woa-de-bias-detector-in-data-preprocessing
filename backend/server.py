import asyncio
import subprocess
import json
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import uuid
from typing import List, Optional
from pydantic import BaseModel
import os
import sys
import pandas as pd
import io
sys.path.append(os.path.join(os.path.dirname(__file__), "engine"))
from engine.audit import run_audit
from engine.feedback import generate_mitigation_report



DATASET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "dataset"))
PIPELINE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "pipeline"))
os.makedirs(DATASET_DIR, exist_ok=True)
os.makedirs(PIPELINE_DIR, exist_ok=True)

# Tracks uploaded files per session: session_id -> {"datasets": set(), "scripts": set()}
SESSION_REGISTRY = {}

app = FastAPI(title="PROBA", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {
        "status": "online",
        "message": "PROBA Backend is running and ready!"
    }

@app.post("/api/dataset/scan")
async def scan_dataset(file: UploadFile = File(...), session_id: Optional[str] = Form(None)):
    """
    Streams uploaded CSV directly to disk in backend/dataset/ in 1 MB chunks to avoid RAM spikes.
    Then scans the first 1,000 rows from disk for column types and binary targets.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")
    
    file_path = os.path.join(DATASET_DIR, file.filename)
    CHUNK_SIZE = 1024 * 1024  # 1 MB chunk buffer
    
    try:
        with open(file_path, "wb") as f_out:
            while chunk := await file.read(CHUNK_SIZE):
                f_out.write(chunk)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stream dataset to disk: {str(e)}")

    if session_id:
        if session_id not in SESSION_REGISTRY:
            SESSION_REGISTRY[session_id] = {"datasets": set(), "scripts": set()}
        SESSION_REGISTRY[session_id]["datasets"].add(file_path)

    try:
        df = pd.read_csv(file_path, nrows=1000)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    columns = []
    binary_targets = []

    for idx, col_name in enumerate(df.columns, 1):
        clean_name = str(col_name).strip()
        series = df[col_name].dropna()
        
        unique_vals = [str(v) for v in series.unique()]
        is_numeric = pd.api.types.is_numeric_dtype(series)
        col_type = "Continuous" if (is_numeric and len(unique_vals) > 10) else "Categorical"
        is_binary = (len(unique_vals) == 2)
        
        columns.append({
            "id": str(idx),
            "name": clean_name,
            "type": col_type,
            "is_binary": is_binary,
            "unique_values": unique_vals
        })

        if is_binary:
            binary_targets.append({
                "column": clean_name,
                "values": unique_vals
            })

    return {
        "filename": file.filename,
        "saved_path": file_path,
        "total_columns": len(columns),
        "columns": columns,
        "binary_targets": binary_targets
    }


@app.post("/api/pipeline/upload-scripts")
async def upload_pipeline_scripts(
    files: List[UploadFile] = File(...),
    session_id: Optional[str] = Form(None)
):
    """
    Streams uploaded Python preprocessing scripts directly to backend/pipeline/ in 1 MB chunks.
    Registers them with the session for automatic deletion upon session exit.
    """
    uploaded = []
    CHUNK_SIZE = 1024 * 1024
    if session_id and session_id not in SESSION_REGISTRY:
        SESSION_REGISTRY[session_id] = {"datasets": set(), "scripts": set()}

    for file in files:
        if not file.filename.endswith(".py"):
            continue
        dest_path = os.path.join(PIPELINE_DIR, file.filename)
        try:
            with open(dest_path, "wb") as f_out:
                while chunk := await file.read(CHUNK_SIZE):
                    f_out.write(chunk)
            uploaded.append(file.filename)
            if session_id:
                SESSION_REGISTRY[session_id]["scripts"].add(dest_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save script {file.filename}: {str(e)}")

    return {
        "status": "success",
        "uploaded_count": len(uploaded),
        "uploaded_scripts": uploaded
    }


@app.post("/api/session/cleanup/{session_id}")
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
            # Never delete core utilities or tracker_setup
            if "utils" in norm or norm.endswith("tracker_setup.py"):
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

class AuditRequest(BaseModel):
    bias_threshold: Optional[float] = 0.2
    num_whales: Optional[int] = 3
    max_iter: Optional[int] = 5
    
@app.post("/api/audit/run")
def start_audit(request: AuditRequest):
    audit_id = str(uuid.uuid4())[:8]
    print(f"\n[API] Received audit request {audit_id} with threshold {request.bias_threshold}")
  
    ranked_biases = run_audit(threshold=request.bias_threshold)
 
    recommendations, script_rollups = generate_mitigation_report(ranked_biases)
   
    return {
        "audit_id": audit_id,
        "status": "completed",
        "threshold": request.bias_threshold,
        "total_ranked_findings": len(ranked_biases),
        "qualifying_recommendations": len(recommendations),
        "results": {
            "ranked_biases": ranked_biases,
            "recommendations": recommendations,
            "script_rollups": script_rollups
        }
    }

class TrackerSetupRequest(BaseModel):
    protected_attributes: List[dict]
    target_variable: dict
    pipeline_scripts: Optional[List[dict]] = []

@app.post("/api/tracker/setup")
def setup_tracker(request: TrackerSetupRequest):
    """
    Dynamically generates backend/pipeline/tracker_setup.py with the user's
    configured protected demographic attributes and target variable.
    """
    import datetime
    pipeline_dir = os.path.join(os.path.dirname(__file__), "pipeline")
    os.makedirs(pipeline_dir, exist_ok=True)

    # Normalize protected attributes (types must be 'categorical' or 'continuous')
    clean_attributes = []
    for attr in request.protected_attributes:
        name = str(attr.get("name", "")).strip()
        attr_type = str(attr.get("type", "")).strip().lower()
        if attr_type not in ["categorical", "continuous"]:
            attr_type = "categorical"
        clean_attributes.append({"name": name, "type": attr_type})

    # Normalize target variable
    target_name = str(request.target_variable.get("name", "")).strip()
    pos_val = str(request.target_variable.get("positive", "")).strip()
    neg_val = str(request.target_variable.get("negative", "")).strip()
    clean_target = {
        "name": target_name,
        "positive": pos_val,
        "negative": neg_val
    }

    config_data = {
        "protected_attributes": clean_attributes,
        "target_variable": clean_target,
        "pipeline_scripts": request.pipeline_scripts or [],
        "updated_at": datetime.datetime.now().isoformat()
    }

    # Save JSON cache
    config_json_path = os.path.join(pipeline_dir, "tracker_config.json")
    with open(config_json_path, "w", encoding="utf-8") as f:
        json.dump(config_data, f, indent=4)

    # Generate tracker_setup.py
    tracker_code = f"""# Auto-generated by PROBA Tracker Setup
# Generated on: {datetime.datetime.now().isoformat()}
import os
import sys
import atexit

_current_dir = os.path.dirname(os.path.abspath(__file__))
_utils_dir = os.path.join(_current_dir, "utils")
if _utils_dir not in sys.path:
    sys.path.insert(0, _utils_dir)

try:
    from utils.provenance import ProvenanceMetadataTracker
except ImportError:
    from provenance import ProvenanceMetadataTracker

tracker = ProvenanceMetadataTracker(
    protected_attributes={clean_attributes!r},
    target_variable={clean_target!r}
)

def _auto_export_on_exit():
    # Automatically exports tracked provenance records at the end of the pipeline.
    if hasattr(tracker, 'metadata_records') and tracker.metadata_records:
        # Determine root directory for provenance_metadata.json
        root_dir = os.path.abspath(os.path.join(_current_dir, "..", ".."))
        json_path = os.path.join(root_dir, "provenance_metadata.json")
        try:
            tracker.export_to_database()
        except Exception as e:
            print(f"[Tracker] Notice: Could not export to DB ({{e}}), falling back to JSON.")
        try:
            tracker.export_to_json(json_path)
            print(f"[Tracker] Auto-exported {{len(tracker.metadata_records)}} provenance records to {{json_path}}")
        except Exception as e:
            print(f"[Tracker] Error exporting to JSON: {{e}}")

atexit.register(_auto_export_on_exit)
"""
    tracker_file_path = os.path.join(pipeline_dir, "tracker_setup.py")
    with open(tracker_file_path, "w", encoding="utf-8") as f:
        f.write(tracker_code)

    print(f"[API] Generated dynamic tracker_setup.py with {len(clean_attributes)} attributes and target '{target_name}'.")

    return {
        "status": "success",
        "message": "tracker_setup.py generated successfully",
        "file_path": tracker_file_path,
        "config": config_data
    }


ACTIVE_AUDIT_RESULTS = {}

@app.get("/api/audit/results/{audit_id}")
def get_audit_results(audit_id: str):
    if audit_id in ACTIVE_AUDIT_RESULTS:
        return ACTIVE_AUDIT_RESULTS[audit_id]
    raise HTTPException(status_code=404, detail="Audit results not found")

@app.websocket("/ws/audit/{audit_id}")
async def audit_websocket(websocket: WebSocket, audit_id: str):
    await websocket.accept()
    print(f"[WebSocket] Client connected for audit: {audit_id}")

    try:
        # 1. Read pipeline configuration
        pipeline_dir = os.path.join(os.path.dirname(__file__), "pipeline")
        config_path = os.path.join(pipeline_dir, "tracker_config.json")
        pipeline_scripts = []
        
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                saved_cfg = json.load(f)
                pipeline_scripts = saved_cfg.get("pipeline_scripts", [])
        
        # Strict check: Never run hardcoded pipelines or random searches without configured scripts
        if not pipeline_scripts:
            await websocket.send_json({
                "type": "terminal_log",
                "stream": "warning",
                "text": "> [PROBA] No preprocessing pipeline scripts configured. Please upload and sequence scripts in Dashboard first."
            })
            await websocket.send_json({
                "type": "error",
                "message": "No pipeline scripts configured. Please upload and sequence scripts in Dashboard first."
            })
            return
        
        # Phase 1: Ingestion Pipeline Execution
        first_script_name = pipeline_scripts[0]["name"]
        await websocket.send_json({
            "type": "pipeline_start",
            "scripts": pipeline_scripts,
            "active_script": first_script_name
        })

        # Locate script file (search backend/pipeline, backend, project_root)
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        possible_paths = [
            os.path.join(project_root, "backend", "pipeline", first_script_name),
            os.path.join(project_root, "backend", first_script_name),
            os.path.join(project_root, first_script_name)
        ]
        script_to_run = None
        for p in possible_paths:
            if os.path.exists(p):
                script_to_run = p
                break
       
        if script_to_run:
            await websocket.send_json({
                "type": "terminal_log",
                "stream": "info",
                "text": f"> Executing initial pipeline script: {first_script_name}"
            })
            
            # Run script as subprocess safely on Windows using threaded Popen
            loop = asyncio.get_running_loop()
            output_queue = asyncio.Queue()
            pipeline_dir = os.path.dirname(script_to_run)
            env = {
                **os.environ,
                "PYTHONUNBUFFERED": "1",
                "PYTHONPATH": f"{pipeline_dir};{project_root};{os.path.join(project_root, 'backend')};" + os.environ.get("PYTHONPATH", "")
            }

            def run_pipeline_process():
                try:
                    proc = subprocess.Popen(
                        [sys.executable, "-u", script_to_run],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        cwd=project_root,
                        text=True,
                        bufsize=1,
                        env=env
                    )
                    for line in iter(proc.stdout.readline, ''):
                        clean = line.rstrip()
                        if clean:
                            loop.call_soon_threadsafe(output_queue.put_nowait, clean)
                    proc.wait()
                    return proc.returncode
                except Exception as ex:
                    loop.call_soon_threadsafe(output_queue.put_nowait, f"[Subprocess Error] {ex}")
                    return -1

            subp_task = asyncio.create_task(asyncio.to_thread(run_pipeline_process))

            while not subp_task.done() or not output_queue.empty():
                try:
                    line = await asyncio.wait_for(output_queue.get(), timeout=0.05)
                    await websocket.send_json({
                        "type": "terminal_log",
                        "stream": "stdout",
                        "text": line
                    })
                except asyncio.TimeoutError:
                    pass

            returncode = await subp_task

            if returncode == 0:
                await websocket.send_json({
                    "type": "terminal_log",
                    "stream": "info",
                    "text": f"> Pipeline preprocessing completed (Exit Code: {returncode})"
                })
            else:
                await websocket.send_json({
                    "type": "terminal_log",
                    "stream": "error",
                    "text": f"> Pipeline preprocessing exited with code: {returncode}"
                })
                await websocket.send_json({
                    "type": "error",
                    "message": f"Pipeline script '{first_script_name}' failed with return code {returncode}."
                })
                return
        else:
            await websocket.send_json({
                "type": "terminal_log",
                "stream": "error",
                "text": f"> [PROBA] Error: Configured script file '{first_script_name}' was not found on server."
            })
            await websocket.send_json({
                "type": "error",
                "message": f"Script file '{first_script_name}' not found on server."
            })
            return
        
        # Check for Provenance Metadata JSON exported by the executed script
        prov_paths = [
            os.path.join(project_root, "provenance_metadata.json"),
            os.path.join(project_root, "backend", "provenance_metadata.json"),
            os.path.join(project_root, "backend", "pipeline", "provenance_metadata.json")
        ]
        found_prov = None
        for p in prov_paths:
            if os.path.exists(p):
                found_prov = p
                break

        if not found_prov:
            await websocket.send_json({
                "type": "terminal_log",
                "stream": "error",
                "text": "> [PROBA] Error: No provenance_metadata.json was generated. Ensure your preprocessing functions are tracked with @tracker.track."
            })
            await websocket.send_json({
                "type": "error",
                "message": "No provenance metadata generated by pipeline script."
            })
            return

        await websocket.send_json({
            "type": "terminal_log",
            "stream": "info",
            "text": f"> Exported Provenance Metadata ({os.path.basename(found_prov)}):"
        })
        with open(found_prov, "r", encoding="utf-8") as f:
            prov_records = json.load(f)
            formatted_json = json.dumps(prov_records, indent=2)
            lines = formatted_json.splitlines()
            sample_lines = lines[:60]
            for l in sample_lines:
                await websocket.send_json({
                    "type": "terminal_log",
                    "stream": "json",
                    "text": l
                })
            if len(lines) > 60:
                await websocket.send_json({
                    "type": "terminal_log",
                    "stream": "json",
                    "text": f"... [{len(lines) - 60} more lines exported to provenance_metadata.json]"
                })

        await websocket.send_json({
            "type": "pipeline_completed",
            "message": "All pipeline transformations tracked successfully."
        })

        # Small pause before search
        await asyncio.sleep(0.5)

        # Phase 2: Live Bias Audit Search
        await websocket.send_json({
            "type": "audit_start",
            "message": "Starting Metaheuristic Bias Scouting & Exploitation..."
        })

        import hybrid_woa
        auditor = hybrid_woa.WOAAuditor(num_whales=20, max_iter=10)

        loop = asyncio.get_running_loop()
        point_queue = asyncio.Queue()

        def stream_point(pt):
            loop.call_soon_threadsafe(point_queue.put_nowait, pt)

        # Run auditor in background thread
        search_task = asyncio.create_task(asyncio.to_thread(auditor.run_woa, callback=stream_point))

        seen_bias_scores = set()
        step_counter = 0
        while not search_task.done() or not point_queue.empty():
            try:
                pt = await asyncio.wait_for(point_queue.get(), timeout=0.05)
                score = round(float(pt.get("fitness_score", 0.0)), 4)
                # Only stream when a new, unique bias score is found
                if score > 0.0 and score not in seen_bias_scores:
                    seen_bias_scores.add(score)
                    step_counter += 1
                    await websocket.send_json({
                        "type": "chart_point",
                        "data": {
                            "step": step_counter,
                            "fitness_score": score,
                            "best_fitness": round(float(pt.get("best_fitness", score)), 4)
                        }
                    })
            except asyncio.TimeoutError:
                pass

        await search_task

        # Phase 3: Final Audit Report Compilation
        all_biases = auditor.all_biases
        from engine.audit import get_fitness_score
        from engine.feedback import generate_mitigation_report

        unique_records = {}
        for entry in all_biases:
            key = (entry["script_name"], entry["transformation_name"], entry["demographic_group"])
            if key not in unique_records or entry["fitness_score"] > unique_records[key]["fitness_score"]:
                unique_records[key] = entry

        ranked_biases = list(unique_records.values())
        ranked_biases.sort(key=get_fitness_score, reverse=True)

        threshold = 0.2
        filtered_biases = []
        for rank_num, bias in enumerate(ranked_biases, 1):
            bias["rank"] = rank_num
            if bias.get("fitness_score", 0.0) > threshold:
                filtered_biases.append(bias)

        recommendations, script_rollups = generate_mitigation_report(filtered_biases)

        result_payload = {
            "audit_id": audit_id,
            "status": "completed",
            "threshold": threshold,
            "total_ranked_findings": len(filtered_biases),
            "qualifying_recommendations": len(recommendations),
            "results": {
                "ranked_biases": filtered_biases,
                "recommendations": recommendations,
                "script_rollups": script_rollups
            }
        }

        ACTIVE_AUDIT_RESULTS[audit_id] = result_payload

        await websocket.send_json({
            "type": "completed",
            "audit_id": audit_id,
            "total_ranked_findings": len(filtered_biases),
            "qualifying_recommendations": len(recommendations),
            "results": result_payload["results"]
        })

        print(f"[WebSocket] Audit {audit_id} fully completed and emitted.")

    except WebSocketDisconnect:
        print(f"[WebSocket] Client disconnected: {audit_id}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        err_msg = str(e).strip() or f"{type(e).__name__}: An unexpected error occurred during execution."
        print(f"[WebSocket] Error during audit streaming: {err_msg}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": err_msg
            })
        except Exception:
            pass

if __name__ == "__main__":
   
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
