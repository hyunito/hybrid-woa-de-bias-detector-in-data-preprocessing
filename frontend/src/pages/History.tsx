import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import BottomBar from "../components/BottomBar";

interface AuditLog {
  id: string;
  auditId: string;
  dateTime: string;
  rootCause: string;
  biasScore: number;
  totalFindings?: number;
  isSelected?: boolean;
}

export default function History() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"highest-bias" | "lowest-bias" | "newest" | "oldest">("highest-bias");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Initial mount data load
  useEffect(() => {
    let isMounted = true;

    async function loadInitialHistory() {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/history");
        if (response.ok) {
          const data: AuditLog[] = await response.json();
          if (isMounted) {
            setLogs(Array.isArray(data) ? data : []);
          }
        } else if (isMounted) {
          setErrorMessage("Failed to load historical audits from server.");
        }
      } catch {
        if (isMounted) {
          setErrorMessage("Could not connect to PROBA backend server. Verify that server.py is running.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  // Manual refresh handler triggered by user click
  const handleRefresh = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/history");
      if (response.ok) {
        const data: AuditLog[] = await response.json();
        setLogs(Array.isArray(data) ? data : []);
      } else {
        setErrorMessage("Failed to load historical audits from server.");
      }
    } catch {
      setErrorMessage("Could not connect to PROBA backend server. Verify that server.py is running.");
    } finally {
      setIsLoading(false);
    }
  };

  // Selection & row actions
  const toggleSelect = (id: string) => {
    setLogs((prev) =>
      prev.map((log) => (log.id === id ? { ...log, isSelected: !log.isSelected } : log))
    );
  };

  const toggleSelectAll = () => {
    const allSelected = logs.length > 0 && logs.every((l) => l.isSelected);
    setLogs((prev) => prev.map((log) => ({ ...log, isSelected: !allSelected })));
  };

  const selectedCount = logs.filter((l) => l.isSelected).length;

  // Delete a single audit record
  const deleteLog = async (auditId: string) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/history/${auditId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setLogs((prev) => prev.filter((log) => log.auditId !== auditId && log.id !== auditId));
      } else {
        console.error("Failed to delete audit record:", auditId);
      }
    } catch (e) {
      console.error("Network error deleting audit record:", e);
    }
  };

  // Delete all selected audits
  const deleteSelected = async () => {
    const selectedLogs = logs.filter((l) => l.isSelected);
    for (const log of selectedLogs) {
      await deleteLog(log.auditId);
    }
  };

  // Export full audit report JSON from storage
  const downloadLog = async (auditId: string) => {
    setDownloadingId(auditId);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/results/${auditId}`);
      if (res.ok) {
        const fullReport = await res.json();
        const dataStr =
          "data:text/json;charset=utf-8," +
          encodeURIComponent(JSON.stringify(fullReport, null, 2));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `${auditId}_report.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      } else {
        // Fallback to exporting summary if full report not found
        const summary = logs.find((l) => l.auditId === auditId);
        const dataStr =
          "data:text/json;charset=utf-8," +
          encodeURIComponent(JSON.stringify(summary || { auditId }, null, 2));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `${auditId}_summary.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      }
    } catch (err) {
      console.error("Error downloading audit report:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  // Navigate to results report for a specific audit
  const viewReport = (auditId: string) => {
    navigate(`/results/${auditId}`);
  };

  // Search & sorting (by bias score or date)
  const filteredLogs = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const matched = logs.filter((log) => {
      return (
        log.auditId.toLowerCase().includes(query) ||
        log.rootCause.toLowerCase().includes(query) ||
        log.dateTime.includes(query)
      );
    });

    return matched.sort((a, b) => {
      if (sortBy === "highest-bias") {
        return b.biasScore - a.biasScore;
      }
      if (sortBy === "lowest-bias") {
        return a.biasScore - b.biasScore;
      }
      if (sortBy === "oldest") {
        return a.dateTime.localeCompare(b.dateTime);
      }
      // default: newest date first
      return b.dateTime.localeCompare(a.dateTime);
    });
  }, [logs, searchQuery, sortBy]);

  return (
    <div className="flex flex-col h-full justify-between gap-6 max-w-7xl mx-auto w-full">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md flex-1 flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="py-5 px-8 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0F1B2B]">
              LOG HISTORY
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical bias audit reports stored in persistent storage
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
              {logs.length} {logs.length === 1 ? "Audit" : "Audits"} Recorded
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              title="Refresh audit history"
              className="text-slate-500 hover:text-slate-800 p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <i className={cn("bi bi-arrow-clockwise text-sm", isLoading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Body Container */}
        <div className="p-8 flex-1 flex flex-col justify-between gap-6 overflow-y-auto">
          {/* Controls Bar: Search & Filter */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="relative w-80 md:w-96">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Audit ID, Root Cause, or Date..."
                className="w-full bg-[#ECEEF1] border border-slate-300 rounded-full py-2.5 pl-5 pr-11 text-xs text-[#0F1B2B] placeholder:text-slate-500 focus:outline-hidden focus:border-slate-500 focus:bg-white transition-all shadow-xs"
              />
              <i className="bi bi-search absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none" />
            </div>

            <div className="flex items-center gap-3">
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={deleteSelected}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <i className="bi bi-trash text-xs" />
                  <span>Delete Selected ({selectedCount})</span>
                </button>
              )}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSortOpen((prev) => !prev)}
                  className="border border-slate-300 bg-white rounded-xl py-2 px-4 flex items-center gap-2 text-xs font-bold text-slate-700 hover:border-slate-500 transition-colors shadow-xs cursor-pointer"
                  title="Sort by bias score or date"
                >
                  <i className="bi bi-arrow-down-up text-xs text-slate-600" />
                  <span>
                    {sortBy === "highest-bias"
                      ? "Highest Bias"
                      : sortBy === "lowest-bias"
                        ? "Lowest Bias"
                        : sortBy === "newest"
                          ? "Newest First"
                          : "Oldest First"}
                  </span>
                  <i className="bi bi-caret-down-fill text-[8px] text-slate-500" />
                </button>

                {isSortOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-300 rounded-2xl shadow-xl z-30 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSortBy("highest-bias");
                        setIsSortOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-between",
                        sortBy === "highest-bias" ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <span>Highest Bias</span>
                      {sortBy === "highest-bias" && <i className="bi bi-check2 text-sm text-blue-700" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSortBy("lowest-bias");
                        setIsSortOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-between",
                        sortBy === "lowest-bias" ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <span>Lowest Bias</span>
                      {sortBy === "lowest-bias" && <i className="bi bi-check2 text-sm text-blue-700" />}
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setSortBy("newest");
                        setIsSortOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-between",
                        sortBy === "newest" ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <span>Newest First</span>
                      {sortBy === "newest" && <i className="bi bi-check2 text-sm text-blue-700" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSortBy("oldest");
                        setIsSortOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-between",
                        sortBy === "oldest" ? "bg-blue-50 text-blue-700 font-bold" : "text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <span>Oldest First</span>
                      {sortBy === "oldest" && <i className="bi bi-check2 text-sm text-blue-700" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="border border-slate-300/90 rounded-3xl p-6 bg-white flex-1 flex flex-col justify-start overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 pb-4 border-b border-slate-300 text-xs font-bold text-slate-700 tracking-wider">
              <div className="col-span-3 pl-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={logs.length > 0 && logs.every((l) => l.isSelected)}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded-sm border-slate-400 text-blue-600 focus:ring-blue-500 cursor-pointer accent-slate-500"
                  title="Select all"
                />
                <span>AUDIT ID</span>
              </div>
              <div className="col-span-3 text-center">
                TIME & DATE
              </div>
              <div className="col-span-3 text-center">
                ROOT CAUSE
              </div>
              <button
                type="button"
                onClick={() => setSortBy((prev) => (prev === "highest-bias" ? "lowest-bias" : "highest-bias"))}
                className="col-span-2 text-center flex items-center justify-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors"
                title="Click to toggle sort by bias score"
              >
                <span>BIAS SCORE</span>
                <i
                  className={cn(
                    "bi text-[10px]",
                    sortBy === "highest-bias"
                      ? "bi-arrow-down text-blue-600 font-bold"
                      : sortBy === "lowest-bias"
                        ? "bi-arrow-up text-blue-600 font-bold"
                        : "bi-arrow-down-up text-slate-400"
                  )}
                />
              </button>
              <div className="col-span-1 text-right pr-2">
                ACTIONS
              </div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-slate-200 overflow-y-auto max-h-[460px]">
              {isLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500 text-xs">
                  <i className="bi bi-arrow-repeat animate-spin text-2xl text-blue-600" />
                  <span>Loading audit records from storage...</span>
                </div>
              ) : errorMessage ? (
                <div className="py-16 text-center text-xs text-rose-500 font-medium">
                  {errorMessage}
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs font-medium">
                  <i className="bi bi-clock-history text-3xl text-slate-300" />
                  <span>
                    {logs.length === 0
                      ? "No past audits recorded yet. Completed audits will be saved in storage/audits and displayed here."
                      : "No historical logs found matching your search or filter."}
                  </span>
                  {logs.length === 0 && (
                    <button
                      type="button"
                      onClick={() => navigate("/dashboard")}
                      className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                    >
                      Start a Bias Audit on Dashboard
                    </button>
                  )}
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id || log.auditId}
                    className="grid grid-cols-12 gap-4 py-4 items-center text-xs text-slate-700 hover:bg-slate-50/70 transition-colors rounded-xl px-2"
                  >
                    {/* Checkbox & Clickable Audit ID */}
                    <div className="col-span-3 flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(log.isSelected)}
                        onChange={() => toggleSelect(log.id)}
                        className="w-4 h-4 rounded-sm border-slate-400 text-blue-600 focus:ring-blue-500 cursor-pointer accent-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => viewReport(log.auditId)}
                        title="Click to view full Bias Audit Report"
                        className="font-bold text-[#0F1B2B] hover:text-blue-600 transition-colors cursor-pointer text-left flex items-center gap-1.5 group"
                      >
                        <span>{log.auditId}</span>
                        <i className="bi bi-arrow-up-right text-[10px] opacity-0 group-hover:opacity-100 transition-opacity text-blue-600" />
                      </button>
                    </div>

                    {/* Date & Time */}
                    <div className="col-span-3 text-center font-medium text-slate-600 font-mono text-[11px]">
                      {log.dateTime}
                    </div>

                    {/* Root Cause */}
                    <div className="col-span-3 text-center font-medium text-slate-700">
                      <span className="bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded-md text-[11px]">
                        {log.rootCause}
                      </span>
                    </div>

                    {/* Bias Score */}
                    <div className="col-span-2 text-center">
                      <span
                        className={cn(
                          "font-bold font-mono px-2.5 py-0.5 rounded-full text-xs inline-block"
                        )}
                      >
                        {Number(log.biasScore).toFixed(4)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 flex items-center justify-end gap-2.5 text-slate-600 pr-2">
                      <button
                        type="button"
                        onClick={() => viewReport(log.auditId)}
                        title="Inspect full results report"
                        className="hover:text-blue-600 transition-colors cursor-pointer p-1 rounded-md hover:bg-slate-100"
                      >
                        <i className="bi bi-eye text-sm" />
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadLog(log.auditId)}
                        disabled={downloadingId === log.auditId}
                        title="Download audit report JSON"
                        className="hover:text-blue-700 transition-colors cursor-pointer p-1 rounded-md hover:bg-slate-100"
                      >
                        <i className={cn("bi", downloadingId === log.auditId ? "bi-arrow-repeat animate-spin text-blue-600" : "bi-download text-sm")} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLog(log.auditId)}
                        title="Delete audit from storage"
                        className="hover:text-red-600 transition-colors cursor-pointer p-1 rounded-md hover:bg-slate-100"
                      >
                        <i className="bi bi-trash3 text-sm" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <BottomBar>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem("current_audit_id");
              sessionStorage.removeItem("audit_results");
              navigate("/dashboard");
            }}
            className="text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <i className="bi bi-plus-circle text-sm text-blue-600" />
            <span>New Bias Audit</span>
          </button>
        </div>
      </BottomBar>
    </div>
  );
}
