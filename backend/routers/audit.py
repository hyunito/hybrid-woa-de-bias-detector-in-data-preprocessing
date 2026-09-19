import os
import sys
import json
import time
import asyncio
import subprocess
from typing import Dict, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException

from core.config import PIPELINE_DIR, PROJECT_ROOT, BACKEND_DIR
from engine.audit import get_fitness_score
from engine.feedback import generate_mitigation_report

router = APIRouter(tags=["Audit"])

ACTIVE_AUDIT_RESULTS: Dict[str, dict] = {}


def build_script_matchers(pipeline_scripts: list) -> list:
    """
    Dynamically generates detection patterns for any arbitrary number of uploaded scripts (1, 2, 5, 10+).
    Matches ordinal indicators ('step 1', 'step 5', 'step five', '[1/5]'), file stems ('clean_nulls', 'impute'),
    and explicit script filenames.
    """
    word_numbers = [
        "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
        "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
        "eighteen", "nineteen", "twenty"
    ]

    total_scripts = len(pipeline_scripts)
    matchers = []

    for idx, script in enumerate(pipeline_scripts):
        s_name = script.get("name", "").strip().lower()
        stem = os.path.splitext(s_name)[0].lower()
        stem_spaced = stem.replace("_", " ").replace("-", " ")

        patterns = set()

        # 1. Exact file name and stem
        if s_name:
            patterns.add(s_name)
        if stem:
            patterns.add(stem)
            patterns.add(stem_spaced)

        # 2. Ordinal number variants (step 1, step_1, step1, step #1, [1/5], [1])
        step_num = idx + 1
        patterns.add(f"step {step_num}")
        patterns.add(f"step_{step_num}")
        patterns.add(f"step-{step_num}")
        patterns.add(f"step{step_num}")
        patterns.add(f"step #{step_num}")
        patterns.add(f"step: {step_num}")
        patterns.add(f"[{step_num}/{total_scripts}]")
        patterns.add(f"[{step_num}]")
        patterns.add(f"stage {step_num}")
        patterns.add(f"stage_{step_num}")

        # 3. Word form numbers (step one, step two, ... step five, etc.)
        if idx < len(word_numbers):
            word = word_numbers[idx]
            patterns.add(f"step {word}")
            patterns.add(f"step_{word}")
            patterns.add(f"stage {word}")

        matchers.append({
            "index": idx,
            "name": script.get("name", ""),
            "patterns": sorted(list(patterns), key=len, reverse=True)
        })

    return matchers


def detect_script_step(line_lower: str, matchers: list, current_idx: int) -> int:
    """
    Checks if a stdout line signals a transition to any configured pipeline step.
    Returns the new step index if detected, or current_idx.
    """
    for matcher in matchers:
        for pattern in matcher["patterns"]:
            if pattern in line_lower:
                return matcher["index"]
    return current_idx


def is_pipeline_chained(first_script_path: str, pipeline_scripts: list) -> bool:
    """
    Checks if the entry script imports or references any subsequent uploaded scripts.
    If so, running the entry script will orchestrate all stages in a single process.
    If not, each script in pipeline_scripts is an independent script to run in order.
    """
    if len(pipeline_scripts) <= 1:
        return True
    if not os.path.exists(first_script_path):
        return False
    try:
        with open(first_script_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read().lower()
        for s in pipeline_scripts[1:]:
            s_name = s.get("name", "").lower()
            stem = os.path.splitext(s_name)[0].lower()
            if stem in content:
                return True
    except Exception:
        pass
    return False


@router.get("/api/audit/results/{audit_id}")
def get_audit_results(audit_id: str):
    """Retrieves completed audit findings, provenance lineage, recommendations, and chart points."""
    if audit_id in ACTIVE_AUDIT_RESULTS:
        return ACTIVE_AUDIT_RESULTS[audit_id]
    raise HTTPException(status_code=404, detail="Audit results not found")


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
        # 1. Read pipeline configuration
        config_path = os.path.join(PIPELINE_DIR, "tracker_config.json")
        pipeline_scripts = []

        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                saved_cfg = json.load(f)
                pipeline_scripts = saved_cfg.get("pipeline_scripts", [])

        # Strict check: Never run without configured scripts
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
        matchers = build_script_matchers(pipeline_scripts)
        first_script_name = pipeline_scripts[0]["name"]
        first_script_path = os.path.join(PIPELINE_DIR, first_script_name)

        await websocket.send_json({
            "type": "pipeline_start",
            "scripts": pipeline_scripts,
            "active_script": first_script_name
        })

        chained = is_pipeline_chained(first_script_path, pipeline_scripts)
        scripts_to_execute = [pipeline_scripts[0]] if chained else pipeline_scripts

        loop = asyncio.get_running_loop()

        for exec_idx, script_info in enumerate(scripts_to_execute):
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

            rel_path = os.path.relpath(script_path, PROJECT_ROOT)
            await websocket.send_json({
                "type": "terminal_log",
                "stream": "info",
                "text": f"> Executing pipeline script from disk ({rel_path})"
            })

            # Initial step indicator for this script
            current_script_idx = exec_idx
            await websocket.send_json({
                "type": "script_step",
                "index": current_script_idx,
                "name": script_name
            })

            # Subprocess runner with unbuffered live line streaming and stdin disconnected
            output_queue = asyncio.Queue()
            pipeline_dir = os.path.dirname(script_path)
            env = {
                **os.environ,
                "PYTHONUNBUFFERED": "1",
                "PYTHONPATH": f"{pipeline_dir};{PIPELINE_DIR};{PROJECT_ROOT};{BACKEND_DIR};" + os.environ.get("PYTHONPATH", "")
            }

            def run_single_process(target_script):
                nonlocal active_process
                try:
                    proc = subprocess.Popen(
                        [sys.executable, "-u", target_script],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        stdin=subprocess.DEVNULL,  # Prevent blocking on stdin
                        cwd=PROJECT_ROOT,
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
                    line_lower = line.lower()

                    # Dynamic step detection across all configured scripts
                    new_idx = detect_script_step(line_lower, matchers, current_script_idx)
                    if new_idx != current_script_idx and new_idx < len(pipeline_scripts):
                        current_script_idx = new_idx
                        await websocket.send_json({
                            "type": "script_step",
                            "index": current_script_idx,
                            "name": pipeline_scripts[current_script_idx]["name"]
                        })

                    await websocket.send_json({
                        "type": "terminal_log",
                        "stream": "stdout",
                        "text": line
                    })
                except asyncio.TimeoutError:
                    # If process is running without log output for > 4 seconds, pulse progress heartbeat
                    if not subp_task.done() and (time.time() - last_output_time > 4.0):
                        elapsed_s = int(time.time() - proc_start_time)
                        await websocket.send_json({
                            "type": "terminal_log",
                            "stream": "info",
                            "text": f"> [PROBA] Processing dataset transformation... ({elapsed_s}s elapsed)"
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
            "type": "terminal_log",
            "stream": "info",
            "text": "> Pipeline preprocessing completed (Exit Code: 0)"
        })

        # Check for Provenance Metadata JSON exported by the executed script(s)
        prov_paths = [
            os.path.join(PROJECT_ROOT, "provenance_metadata.json"),
            os.path.join(BACKEND_DIR, "provenance_metadata.json"),
            os.path.join(PIPELINE_DIR, "provenance_metadata.json")
        ]
        found_prov = None
        for p in prov_paths:
            if os.path.exists(p):
                found_prov = p
                break

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

        # Small pause before search
        await asyncio.sleep(0.5)

        # Phase 2: WOA-DE Hybrid Search
        await websocket.send_json({
            "type": "audit_start",
            "message": "Starting Metaheuristic Bias Scouting & Exploitation..."
        })

        import hybrid_woa
        auditor = hybrid_woa.WOAAuditor(num_whales=20, max_iter=10)

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
            except asyncio.TimeoutError:
                pass

        await search_task

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
                "script_rollups": script_rollups,
                "provenance_records": prov_records,
                "chart_points": chart_points_history
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
