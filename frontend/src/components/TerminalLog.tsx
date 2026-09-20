import { NavLink } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { cn } from "../lib/utils";

export interface TerminalLine {
  id: string;
  stream: "stdout" | "info" | "json" | "warning" | "error";
  text: string;
}

interface TerminalLogProps {
  logs: TerminalLine[];
  onClear?: () => void;
  onProcess?: () => void;
  isProcessing?: boolean;
  processLabel?: string;
  viewResultsUrl?: string;
  isCompleted?: boolean;
  readOnly?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
}

export default function TerminalLog({
  logs,
  onClear,
  onProcess,
  isProcessing = false,
  processLabel = "Process",
  viewResultsUrl,
  isCompleted = false,
  readOnly = false,
  title = "TERMINAL LOG",
  subtitle,
  className,
}: TerminalLogProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const terminalBodyRef = useRef<HTMLDivElement>(null);
  const fullscreenBodyRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal body to bottom without scrolling outer parent container
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (isFullscreen && fullscreenBodyRef.current) {
      fullscreenBodyRef.current.scrollTop = fullscreenBodyRef.current.scrollHeight;
    }
  }, [logs, isFullscreen]);

  const renderLogLines = () => {
    if (logs.length === 0) {
      return (
        <div className="text-slate-400 italic py-8 text-center">
          No console logs recorded yet.
        </div>
      );
    }

    return logs.map((log) => {
      let textColor = "text-slate-800";
      if (log.stream === "info") {
        textColor = "text-blue-700 font-bold";
      } else if (log.stream === "stdout") {
        textColor = "text-slate-800 font-medium";
      } else if (log.stream === "json") {
        textColor = "text-amber-900 bg-amber-50/70 rounded px-1.5 py-0.5 inline-block";
      } else if (log.stream === "warning") {
        textColor = "text-amber-700 font-semibold";
      } else if (log.stream === "error") {
        textColor = "text-rose-700 font-bold bg-rose-50/80 rounded px-1.5 py-0.5 inline-block";
      }

      return (
        <div key={log.id} className={cn("leading-relaxed break-all font-mono text-xs", textColor)}>
          {log.text}
        </div>
      );
    });
  };

  return (
    <>
      <div
        className={cn(
          "bg-white rounded-3xl border border-slate-200/90 shadow-md flex flex-col overflow-hidden",
          className
        )}
      >
        {/* Terminal Header */}
        <div className="shrink-0 pt-3 pb-2 px-8 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <i className="bi bi-terminal text-slate-700 text-sm" />
            <h2 className="text-xs font-bold tracking-wider text-slate-800 uppercase">
              {title}
            </h2>
            {subtitle && (
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-md">
                {subtitle}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {onProcess && (
              <button
                type="button"
                onClick={onProcess}
                disabled={isProcessing}
                className={cn(
                  "text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs",
                  isProcessing
                    ? "bg-blue-100 text-blue-700 cursor-not-allowed opacity-80"
                    : "bg-blue-600 hover:bg-blue-700 text-white active:scale-95"
                )}
                title={isProcessing ? "Processing in progress..." : "Run Pipeline & Audit"}
              >
                <i className={cn("bi", isProcessing ? "bi-arrow-repeat animate-spin" : "bi-play-fill text-sm")} />
                <span>{isProcessing ? "Processing..." : processLabel}</span>
              </button>
            )}

            {viewResultsUrl && (
              isCompleted ? (
                <NavLink
                  to={viewResultsUrl}
                  className="text-xs font-bold px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  title="View completed Bias Audit Report"
                >
                  <span>View Results</span>
                  <i className="bi bi-arrow-right text-xs" />
                </NavLink>
              ) : (
                <button
                  type="button"
                  disabled
                  className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed flex items-center gap-1.5 opacity-60"
                  title="View Results will unlock once audit processing finishes"
                >
                  <span>View Results</span>
                  <i className="bi bi-arrow-right text-xs" />
                </button>
              )
            )}

            {!readOnly && onClear && (
              <button
                type="button"
                onClick={onClear}
                className="text-slate-400 hover:text-red-600 text-xs transition-colors cursor-pointer p-1 rounded-md hover:bg-slate-200/60"
                title="Clear logs"
              >
                <i className="bi bi-trash" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="text-slate-500 hover:text-slate-800 text-xs transition-colors cursor-pointer p-1 rounded-md hover:bg-slate-200/60"
              title="Expand to Fullscreen"
            >
              <i className="bi bi-arrows-fullscreen" />
            </button>
          </div>
        </div>

        {/* Terminal Body (Theme White) */}
        <div ref={terminalBodyRef} className="px-8 py-5 flex-1 min-h-0 overflow-y-auto font-mono text-xs space-y-2 select-text bg-white custom-terminal-scroll">
          {renderLogLines()}
        </div>
      </div>

      {/* Fullscreen Overlay Dialog (Theme White) */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-300 shadow-2xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="shrink-0 pt-5 pb-4 px-8 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <i className="bi bi-terminal-fill text-blue-600 text-base" />
                <h2 className="text-sm font-bold tracking-wider text-slate-900 uppercase">
                  {title} - Fullscreen
                </h2>
                <span className="text-xs text-slate-500 font-mono">
                  ({logs.length} lines)
                </span>
              </div>

              <div className="flex items-center gap-3">
                {onProcess && (
                  <button
                    type="button"
                    onClick={onProcess}
                    disabled={isProcessing}
                    className={cn(
                      "text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs",
                      isProcessing
                        ? "bg-blue-100 text-blue-700 cursor-not-allowed opacity-80"
                        : "bg-blue-600 hover:bg-blue-700 text-white active:scale-95"
                    )}
                  >
                    <i className={cn("bi", isProcessing ? "bi-arrow-repeat animate-spin" : "bi-play-fill text-sm")} />
                    <span>{isProcessing ? "Processing..." : processLabel}</span>
                  </button>
                )}
                {viewResultsUrl && (
                  isCompleted ? (
                    <NavLink
                      to={viewResultsUrl}
                      className="text-xs font-bold px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <span>View Results</span>
                      <i className="bi bi-arrow-right text-xs" />
                    </NavLink>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="text-xs font-bold px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed flex items-center gap-1.5 opacity-60"
                    >
                      <span>View Results</span>
                      <i className="bi bi-arrow-right text-xs" />
                    </button>
                  )
                )}
                {!readOnly && onClear && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="text-slate-400 hover:text-red-600 text-xs transition-colors cursor-pointer px-2.5 py-1 rounded-md hover:bg-slate-100 flex items-center gap-1.5"
                  >
                    <i className="bi bi-trash" />
                    <span>Clear</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="text-slate-600 hover:text-slate-900 text-xs transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-slate-200 flex items-center gap-1"
                  title="Close Fullscreen"
                >
                  <i className="bi bi-fullscreen-exit text-sm" />
                  <span className="font-semibold text-xs">Exit Fullscreen</span>
                </button>
              </div>
            </div>

            <div ref={fullscreenBodyRef} className="px-8 py-5 flex-1 min-h-0 overflow-y-auto font-mono text-xs space-y-2.5 select-text bg-white custom-terminal-scroll">
              {renderLogLines()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
