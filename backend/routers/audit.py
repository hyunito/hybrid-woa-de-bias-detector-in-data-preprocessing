import os
import sys
import json
import time
import asyncio
import subprocess
from typing import Dict, List, Set, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from config import PIPELINE_DIR, BACKEND_DIR
from engine.audit import get_fitness_score
from engine.hybrid_woa import WOAAuditor
from routers.result import save_audit_result
from routers.settings import get_algorithm_settings

router = APIRouter(tags=["Audit"])


class AuditSession:
    def __init__(self, audit_id: str):
        self.audit_id = audit_id
        self.status = "running"  # "running", "completed", "terminated", "error"
        self.stage = "connecting"  # "connecting", "pipeline", "evaluating", "completed", "terminated", "error"
        self.active_script_idx = 0
        self.pipeline_scripts: List[dict] = []
        self.terminal_logs: List[dict] = []
        self.chart_points: List[dict] = []
        self.results: Optional[dict] = None
        self.error_message: Optional[str] = None
        self.active_process: Optional[subprocess.Popen] = None
        self.search_task: Optional[asyncio.Task] = None
        self.task: Optional[asyncio.Task] = None
        self.is_terminated = False
        self.start_time: float = time.time()
        self.end_time: Optional[float] = None
        self.subscribers: Set[WebSocket] = set()

    async def broadcast(self, message: dict):
        msg_type = message.get("type")
        if msg_type == "terminal_log":
            self.terminal_logs.append(message)
        elif msg_type == "chart_point":
            self.chart_points.append(message.get("data"))
        elif msg_type == "pipeline_start":
            self.stage = "pipeline"
            self.pipeline_scripts = message.get("scripts", [])
        elif msg_type == "script_step":
            self.active_script_idx = message.get("index", 0)
        elif msg_type == "audit_start":
            self.stage = "evaluating"
        elif msg_type == "completed":
            self.status = "completed"
            self.stage = "completed"
            self.results = message.get("results")
        elif msg_type == "terminated":
            self.status = "terminated"
            self.stage = "terminated"
        elif msg_type == "error":
            self.status = "error"
            self.stage = "error"
            self.error_message = message.get("message")

        dead = []
        for ws in list(self.subscribers):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.subscribers.discard(ws)

    async def terminate(self):
        if self.is_terminated or self.status in ["completed", "terminated"]:
            return
        self.is_terminated = True
        self.status = "terminated"
        self.stage = "terminated"
        print(f"[AuditSession] Terminating audit #{self.audit_id}")

        if self.active_process and self.active_process.poll() is None:
            try:
                self.active_process.terminate()
                print(f"[AuditSession] Terminated active subprocess PID {self.active_process.pid}")
            except Exception as e:
                print(f"[AuditSession] Failed to terminate subprocess: {e}")

        if self.search_task and not self.search_task.done():
            self.search_task.cancel()

        if self.task and not self.task.done():
            self.task.cancel()

        await self.broadcast({
            "type": "terminal_log",
            "stream": "warning",
            "text": "> [SYSTEM] Audit session was terminated by user."
        })
        if not self.end_time:
            self.end_time = time.time()
        elapsed_s = int(self.end_time - self.start_time)
        await self.broadcast({
            "type": "terminated",
            "audit_id": self.audit_id,
            "message": "Audit session was terminated by user.",
            "elapsed_seconds": elapsed_s
        })


ACTIVE_AUDIT_SESSIONS: Dict[str, AuditSession] = {}


async def run_full_audit(session: AuditSession):
    loop = asyncio.get_running_loop()
    try:
        config_path = os.path.join(PIPELINE_DIR, "tracker_config.json")
        pipeline_scripts = []

        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                saved_cfg = json.load(f)
                pipeline_scripts = saved_cfg.get("pipeline_scripts", [])

        if not pipeline_scripts:
            err_msg = "No pipeline scripts configured. Please upload and sequence scripts in Dashboard first."
            await session.broadcast({
                "type": "terminal_log",
                "stream": "warning",
                "text": f"> [PROBA] {err_msg}"
            })
            await session.broadcast({
                "type": "error",
                "message": err_msg
            })
            return

        if session.is_terminated:
            return

        # Phase 1: Ingestion Pipeline Execution
        first_script_name = pipeline_scripts[0]["name"]
        await session.broadcast({
            "type": "pipeline_start",
            "scripts": pipeline_scripts,
            "active_script": first_script_name
        })

        executed_step_indices = set()
        current_script_idx = 0

        for exec_idx, script_info in enumerate(pipeline_scripts):
            if session.is_terminated:
                return

            if exec_idx in executed_step_indices and exec_idx > 0:
                continue

            script_name = script_info["name"]
            script_path = os.path.join(PIPELINE_DIR, script_name)

            if not os.path.exists(script_path):
                err_msg = f"Configured script file '{script_name}' was not found on server."
                await session.broadcast({
                    "type": "terminal_log",
                    "stream": "error",
                    "text": f"> [PROBA ERROR] {err_msg}"
                })
                await session.broadcast({
                    "type": "error",
                    "message": err_msg
                })
                return

            rel_path = os.path.relpath(script_path, BACKEND_DIR)
            await session.broadcast({
                "type": "terminal_log",
                "stream": "info",
                "text": f"> Executing pipeline script from disk ({rel_path})"
            })

            current_script_idx = exec_idx
            executed_step_indices.add(exec_idx)
            await session.broadcast({
                "type": "script_step",
                "index": exec_idx,
                "name": script_name
            })

            output_queue = asyncio.Queue()
            pipeline_dir = os.path.dirname(script_path)
            env = {
                **os.environ,
                "PYTHONUNBUFFERED": "1",
                "PYTHONPATH": f"{pipeline_dir};{PIPELINE_DIR};{BACKEND_DIR};" + os.environ.get("PYTHONPATH", "")
            }

            def run_single_process(target_script):
                try:
                    proc = subprocess.Popen(
                        [sys.executable, "-u", target_script],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        stdin=subprocess.DEVNULL,
                        cwd=PIPELINE_DIR,
                        text=True,
                        bufsize=1,
                        env=env
                    )
                    session.active_process = proc
                    for line in iter(proc.stdout.readline, ''):
                        clean = line.rstrip()
                        if clean:
                            loop.call_soon_threadsafe(output_queue.put_nowait, clean)
                    proc.wait()
                    return proc.returncode
                except Exception as ex:
                    loop.call_soon_threadsafe(output_queue.put_nowait, f"[Subprocess Error] {ex}")
                    return -1
                finally:
                    session.active_process = None

            subp_task = asyncio.create_task(asyncio.to_thread(run_single_process, script_path))
            proc_start_time = time.time()
            last_output_time = time.time()

            while not subp_task.done() or not output_queue.empty():
                if session.is_terminated:
                    if session.active_process and session.active_process.poll() is None:
                        try:
                            session.active_process.terminate()
                        except Exception:
                            pass
                    return

                try:
                    line = await asyncio.wait_for(output_queue.get(), timeout=1.0)
                    last_output_time = time.time()

                    if "> [PROBA_STEP] " in line:
                        active_script_name = line.split("> [PROBA_STEP] ")[-1].strip()
                        for p_idx, p_script in enumerate(pipeline_scripts):
                            if p_script.get("name") == active_script_name:
                                if p_idx != current_script_idx:
                                    current_script_idx = p_idx
                                    executed_step_indices.add(p_idx)
                                    await session.broadcast({
                                        "type": "script_step",
                                        "index": current_script_idx,
                                        "name": active_script_name
                                    })
                                break

                    await session.broadcast({
                        "type": "terminal_log",
                        "stream": "stdout",
                        "text": line
                    })
                except asyncio.TimeoutError:
                    if not subp_task.done() and (time.time() - last_output_time > 4.0):
                        elapsed_s = int(time.time() - proc_start_time)
                        active_name = pipeline_scripts[current_script_idx]["name"] if current_script_idx < len(pipeline_scripts) else script_name
                        await session.broadcast({
                            "type": "terminal_log",
                            "stream": "info",
                            "text": f"> [PROBA] Executing {active_name}... ({elapsed_s}s elapsed)"
                        })
                        last_output_time = time.time()

            returncode = await subp_task
            if session.is_terminated:
                return

            if returncode != 0:
                err_text = f"Pipeline script '{script_name}' failed with return code {returncode}."
                await session.broadcast({
                    "type": "terminal_log",
                    "stream": "error",
                    "text": f"> [PROBA ERROR] {err_text}"
                })
                await session.broadcast({
                    "type": "error",
                    "message": err_text
                })
                return

        if session.is_terminated:
            return

        await session.broadcast({
            "type": "pipeline_completed"
        })
        await session.broadcast({
            "type": "terminal_log",
            "stream": "info",
            "text": "> Pipeline preprocessing completed"
        })

        found_prov = os.path.join(BACKEND_DIR, "storage", "provenance_metadata.json")
        if not os.path.exists(found_prov):
            err_msg = "No provenance_metadata.json was generated. Ensure your preprocessing functions are tracked with @tracker.track."
            await session.broadcast({
                "type": "terminal_log",
                "stream": "error",
                "text": f"> [PROBA ERROR] {err_msg}"
            })
            await session.broadcast({
                "type": "error",
                "message": err_msg
            })
            return

        await session.broadcast({
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
                await session.broadcast({
                    "type": "terminal_log",
                    "stream": "json",
                    "text": l
                })
            if len(lines) > 60:
                await session.broadcast({
                    "type": "terminal_log",
                    "stream": "json",
                    "text": f"... [{len(lines) - 60} more lines exported to provenance_metadata.json]"
                })

        await session.broadcast({
            "type": "pipeline_completed",
            "message": "All pipeline transformations tracked successfully."
        })
        await asyncio.sleep(0.5)

        if session.is_terminated:
            return

        # Phase 2: WOA-DE Hybrid Search
        await session.broadcast({
            "type": "audit_start",
            "message": "Starting PROBA..."
        })

        algo_cfg = get_algorithm_settings()
        num_whales = int(algo_cfg.get("searchingAgents", 30))
        max_iter = int(algo_cfg.get("maxIterations", 30))
        de_params = {
            "pop_size": int(algo_cfg.get("populationSize", 30)),
            "F": float(algo_cfg.get("scaleFactor", 0.5)),
            "CR": float(algo_cfg.get("crossoverRate", 0.7)),
            "max_stagnation": int(algo_cfg.get("maxStagnationLimit", 25))
        }
        threshold = float(algo_cfg.get("biasThreshold", 0.2))
        auditor = WOAAuditor(
            metadata_logs=prov_records,
            num_whales=num_whales,
            max_iter=max_iter,
            de_params=de_params
        )

        point_queue = asyncio.Queue()

        def stream_point(pt):
            if not session.is_terminated:
                loop.call_soon_threadsafe(point_queue.put_nowait, pt)

        search_task = asyncio.create_task(asyncio.to_thread(auditor.run_woa, callback=stream_point))
        session.search_task = search_task

        seen_bias_scores = set()
        step_counter = 0
        chart_points_history = []

        while not search_task.done() or not point_queue.empty():
            if session.is_terminated:
                search_task.cancel()
                return

            try:
                pt = await asyncio.wait_for(point_queue.get(), timeout=0.05)
                score = round(float(pt.get("fitness_score", 0.0)), 4)
                if score > 0.0 and score not in seen_bias_scores:
                    seen_bias_scores.add(score)
                    step_counter += 1
                    point_data = {
                        "step": step_counter,
                        "fitness_score": score,
                        "best_fitness": round(float(pt.get("best_fitness", score)), 4)
                    }
                    chart_points_history.append(point_data)
                    await session.broadcast({
                        "type": "chart_point",
                        "data": point_data
                    })
                    await asyncio.sleep(0.045)
            except asyncio.TimeoutError:
                pass

        await search_task
        if session.is_terminated:
            return

        await asyncio.sleep(0.4)

        # Phase 3: Final Audit Report Compilation
        all_biases = auditor.all_biases

        unique_records = {}
        for entry in all_biases:
            key = (entry["script_name"], entry["transformation_name"], entry["demographic_group"])
            if key not in unique_records or entry["fitness_score"] > unique_records[key]["fitness_score"]:
                unique_records[key] = entry

        ranked_biases = list(unique_records.values())
        ranked_biases.sort(key=get_fitness_score, reverse=True)

        filtered_biases = []
        for rank_num, bias in enumerate(ranked_biases, 1):
            bias["rank"] = rank_num
            if bias.get("fitness_score", 0.0) > threshold:
                filtered_biases.append(bias)

        raw_results = {
            "ranked_biases": filtered_biases,
            "provenance_records": prov_records,
            "chart_points": chart_points_history
        }

        session.end_time = time.time()
        elapsed_s = int(session.end_time - session.start_time)
        final_record = save_audit_result(session.audit_id, raw_results, threshold)

        await session.broadcast({
            "type": "completed",
            "audit_id": session.audit_id,
            "total_ranked_findings": final_record["total_ranked_findings"],
            "qualifying_recommendations": final_record["qualifying_recommendations"],
            "results": final_record["results"],
            "elapsed_seconds": elapsed_s
        })

        session.status = "completed"
        print(f"[AuditSession] Audit {session.audit_id} fully completed and emitted.")

    except asyncio.CancelledError:
        print(f"[AuditSession] Audit {session.audit_id} task was cancelled.")
        if session.active_process and session.active_process.poll() is None:
            try:
                session.active_process.terminate()
            except Exception:
                pass
    except Exception as e:
        import traceback
        traceback.print_exc()
        err_msg = str(e).strip() or f"{type(e).__name__}: An unexpected error occurred during execution."
        print(f"[AuditSession] Error during audit {session.audit_id}: {err_msg}")
        await session.broadcast({
            "type": "terminal_log",
            "stream": "error",
            "text": f"> [SYSTEM ERROR] {err_msg}"
        })
        await session.broadcast({
            "type": "error",
            "message": err_msg
        })
    finally:
        if session.active_process and session.active_process.poll() is None:
            try:
                session.active_process.terminate()
            except Exception:
                pass


@router.websocket("/ws/audit/{audit_id}")
async def audit_websocket(websocket: WebSocket, audit_id: str):
    await websocket.accept()
    print(f"[WebSocket] Client connected for audit: {audit_id}")

    session = ACTIVE_AUDIT_SESSIONS.get(audit_id)
    if not session or session.status in ["completed", "terminated", "error"]:
        session = AuditSession(audit_id)
        ACTIVE_AUDIT_SESSIONS[audit_id] = session
        session.task = asyncio.create_task(run_full_audit(session))

    session.subscribers.add(websocket)

    try:
        # Send live timing sync immediately
        elapsed_s = int((session.end_time or time.time()) - session.start_time)
        await websocket.send_json({
            "type": "audit_sync",
            "audit_id": session.audit_id,
            "start_time": session.start_time,
            "elapsed_seconds": elapsed_s,
            "is_completed": session.status == "completed",
            "is_terminated": session.status == "terminated"
        })

        # Replay historical state so reconnected client catches up immediately
        if session.pipeline_scripts:
            await websocket.send_json({
                "type": "pipeline_start",
                "scripts": session.pipeline_scripts,
                "active_script": (
                    session.pipeline_scripts[session.active_script_idx]["name"]
                    if session.active_script_idx < len(session.pipeline_scripts)
                    else ""
                )
            })
            await websocket.send_json({
                "type": "script_step",
                "index": session.active_script_idx
            })

        for log_item in session.terminal_logs:
            await websocket.send_json(log_item)

        for pt in session.chart_points:
            await websocket.send_json({
                "type": "chart_point",
                "data": pt
            })

        if session.stage == "evaluating":
            await websocket.send_json({
                "type": "audit_start",
                "message": "Starting PROBA..."
            })
        elif session.stage == "completed" and session.results:
            elapsed_s = int((session.end_time or time.time()) - session.start_time)
            await websocket.send_json({
                "type": "completed",
                "audit_id": session.audit_id,
                "results": session.results,
                "elapsed_seconds": elapsed_s
            })
        elif session.stage == "terminated":
            await websocket.send_json({
                "type": "terminated",
                "audit_id": session.audit_id,
                "message": "Audit session was terminated."
            })

        # Keep connection open and listen for client actions (e.g., terminate)
        while True:
            text = await websocket.receive_text()
            try:
                data = json.loads(text)
                if data.get("type") == "terminate" or data.get("action") == "terminate":
                    await session.terminate()
            except Exception:
                pass

    except WebSocketDisconnect:
        print(f"[WebSocket] Client disconnected from {audit_id} (audit continues in background).")
    finally:
        session.subscribers.discard(websocket)


@router.post("/api/audit/{audit_id}/terminate")
async def terminate_audit_endpoint(audit_id: str):
    session = ACTIVE_AUDIT_SESSIONS.get(audit_id)
    if session and session.status == "running":
        await session.terminate()
        return {"success": True, "message": f"Audit {audit_id} terminated."}
    return {"success": False, "message": f"Audit {audit_id} is not actively running."}
