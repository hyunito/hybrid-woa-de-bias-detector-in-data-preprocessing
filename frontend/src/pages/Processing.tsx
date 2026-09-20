import { useState, useEffect, useRef, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { cn } from "../lib/utils";
import { hasPrerequisitesForConfiguration, hasConfiguredAudit } from "../lib/storage";
import TerminalLog, { type TerminalLine } from "../components/TerminalLog";

interface PipelineScript {
  id: string;
  name: string;
}

interface ChartPoint {
  step: number;
  fitness_score: number;
  best_fitness: number;
}



export default function Processing() {
  const { auditId: paramAuditId } = useParams();
  const navigate = useNavigate();

  // Redirect back if preceding steps are not yet completed
  useEffect(() => {
    if (!hasPrerequisitesForConfiguration()) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (!hasConfiguredAudit()) {
      navigate("/configuration", { replace: true });
      return;
    }
  }, [navigate]);

  // Audit ID setup
  const [auditId] = useState<string>(() => {
    return (
      paramAuditId ||
      sessionStorage.getItem("current_audit_id") ||
      Math.random().toString(36).substring(2, 10)
    );
  });

  useEffect(() => {
    sessionStorage.setItem("current_audit_id", auditId);
  }, [auditId]);

  // Read arranged pipeline scripts from sessionStorage - purely dynamic, no hardcoded fallbacks
  const [pipelineScripts, setPipelineScripts] = useState<PipelineScript[]>(() => {
    try {
      const saved = sessionStorage.getItem("pipeline_scripts");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn("Failed to load pipeline_scripts:", e);
    }
    return [];
  });

  // State
  const [activeScriptIndex, setActiveScriptIndex] = useState<number>(0);
  const [currentStage, setCurrentStage] = useState<
    "ready" | "connecting" | "pipeline" | "evaluating" | "completed" | "error"
  >("ready");
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLine[]>([
    {
      id: "init",
      stream: "info",
      text: `[SYSTEM] Audit session #${auditId} ready. Click 'Process' to execute pipeline ingestion and bias search.`,
    },
  ]);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const isProcessing = currentStage === "connecting" || currentStage === "pipeline" || currentStage === "evaluating";

  // Synchronize terminal logs & chart data to sessionStorage for Results page
  useEffect(() => {
    if (terminalLogs.length > 0) {
      sessionStorage.setItem("terminal_logs", JSON.stringify(terminalLogs));
    }
  }, [terminalLogs]);

  useEffect(() => {
    if (chartData.length > 0) {
      sessionStorage.setItem("chart_data", JSON.stringify(chartData));
    }
  }, [chartData]);

  const socketRef = useRef<WebSocket | null>(null);
  const pipelineScrollRef = useRef<HTMLDivElement>(null);

  const scrollPipeline = (direction: "left" | "right") => {
    if (pipelineScrollRef.current) {
      const scrollAmount = 240;
      pipelineScrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Auto-scroll pipeline slider to follow executing step
  useEffect(() => {
    if (pipelineScrollRef.current && activeScriptIndex > 0) {
      const cardWidth = 160;
      pipelineScrollRef.current.scrollTo({
        left: Math.max(0, (activeScriptIndex - 1) * cardWidth),
        behavior: "smooth",
      });
    }
  }, [activeScriptIndex]);

  // Live Timer: runs while executing pipeline or search
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (currentStage === "pipeline" || currentStage === "evaluating") {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentStage]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };



  // Connect WebSocket
  const connectWebSocket = () => {
    setSocketError(null);
    setCurrentStage("connecting");

    const wsUrl = `ws://127.0.0.1:8000/ws/audit/${auditId}`;
    console.log("[WebSocket] Connecting to:", wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("[WebSocket] Connection established.");
        setSocketError(null);
        setCurrentStage("pipeline");
        setTerminalLogs((prev) => [
          ...prev,
          {
            id: `open-${Date.now()}`,
            stream: "info",
            text: `[WEBSOCKET] Connected to ws://127.0.0.1:8000/ws/audit/${auditId}`,
          },
        ]);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "pipeline_start") {
            setCurrentStage("pipeline");
            setActiveScriptIndex(0);
            if (msg.scripts && Array.isArray(msg.scripts)) {
              setPipelineScripts(msg.scripts);
            }
          } else if (msg.type === "script_step") {
            if (typeof msg.index === "number") {
              setActiveScriptIndex(msg.index);
            }
          } else if (msg.type === "terminal_log") {
            setTerminalLogs((prev) => [
              ...prev,
              {
                id: `${Date.now()}-${Math.random()}`,
                stream: msg.stream || "stdout",
                text: msg.text || "",
              },
            ]);
          } else if (msg.type === "pipeline_completed") {
            setActiveScriptIndex(pipelineScripts.length);
            setTerminalLogs((prev) => [
              ...prev,
              {
                id: `pip-done-${Date.now()}`,
                stream: "info",
                text: "> [PIPELINE] Data preprocessing completed and provenance records captured.",
              },
            ]);
          } else if (msg.type === "audit_start") {
            setCurrentStage("evaluating");
            setTerminalLogs((prev) => [
              ...prev,
              {
                id: `audit-start-${Date.now()}`,
                stream: "info",
                text: "> [AUDIT] Starting metaheuristic bias search...",
              },
            ]);
          } else if (msg.type === "chart_point") {
            const pt = msg.data;
            setChartData((prev) => {
              // Only record unique bias score discoveries
              if (prev.some((d) => d.fitness_score === pt.fitness_score)) {
                return prev;
              }
              return [
                ...prev,
                {
                  step: prev.length + 1,
                  fitness_score: pt.fitness_score,
                  best_fitness: pt.best_fitness,
                },
              ];
            });
          } else if (msg.type === "completed") {
            setCurrentStage("completed");
            setIsCompleted(true);
            setActiveScriptIndex(pipelineScripts.length);

            // Store full results in sessionStorage
            if (msg.results) {
              sessionStorage.setItem("audit_results", JSON.stringify(msg.results));
              window.dispatchEvent(new Event("proba_step_change"));
            }

            setTerminalLogs((prev) => [
              ...prev,
              {
                id: `done-${Date.now()}`,
                stream: "info",
                text: `[AUDIT COMPLETED] Identified ${msg.total_ranked_findings || 0} candidate subgroups, generated ${msg.qualifying_recommendations || 0} actionable mitigation recommendations.`,
              },
              {
                id: `nav-${Date.now()}`,
                stream: "info",
                text: `[SYSTEM] You may now click 'View Results ->' to inspect the full Bias Audit Report.`,
              },
            ]);
          } else if (msg.type === "error") {
            const errMsg = msg.message || "An unexpected error occurred on the backend.";
            setSocketError(errMsg);
            setCurrentStage("error");
            setTerminalLogs((prev) => [
              ...prev,
              {
                id: `err-${Date.now()}`,
                stream: "error",
                text: `> [SYSTEM ERROR] ${errMsg}`,
              },
            ]);
          }
        } catch (err) {
          console.error("[WebSocket] Failed to parse message:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("[WebSocket] Error:", err);
        const errMsg = "WebSocket connection failed or severed. Verify that backend server.py is running.";
        setSocketError(errMsg);
        setCurrentStage("error");
        setTerminalLogs((prev) => [
          ...prev,
          {
            id: `err-ws-${Date.now()}`,
            stream: "error",
            text: `> [CONNECTION ERROR] ${errMsg}`,
          },
        ]);
      };

      ws.onclose = (ev) => {
        console.log("[WebSocket] Connection closed:", ev.code, ev.reason);
        if (currentStage !== "completed" && !isCompleted) {
          setTerminalLogs((prev) => [
            ...prev,
            {
              id: `close-${Date.now()}`,
              stream: "warning",
              text: `> [WEBSOCKET] Connection closed by server (Code: ${ev.code}).`,
            },
          ]);
        }
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to initialize WebSocket client.";
      setSocketError(message);
      setCurrentStage("error");
    }
  };

  const handleStartProcess = () => {
    if (currentStage === "connecting" || currentStage === "pipeline" || currentStage === "evaluating") {
      return;
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setChartData([]);
    setActiveScriptIndex(0);
    setIsCompleted(false);
    setElapsedSeconds(0);
    setSocketError(null);
    setTerminalLogs([
      {
        id: `start-${Date.now()}`,
        stream: "info",
        text: `[SYSTEM] Initializing audit session #${auditId}... Connecting to PROBA backend WebSocket.`,
      },
    ]);
    connectWebSocket();
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  return (
    <div className="flex flex-col min-h-full justify-between gap-4 max-w-7xl mx-auto w-full pb-8">
      {/* Inline WebSocket Error Banner */}
      {socketError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 px-6 flex items-center justify-between text-rose-800 text-sm shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <i className="bi bi-exclamation-triangle-fill text-rose-600 text-lg flex-shrink-0" />
            <div>
              <p className="font-bold">Execution Notice</p>
              <p className="text-xs text-rose-700">{socketError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={connectWebSocket}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Grid: Pipeline Flow (Top Left), Live Chart (Top Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-shrink-0">
        {/* Left Card: Pipeline Flow Diagram */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md p-6 flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h2 className="text-sm font-bold tracking-tight text-[#0F1B2B] uppercase">
                  Processing Ingestion Pipeline
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  Sequentially tracking provenance metadata across scripts
                </p>
              </div>
              <div className="flex items-center gap-2">
                {pipelineScripts.length > 2 && (
                  <div className="flex items-center gap-1 bg-slate-100/90 p-0.5 rounded-full border border-slate-200">
                    <button
                      type="button"
                      onClick={() => scrollPipeline("left")}
                      className="w-6 h-6 rounded-full hover:bg-white text-slate-600 hover:text-slate-900 flex items-center justify-center text-xs transition-all cursor-pointer shadow-2xs"
                      title="Slide Left"
                    >
                      <i className="bi bi-chevron-left" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollPipeline("right")}
                      className="w-6 h-6 rounded-full hover:bg-white text-slate-600 hover:text-slate-900 flex items-center justify-center text-xs transition-all cursor-pointer shadow-2xs"
                      title="Slide Right"
                    >
                      <i className="bi bi-chevron-right" />
                    </button>
                  </div>
                )}
                <span
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    (currentStage === "pipeline" || currentStage === "connecting" || currentStage === "evaluating")
                      ? "bg-blue-100 text-blue-800 animate-pulse"
                      : isCompleted
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                  )}
                >
                  {currentStage === "pipeline"
                    ? "Processing..."
                    : currentStage === "connecting"
                      ? "Connecting..."
                      : currentStage === "evaluating"
                        ? "Evaluating..."
                        : "Ready"}
                </span>
              </div>
            </div>

            {/* Horizontal Flow Nodes with Sleek Slide Bar */}
            <div
              ref={pipelineScrollRef}
              className="py-4 px-3.5 flex items-center justify-start gap-2 overflow-x-auto select-none pipeline-slidebar min-h-[110px]"
            >
              {pipelineScripts.length === 0 ? (
                <div className="w-full py-5 flex flex-col items-center justify-center text-slate-400 text-xs gap-1.5 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <i className="bi bi-file-earmark-code text-xl text-slate-300" />
                  <span>Preparing pipeline execution...</span>
                </div>
              ) : (
                pipelineScripts.map((script, idx) => {
                  const isExecuted = isCompleted || idx < activeScriptIndex;
                  const isCurrent = currentStage === "pipeline" && idx === activeScriptIndex;
                  const isUpcoming = !isExecuted && !isCurrent;

                  return (
                    <Fragment key={script.id || idx}>
                      <div
                        className={cn(
                          "relative flex flex-col items-center justify-center p-3 rounded-2xl border min-w-[130px] max-w-[145px] transition-all flex-shrink-0 shadow-xs",
                          isExecuted && "bg-emerald-50/70 border-emerald-300 text-emerald-950",
                          isCurrent && "bg-blue-50/80 border-blue-500 shadow-md ring-2 ring-blue-400/30",
                          isUpcoming && "bg-slate-50 border-slate-200 text-slate-400"
                        )}
                      >
                        {/* Step Indicator Badge */}
                        <span
                          className={cn(
                            "absolute -top-2 -left-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs",
                            isExecuted && "bg-emerald-600 text-white",
                            isCurrent && "bg-blue-600 text-white animate-bounce",
                            isUpcoming && "bg-slate-300 text-slate-600"
                          )}
                        >
                          {idx + 1}
                        </span>

                        {/* Icon */}
                        <i
                          className={cn(
                            "bi text-2xl mb-1.5",
                            isExecuted && "bi-check-circle-fill text-emerald-600",
                            isCurrent && "bi-file-earmark-code-fill text-blue-600 animate-pulse",
                            isUpcoming && "bi-file-earmark-code text-slate-400"
                          )}
                        />

                        {/* Script Name */}
                        <span
                          className="text-[11px] font-bold text-center truncate max-w-full block"
                          title={script.name}
                        >
                          {script.name}
                        </span>

                        {/* Status Tag */}
                        <span className="text-[9px] font-semibold mt-1">
                          {isExecuted ? "Completed" : isCurrent ? "Executing..." : "Queued"}
                        </span>
                      </div>

                      {/* Connector Arrow */}
                      {idx < pipelineScripts.length - 1 && (
                        <i
                          className={cn(
                            "bi bi-arrow-right text-base flex-shrink-0",
                            isExecuted ? "text-emerald-500" : "text-slate-300"
                          )}
                        />
                      )}
                    </Fragment>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Session ID: <strong className="font-mono text-slate-800">#{auditId}</strong></span>
            <span>Chaining: <strong className="text-slate-700">Sequential Execution</strong></span>
          </div>
        </div>

        {/* Right Card: Live Convergence Chart */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md p-6 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
            <div>
              <h2 className="text-sm font-bold tracking-tight text-[#0F1B2B] uppercase">
                Convergence Monitor
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Unique bias scores tracked across evaluations
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono border transition-all shadow-xs",
                  (currentStage === "pipeline" || currentStage === "evaluating")
                    ? "bg-blue-50 border-blue-200 text-blue-800"
                    : isCompleted
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-slate-100 border-slate-200 text-slate-600"
                )}
                title="Elapsed Execution Time"
              >
                <i
                  className={cn(
                    "bi bi-stopwatch",
                    (currentStage === "pipeline" || currentStage === "evaluating") && "animate-pulse text-blue-600"
                  )}
                />
                <span>{formatTimer(elapsedSeconds)}</span>
              </div>
            </div>
          </div>

          {/* Recharts Live Line Chart - Zoomed in closer */}
          <div className="h-64 w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                <i className="bi bi-graph-up text-3xl stroke-[1.5] text-slate-300" />
                <span>
                  {currentStage === "ready"
                    ? "Click 'Process' to start search agent evaluation stream."
                    : "Waiting for search agent evaluation stream..."}
                </span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="step"
                    tick={{ fontSize: 10, fill: "#64748B" }}
                    tickLine={false}
                    axisLine={{ stroke: "#E2E8F0" }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#64748B" }}
                    tickLine={false}
                    axisLine={{ stroke: "#E2E8F0" }}
                    domain={[
                      (dataMin: number) => Math.max(0, parseFloat((dataMin - 0.05).toFixed(2))),
                      (dataMax: number) => parseFloat((dataMax + 0.05).toFixed(2))
                    ]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      border: "1px solid #334155",
                      borderRadius: "12px",
                      color: "#F8FAFC",
                      fontSize: "11px",
                    }}
                    labelFormatter={(val) => `Unique Bias #${val}`}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: "10px", paddingBottom: "4px" }}
                  />
                  <Line
                    type="monotone"
                    name="Unique Bias Score"
                    dataKey="fitness_score"
                    stroke="#0284C7"
                    strokeWidth={2}
                    dot={{ r: 3.5, strokeWidth: 1.5, fill: "#0284C7" }}
                    activeDot={{ r: 5, strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    name="Highest Bias Found"
                    dataKey="best_fitness"
                    stroke="#10B981"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Unique Scores Found: <strong className="font-mono text-slate-800">{chartData.length}</strong></span>
            <span>
              Peak Bias:{" "}
              <strong className="font-mono text-emerald-600">
                {chartData.length > 0
                  ? Math.max(...chartData.map((d) => d.fitness_score)).toFixed(4)
                  : "0.0000"}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Card: Terminal Log (Theme White) */}
      <TerminalLog
        logs={terminalLogs}
        onClear={() => setTerminalLogs([])}
        onProcess={handleStartProcess}
        isProcessing={isProcessing}
        viewResultsUrl={`/results/${auditId}`}
        isCompleted={isCompleted}
        title="TERMINAL LOG"
        subtitle="Live Execution Log"
        className="flex-1 min-h-[280px]"
      />


    </div>
  );
}
