import { useState } from "react";
import { cn } from "../lib/utils";
import BottomBar from "../components/BottomBar";

interface AuditLog {
  id: string;
  auditId: string;
  dateTime: string;
  rootCause: string;
  biasScore: number;
  isSelected: boolean;
}

const INITIAL_LOGS: AuditLog[] = [
  {
    id: "1",
    auditId: "AUD-20260522-1",
    dateTime: "2026-05-22 13:22",
    rootCause: "Missing Data",
    biasScore: 1.81,
    isSelected: true,
  },
  {
    id: "2",
    auditId: "AUD-20260602-2",
    dateTime: "2026-06-02 03:22",
    rootCause: "Remove Duplicates",
    biasScore: 1.47,
    isSelected: true,
  },
  {
    id: "3",
    auditId: "AUD-20260906-3",
    dateTime: "2026-09-06 03:22",
    rootCause: "Remove Outliers",
    biasScore: 0.9,
    isSelected: true,
  },
];

export default function History() {
  const [logs, setLogs] = useState<AuditLog[]>(INITIAL_LOGS);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

  // Selection & row actions
  const toggleSelect = (id: string) => {
    setLogs((prev) =>
      prev.map((log) => (log.id === id ? { ...log, isSelected: !log.isSelected } : log))
    );
  };

  const deleteLog = (id: string) => {
    setLogs((prev) => prev.filter((log) => log.id !== id));
  };

  // Export audit report JSON
  const downloadLog = (auditId: string) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ auditId, exportTime: new Date().toISOString() }, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${auditId}_report.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Search & filter matching
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.auditId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.rootCause.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.dateTime.includes(searchQuery);

    if (filterType === "high-bias") return matchesSearch && log.biasScore >= 1.5;
    if (filterType === "low-bias") return matchesSearch && log.biasScore < 1.5;
    return matchesSearch;
  });

  return (
    <div className="flex flex-col h-full justify-between gap-6 max-w-7xl mx-auto w-full">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md flex-1 flex flex-col justify-between overflow-hidden">
        <div className="py-5 px-8 border-b border-slate-200">
          <h1 className="text-2xl font-black tracking-tight text-[#0F1B2B]">
            LOG HISTORY
          </h1>
        </div>

        <div className="p-8 flex-1 flex flex-col justify-between gap-6">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-80 md:w-96">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="w-full bg-[#ECEEF1] border border-slate-300 rounded-full py-2.5 pl-5 pr-11 text-xs text-[#0F1B2B] placeholder:text-slate-500 focus:outline-hidden focus:border-slate-500 focus:bg-white transition-all shadow-xs"
              />
              <i className="bi bi-search absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none" />
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsFilterOpen((prev) => !prev)}
                className="border border-slate-300 bg-white rounded-xl py-2 px-4 flex items-center gap-2 text-xs font-bold text-slate-700 hover:border-slate-500 transition-colors shadow-xs cursor-pointer"
              >
                <i className="bi bi-funnel text-xs" />
                <span>Filter</span>
                <i className="bi bi-caret-down-fill text-[8px] text-slate-500" />
              </button>

              {isFilterOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-300 rounded-2xl shadow-xl z-30 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterType("all");
                      setIsFilterOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-2 text-xs font-semibold transition-colors",
                      filterType === "all" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    All Audits
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterType("high-bias");
                      setIsFilterOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-2 text-xs font-semibold transition-colors",
                      filterType === "high-bias" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    High Bias (≥ 1.5)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterType("low-bias");
                      setIsFilterOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-2 text-xs font-semibold transition-colors",
                      filterType === "low-bias" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    Low Bias (&lt; 1.5)
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="border border-slate-300/90 rounded-3xl p-6 bg-white flex-1 flex flex-col justify-start">
            <div className="grid grid-cols-12 gap-4 pb-4 border-b border-slate-300 text-xs font-bold text-slate-700 tracking-wider">
              <div className="col-span-3 pl-2 flex items-center gap-3">
                <span className="w-4" />
                <span>AUDIT ID</span>
              </div>
              <div className="col-span-3 text-center">
                TIME & DATE
              </div>
              <div className="col-span-3 text-center">
                ROOT CAUSE
              </div>
              <div className="col-span-2 text-center">
                BIAS SCORE
              </div>
              <div className="col-span-1 text-right pr-2">
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {filteredLogs.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 font-medium">
                  No historical logs found matching your search.
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="grid grid-cols-12 gap-4 py-4 items-center text-xs text-slate-700 hover:bg-slate-50/70 transition-colors rounded-xl px-2"
                  >
                    <div className="col-span-3 flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={log.isSelected}
                        onChange={() => toggleSelect(log.id)}
                        className="w-4 h-4 rounded-sm border-slate-400 text-blue-600 focus:ring-blue-500 cursor-pointer accent-slate-500"
                      />
                      <span className="font-bold text-[#0F1B2B]">
                        {log.auditId}
                      </span>
                    </div>

                    <div className="col-span-3 text-center font-medium text-slate-600">
                      {log.dateTime}
                    </div>

                    <div className="col-span-3 text-center font-medium text-slate-700">
                      {log.rootCause}
                    </div>

                    <div className="col-span-2 text-center font-bold text-slate-900">
                      {log.biasScore}
                    </div>

                    <div className="col-span-1 flex items-center justify-end gap-3 text-slate-600 pr-2">
                      <button
                        type="button"
                        onClick={() => downloadLog(log.auditId)}
                        title="Download report"
                        className="hover:text-blue-700 transition-colors cursor-pointer p-0.5"
                      >
                        <i className="bi bi-download text-sm" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLog(log.id)}
                        title="Delete entry"
                        className="hover:text-red-600 transition-colors cursor-pointer p-0.5"
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
      <BottomBar />
    </div>
  );
}
