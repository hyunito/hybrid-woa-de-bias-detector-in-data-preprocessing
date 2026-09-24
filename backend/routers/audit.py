import os
import sys
import json
import time
import asyncio
import subprocess
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from config import PIPELINE_DIR, BACKEND_DIR
from engine.audit import get_fitness_score
from engine.hybrid_woa import WOAAuditor
from routers.result import save_audit_result

router = APIRouter(tags=["Audit"])

@router.websocket("/ws/audit/{audit_id}")
async def audit_websocket(websocket: WebSocket, audit_id: str):
    """
    WebSocket endpoint handling end-to-end audit execution:
    1. Runs pipeline transformations in a Windows-safe subprocess while streaming logs and step events.
    2. Collects and parses generated provenance_metadata.json.
    3. Runs hybrid WOA-DE metaheuristic search and streams real-time unique candidate points.
    4. Compiles final ranked bias findings and actionable mitigation recommendations.
    """
    await websocket.accept()
    print(f"[WebSocket] Client connected for audit: {audit_id}")

    active_process = None

    try:
        
        config_path = os.path.join(PIPELINE_DIR, "tracker_config.json")
        pipeline_scripts = []

        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                saved_cfg = json.load(f)
                pipeline_scripts = saved_cfg.get("pipeline_scripts", [])

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

        loop = asyncio.get_running_loop()
        executed_step_indices = set()
        current_script_idx = 0

        for exec_idx, script_info in enumerate(pipeline_scripts):
            
            if exec_idx in executed_step_indices and exec_idx > 0:
                continue

            script_name = script_info["name"]
            script_path = os.path.join(PIPELINE_DIR, script_name)

            if not os.path.exists(script_path):
                err_msg = f"Configured script file '{script_name}' was not found on server."
                await websocket.send_json({
                    "type": "terminal_log",
                    "stream": "error",
                    "text": f"> [PROBA ERROR] {err_msg}"
                })
                await websocket.send_json({
                    "type": "error",
                    "message": err_msg
                })
                return

            rel_path = os.path.relpath(script_path, BACKEND_DIR)
            await websocket.send_json({
                "type": "terminal_log",
                "stream": "info",
                "text": f"> Executing pipeline script from disk ({rel_path})"
            })

            # Announce active script step
            current_script_idx = exec_idx
            executed_step_indices.add(exec_idx)
            await websocket.send_json({
                "type": "script_step",
                "index": exec_idx,
                "name": script_name
            })

            # Subprocess runner with unbuffered live line streaming and stdin disconnected
            output_queue = asyncio.Queue()
            pipeline_dir = os.path.dirname(script_path)
            env = {
                **os.environ,
                "PYTHONUNBUFFERED": "1",
                "PYTHONPATH": f"{pipeline_dir};{PIPELINE_DIR};{BACKEND_DIR};" + os.environ.get("PYTHONPATH", "")
            }

            def run_single_process(target_script):
                nonlocal active_process
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
                    active_process = proc
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
                    active_process = None

            subp_task = asyncio.create_task(asyncio.to_thread(run_single_process, script_path))
            proc_start_time = time.time()
            last_output_time = time.time()

            while not subp_task.done() or not output_queue.empty():
                try:
                    line = await asyncio.wait_for(output_queue.get(), timeout=1.0)
                    last_output_time = time.time()

                    # Dynamic step detection for chained and modular script execution
                    if "> [PROBA_STEP] " in line:
                        active_script_name = line.split("> [PROBA_STEP] ")[-1].strip()
                        for p_idx, p_script in enumerate(pipeline_scripts):
                            if p_script.get("name") == active_script_name:
                                if p_idx != current_script_idx:
                                    current_script_idx = p_idx
                                    executed_step_indices.add(p_idx)
                                    await websocket.send_json({
                                        "type": "script_step",
                                        "index": current_script_idx,
                                        "name": active_script_name
                                    })
                                break

                    await websocket.send_json({
                        "type": "terminal_log",
                        "stream": "stdout",
                        "text": line
                    })
                except asyncio.TimeoutError:
                    # If process is running without log output for > 4 seconds, pulse progress heartbeat
                    if not subp_task.done() and (time.time() - last_output_time > 4.0):
                        elapsed_s = int(time.time() - proc_start_time)
                        active_name = pipeline_scripts[current_script_idx]["name"] if current_script_idx < len(pipeline_scripts) else script_name
                        await websocket.send_json({
                            "type": "terminal_log",
                            "stream": "info",
                            "text": f"> [PROBA] Executing {active_name}... ({elapsed_s}s elapsed)"
                        })
                        last_output_time = time.time()

            returncode = await subp_task

            if returncode != 0:
                err_text = f"Pipeline script '{script_name}' failed with return code {returncode}."
                await websocket.send_json({
                    "type": "terminal_log",
                    "stream": "error",
                    "text": f"> [PROBA ERROR] {err_text}"
                })
                await websocket.send_json({
                    "type": "error",
                    "message": err_text
                })
                return

        await websocket.send_json({
            "type": "pipeline_completed"
        })
        await websocket.send_json({
            "type": "terminal_log",
            "stream": "info",
            "text": "> Pipeline preprocessing completed"
        })
        found_prov = os.path.join(BACKEND_DIR, "storage", "provenance_metadata.json")
        
        # Check for Provenance Metadata JSON exported by the executed script(s)
        if not found_prov:
            err_msg = "No provenance_metadata.json was generated. Ensure your preprocessing functions are tracked with @tracker.track."
            await websocket.send_json({
                "type": "terminal_log",
                "stream": "error",
                "text": f"> [PROBA ERROR] {err_msg}"
            })
            await websocket.send_json({
                "type": "error",
                "message": err_msg
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
        await asyncio.sleep(0.5)

        # Phase 2: WOA-DE Hybrid Search
        await websocket.send_json({
            "type": "audit_start",
            "message": "Starting PROBA..."
        })

        auditor = WOAAuditor(metadata_logs=prov_records, num_whales=20, max_iter=10)

        point_queue = asyncio.Queue()

        def stream_point(pt):
            loop.call_soon_threadsafe(point_queue.put_nowait, pt)

        # Run auditor in background thread
        search_task = asyncio.create_task(asyncio.to_thread(auditor.run_woa, callback=stream_point))

        seen_bias_scores = set()
        step_counter = 0
        chart_points_history = []
        while not search_task.done() or not point_queue.empty():
            try:
                pt = await asyncio.wait_for(point_queue.get(), timeout=0.05)
                score = round(float(pt.get("fitness_score", 0.0)), 4)
                # Only stream when a new, unique bias score is found
                if score > 0.0 and score not in seen_bias_scores:
                    seen_bias_scores.add(score)
                    step_counter += 1
                    point_data = {
                        "step": step_counter,
                        "fitness_score": score,
                        "best_fitness": round(float(pt.get("best_fitness", score)), 4)
                    }
                    chart_points_history.append(point_data)
                    await websocket.send_json({
                        "type": "chart_point",
                        "data": point_data
                    })
                    # Visual progression delay so user can observe the convergence curve plotting live
                    await asyncio.sleep(0.045)
            except asyncio.TimeoutError:
                pass

        await search_task
        # Pause briefly to allow user to inspect final convergence curve before results finalize
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

        threshold = 0.2
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

        # Hand off findings to Results domain to compile mitigation strategies and persist
        final_record = save_audit_result(audit_id, raw_results, threshold)

        # Notify Processing.tsx that audit execution has completed
        await websocket.send_json({
            "type": "completed",
            "audit_id": audit_id,
            "total_ranked_findings": final_record["total_ranked_findings"],
            "qualifying_recommendations": final_record["qualifying_recommendations"],
            "results": final_record["results"]
        })

        print(f"[WebSocket] Audit {audit_id} fully completed and emitted.")

    except WebSocketDisconnect:
        print(f"[WebSocket] Client disconnected: {audit_id}")
        if active_process and active_process.poll() is None:
            print(f"[WebSocket] Terminating orphaned subprocess PID {active_process.pid} for {audit_id}")
            try:
                active_process.terminate()
            except Exception:
                pass
    except Exception as e:
        import traceback
        traceback.print_exc()
        err_msg = str(e).strip() or f"{type(e).__name__}: An unexpected error occurred during execution."
        print(f"[WebSocket] Error during audit streaming: {err_msg}")
        try:
            await websocket.send_json({
                "type": "terminal_log",
                "stream": "error",
                "text": f"> [SYSTEM ERROR] {err_msg}"
            })
            await websocket.send_json({
                "type": "error",
                "message": err_msg
            })
        except Exception:
            pass
    finally:
        if active_process and active_process.poll() is None:
            try:
                active_process.terminate()
            except Exception:
                pass
