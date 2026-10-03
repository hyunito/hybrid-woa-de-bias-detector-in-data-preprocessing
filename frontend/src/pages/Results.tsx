import { useState, useEffect, useMemo } from "react";
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
import { hasPrerequisitesForConfiguration } from "../lib/storage";

interface RankedBias {
  rank: number;
  fitness_score: number;
  script_name: string;
  transformation_name: string;
  demographic_group: string;
  source?: string;
  selection_rate?: number;
}

interface ReferenceItem {
  citation: string;
  url: string;
}

interface Recommendation {
  transformation_name: string;
  script_name: string;
  category: string;
  max_score: number;
  avg_score: number;
  occurrence_count: number;
  affected_groups: Array<Record<string, string> | string>;
  recommended_actions: string[];
  references: ReferenceItem[];
}

interface ScriptRollup {
  script_name: string;
  total_occurrences: number;
  max_score: number;
}

interface ProvenanceRecord {
  step?: number | null;
  script_name: string;
  transformation_name: string;
  timestamp: string;
  row_count_before: number;
  row_count_after: number;
  highest_selection_rate?: number;
  intersectional_demographics?: Record<
    string,
    {
      total_count?: number;
      selection_rate?: number;
      selection_rate_favorable_outcomes?: number;
      [key: string]: unknown;
    }
  >;
}

interface ChartPoint {
  step: number;
  fitness_score: number;
  best_fitness: number;
}

export default function Results() {
  const { auditId: paramAuditId } = useParams();
  const navigate = useNavigate();

  // Derived audit ID from URL parameter or active session storage
  const auditId = useMemo(() => {
    return (
      paramAuditId ||
      sessionStorage.getItem("current_audit_id") ||
      "current-audit"
    );
  }, [paramAuditId]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Core Results Data
  const [rankedBiases, setRankedBiases] = useState<RankedBias[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [scriptRollups, setScriptRollups] = useState<ScriptRollup[]>([]);
  const [provenanceRecords, setProvenanceRecords] = useState<ProvenanceRecord[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [threshold, setThreshold] = useState<number>(0.2);

  // UI Selection State
  const [selectedBiasIndex, setSelectedBiasIndex] = useState<number>(0);
  const [visibleBiasCount, setVisibleBiasCount] = useState<number>(10);
  const [copiedId, setCopiedId] = useState(false);
  const [activeView, setActiveView] = useState<"lineage" | "mitigation">("lineage");

  // Select finding and auto-expand page if needed
  const handleSelectBias = (index: number) => {
    setSelectedBiasIndex(index);
    if (index >= visibleBiasCount) {
      setVisibleBiasCount(Math.ceil((index + 1) / 10) * 10);
    }
  };

  // Redirect back if prerequisite data is missing (bypass when viewing historical report by paramAuditId)
  useEffect(() => {
    if (paramAuditId) {
      return;
    }
    if (!hasPrerequisitesForConfiguration()) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (!sessionStorage.getItem("audit_config")) {
      navigate("/configuration", { replace: true });
      return;
    }
    if (!sessionStorage.getItem("audit_results")) {
      navigate("/processing", { replace: true });
      return;
    }
  }, [navigate, paramAuditId]);

  // Load results from sessionStorage and fallback to backend API
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      const targetAuditId = paramAuditId || auditId;

      // 1. Check session cache only when inspecting the current session without a specific paramAuditId
      let foundInSession = false;
      if (!paramAuditId) {
        try {
          const cachedChart = sessionStorage.getItem("chart_data");
          if (cachedChart) {
            const parsed = JSON.parse(cachedChart);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setChartData(parsed);
            }
          }
          const cachedResults = sessionStorage.getItem("audit_results");
          if (cachedResults) {
            const res = JSON.parse(cachedResults);
            if (res) {
              if (Array.isArray(res.ranked_biases)) setRankedBiases(res.ranked_biases);
              if (Array.isArray(res.recommendations)) setRecommendations(res.recommendations);
              if (Array.isArray(res.script_rollups)) setScriptRollups(res.script_rollups);
              if (Array.isArray(res.provenance_records)) setProvenanceRecords(res.provenance_records);
              if (Array.isArray(res.chart_points) && res.chart_points.length > 0) {
                setChartData(res.chart_points);
              }
              if (typeof res.threshold === "number") setThreshold(res.threshold);
              foundInSession = true;
            }
          }
        } catch (e) {
          console.warn("Could not parse cached session results:", e);
        }
      }

      // 2. Fetch from backend API (always for historical audits or when missing from session)
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/results/${targetAuditId}`);
        if (response.ok) {
          const data = await response.json();
          if (isMounted && data) {
            const results = data.results || data;
            if (Array.isArray(results.ranked_biases)) setRankedBiases(results.ranked_biases);
            if (Array.isArray(results.recommendations)) setRecommendations(results.recommendations);
            if (Array.isArray(results.script_rollups)) setScriptRollups(results.script_rollups);
            if (Array.isArray(results.provenance_records)) setProvenanceRecords(results.provenance_records);
            if (Array.isArray(results.chart_points) && results.chart_points.length > 0) {
              setChartData(results.chart_points);
            }
            if (typeof data.threshold === "number") setThreshold(data.threshold);
            foundInSession = true;
          }
        } else if (!foundInSession) {
          if (isMounted) {
            setErrorMessage(`Audit report for session #${auditId} is currently unavailable.`);
          }
        }
      } catch {
        if (!foundInSession && isMounted) {
          setErrorMessage("Failed to connect to PROBA backend server. Verify that server.py is running.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [auditId, paramAuditId]);

  // Selected Bias Finding
  const currentBias = rankedBiases[selectedBiasIndex] || rankedBiases[0] || null;
  // Calculate highest fitness score found during search (even if below threshold)
  const peakDiscoveredScore = useMemo(() => {
    if (rankedBiases.length > 0) return rankedBiases[0].fitness_score;
    if (chartData.length > 0) {
      return Math.max(...chartData.map((pt) => pt.best_fitness || pt.fitness_score || 0));
    }
    return 0;
  }, [rankedBiases, chartData]);

  // Find matching Provenance Record
  const matchingProvenance = useMemo(() => {
    if (!currentBias || provenanceRecords.length === 0) {
      return provenanceRecords[0] || null;
    }
    return (
      provenanceRecords.find(
        (p) =>
          p.script_name === currentBias.script_name &&
          p.transformation_name === currentBias.transformation_name
      ) ||
      provenanceRecords.find((p) => p.script_name === currentBias.script_name) ||
      provenanceRecords[0]
    );
  }, [currentBias, provenanceRecords]);

  const matchingRecommendation = useMemo(() => {
    if (!currentBias || recommendations.length === 0) {
      return recommendations[0] || null;
    }
    return (
      recommendations.find(
        (r) =>
          r.script_name === currentBias.script_name &&
          r.transformation_name === currentBias.transformation_name
      ) ||
      recommendations.find((r) => r.script_name === currentBias.script_name) ||
      recommendations[0]
    );
  }, [currentBias, recommendations]);

  const parsedDemographics = useMemo(() => {
    if (!currentBias?.demographic_group) return [];
    const raw = currentBias.demographic_group;
    if (raw.includes("|")) {
      return raw.split("|").map((pair) => {
        const [k, v] = pair.split(":");
        return { key: k ? k.trim() : "Attribute", value: v ? v.trim() : "" };
      });
    }
    if (raw.includes(":")) {
      const [k, v] = raw.split(":");
      return [{ key: k ? k.trim() : "Attribute", value: v ? v.trim() : "" }];
    }
    return [{ key: "Subgroup", value: raw }];
  }, [currentBias]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(auditId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };



  const formatDelta = (before?: number, after?: number) => {
    if (typeof before !== "number" || typeof after !== "number") return "N/A";
    const delta = after - before;
    const pct = before > 0 ? ((delta / before) * 100).toFixed(2) : "0.00";
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta.toLocaleString()} rows (${sign}${pct}%)`;
  };

  if (isLoading && rankedBiases.length === 0 && !errorMessage) {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-7xl mx-auto w-full py-20 text-slate-500">
        <i className="bi bi-arrow-repeat animate-spin text-4xl text-blue-600 mb-3" />
        <h2 className="text-base font-bold text-slate-800 uppercase tracking-wider">
          Loading Bias Audit Report...
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Parsing provenance lineage, intersectional disparities, and mitigation techniques for #{auditId}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-start gap-3.5 max-w-7xl mx-auto w-full pb-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm py-3.5 px-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-[#0F1B2B]">
              BIAS AUDIT REPORT AND FEEDBACK
            </h1>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Audit Complete
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Post-processing intersectional bias discovery, provenance lineage, and algorithmic mitigation recommendations.
          </p>
        </div>

        {/* Audit ID Pill & Actions */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-100/90 border border-slate-200 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider font-bold">
              ID:
            </span>
            <span className="text-xs font-mono font-bold text-slate-800">
              #{auditId}
            </span>
            <button
              type="button"
              onClick={handleCopyId}
              className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer p-0.5"
              title="Copy Audit ID"
            >
              <i className={cn("bi", copiedId ? "bi-check2 text-emerald-600 font-bold" : "bi-clipboard")} />
            </button>
          </div>
        </div>
      </div>

      {/* Error or Empty State Banner */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <i className="bi bi-exclamation-triangle-fill text-rose-600 text-base" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="bg-rose-600 text-white px-3 py-1 rounded-lg font-bold hover:bg-rose-700 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      )}

      {/* Main Grid: Left Card + Right Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Stacked Card Deck with Swapping Animation */}
        <div className="lg:col-span-7 relative pt-7">
          {/* Back Card (Smaller in width and height, tucked behind front card) */}
          <div
            onClick={() => setActiveView(activeView === "lineage" ? "mitigation" : "lineage")}
            className={cn(
              "absolute inset-x-6 top-0 h-28 rounded-2xl border transition-all duration-300 cursor-pointer shadow-xs group hover:-top-1 z-0",
              activeView === "lineage"
                ? "bg-gradient-to-r from-emerald-50/90 via-teal-50/90 to-emerald-50/80 border-emerald-300/80 hover:border-emerald-400"
                : "bg-gradient-to-r from-blue-50/90 via-indigo-50/90 to-blue-50/80 border-blue-300/80 hover:border-blue-400"
            )}
          >
            {/* Peeking Header of the Back Card */}
            <div className="flex items-center justify-between px-4 pt-1.5 pb-2">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shadow-2xs",
                    activeView === "lineage"
                      ? "bg-emerald-600 text-white"
                      : "bg-blue-600 text-white"
                  )}
                >
                  <i
                    className={cn(
                      "bi",
                      activeView === "lineage" ? "bi-shield-check" : "bi-diagram-3-fill"
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] sm:text-[11px] font-bold uppercase tracking-wider",
                    activeView === "lineage" ? "text-emerald-900" : "text-blue-900"
                  )}
                >
                  {activeView === "lineage"
                    ? "RECOMMENDED ACTIONS"
                    : "AUDIT REPORT"}
                </span>
                {activeView === "lineage" && matchingRecommendation?.recommended_actions?.length ? (
                  <span className="text-[10px] font-mono font-bold bg-white text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded-full shadow-2xs">
                    {matchingRecommendation.recommended_actions.length} actions
                  </span>
                ) : null}
              </div>

            </div>
          </div>
          {/* Active Front Card (Full width, larger, casts shadow onto back card) */}
          <div className="relative z-10 bg-white rounded-3xl border border-slate-200/90 shadow-md p-6 flex flex-col justify-between overflow-hidden">
            <div>
              {/* Card Header (Spacious, with Swapped Icon Button) */}
              <div className="border-b border-slate-100 pb-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-colors shadow-2xs",
                      activeView === "lineage"
                        ? "bg-blue-50 text-blue-600 border border-blue-100"
                        : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                    )}
                  >
                    <i
                      className={cn(
                        "bi text-base",
                        activeView === "lineage" ? "bi-diagram-3-fill" : "bi-shield-check"
                      )}
                    />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold tracking-tight text-[#0F1B2B] uppercase truncate">
                      {activeView === "lineage"
                        ? "AUDIT REPORT"
                        : "RECOMMENDED ACTIONS"}
                    </h2>
                    <span className="text-[11px] text-slate-500 font-medium truncate block">
                      {activeView === "lineage"
                        ? "Provenance metadata and root-cause transformation analysis"
                        : `Mitigation recommendations for ${currentBias?.transformation_name || "selected finding"}`}
                    </span>
                  </div>
                </div>

                {/* Swapped Icon Button (Replaces dual buttons) */}
                <button
                  type="button"
                  onClick={() => setActiveView(activeView === "lineage" ? "mitigation" : "lineage")}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all cursor-pointer group shrink-0 self-start sm:self-auto"
                  title={
                    activeView === "lineage"
                      ? "Swap view to Recommended Actions"
                      : "Swap view to Audit Report"
                  }
                >
                  <div
                    className={cn(
                      "w-6 h-6 rounded-lg flex items-center justify-center transition-colors shadow-2xs",
                      activeView === "lineage"
                        ? "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white"
                        : "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
                    )}
                  >
                    <i className="bi bi-arrow-left-right transition-transform duration-300 group-hover:rotate-180" />
                  </div>
                </button>
              </div>

              {/* If 0 bias findings, show Clean Pipeline State */}
              {rankedBiases.length === 0 ? (
                <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-6 text-center flex flex-col items-center justify-center space-y-3 my-auto">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl shadow-xs">
                    <i className="bi bi-shield-check" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-emerald-950">
                      No Bias Hotspots Detected
                    </h3>
                    <p className="text-xs text-emerald-700 max-w-md mt-1 leading-relaxed">
                      All pipeline preprocessing transformations and intersectional demographic subgroups remained within your configured disparity tolerance threshold.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 w-full max-w-sm pt-2">
                    <div className="bg-white border border-emerald-200/60 rounded-xl p-3 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                        Configured Threshold
                      </span>
                      <span className="text-sm font-bold font-mono text-slate-800">
                        {threshold.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-white border border-emerald-200/60 rounded-xl p-3 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                        Peak Disparity Found
                      </span>
                      <span className="text-sm font-bold font-mono text-emerald-600">
                        {peakDiscoveredScore > 0 ? peakDiscoveredScore.toFixed(4) : "0.0000"}
                      </span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 px-3 py-1 rounded-full border border-emerald-300/60">
                    <i className="bi bi-check-circle-fill text-emerald-600 text-xs" />
                    Pipeline Certified Within Safe Tolerances
                  </span>
                </div>
              ) : (
                /* Card Swap Animated Container */
                <div key={activeView} className="animate-card-swap space-y-3.5">
                  {activeView === "lineage" ? (
                    /* ================= SIDE A: TRACEABILITY LINEAGE ================= */
                    <div className="space-y-3.5">
                      {/* Subgroup Selector Pills (Top 10 + See More) */}
                      {rankedBiases.length > 1 && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Discovered Bias Findings (Ranked by Disparity):
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              Showing {Math.min(visibleBiasCount, rankedBiases.length)} of {rankedBiases.length}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-terminal-scroll pipeline-slidebar">
                            {rankedBiases.slice(0, visibleBiasCount).map((bias, idx) => (
                              <button
                                key={`${bias.script_name}-${bias.transformation_name}-${idx}`}
                                type="button"
                                onClick={() => handleSelectBias(idx)}
                                className={cn(
                                  "text-xs px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 shrink-0",
                                  selectedBiasIndex === idx
                                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                )}
                              >
                                <span>#{bias.rank || idx + 1}</span>
                                <span className="font-mono">({bias.fitness_score.toFixed(3)})</span>
                                <span className="text-[10px] opacity-80 truncate max-w-[120px]">{bias.transformation_name}</span>
                              </button>
                            ))}

                            {/* See More (+10) Button */}
                            {visibleBiasCount < rankedBiases.length && (
                              <button
                                type="button"
                                onClick={() => setVisibleBiasCount((prev) => Math.min(prev + 10, rankedBiases.length))}
                                className="text-xs px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer border border-dashed border-blue-300 bg-blue-50/80 text-blue-700 hover:bg-blue-100 flex items-center gap-1.5 shrink-0 shadow-2xs"
                                title="Load next 10 findings"
                              >
                                <i className="bi bi-plus-circle text-xs" />
                                <span>See More (+10)</span>
                              </button>
                            )}

                            {/* Show Top 10 Button */}
                            {visibleBiasCount > 10 && (
                              <button
                                type="button"
                                onClick={() => setVisibleBiasCount(10)}
                                className="text-xs px-2.5 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 flex items-center gap-1 shrink-0"
                                title="Collapse to top 10"
                              >
                                <span>Show Top 10</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Script Name & Transformation (Both Clean White Backgrounds) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Script Name Card */}
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                              Pipeline Script
                            </span>
                            {matchingProvenance?.step != null && (
                              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md">
                                Step #{matchingProvenance.step}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="font-mono text-sm sm:text-base font-extrabold text-slate-900 tracking-tight break-all block mt-1" title={currentBias?.script_name}>
                              {currentBias?.script_name || "N/A"}
                            </span>
                            <span className="text-[11px] text-slate-400 mt-1 block font-medium">
                              Source pipeline file where disparity originated
                            </span>
                          </div>
                        </div>

                        {/* Transformation Card */}
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                              Root-Cause Transformation
                            </span>
                            <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                              Operation
                            </span>
                          </div>
                          <div>
                            <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight block mt-1" title={currentBias?.transformation_name}>
                              {currentBias?.transformation_name || "N/A"}
                            </span>
                            <span className="text-[11px] text-slate-400 mt-1 block font-medium">
                              Disparity-inducing preprocessing step
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Secondary Provenance Metadata Container */}
                      <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 space-y-3">
                        {/* Timestamp & Row Count Before/After */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3 border-b border-slate-200/60">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-0.5">
                              Execution Timestamp
                            </span>
                            <span className="text-xs font-mono text-slate-700">
                              {matchingProvenance?.timestamp
                                ? new Date(matchingProvenance.timestamp).toLocaleString()
                                : "Pipeline Streamed"}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-0.5">
                              Row Count Before / After
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-slate-800 font-bold">
                                {matchingProvenance?.row_count_before?.toLocaleString() || "N/A"}
                              </span>
                              <i className="bi bi-arrow-right text-[10px] text-slate-400" />
                              <span className="text-xs font-mono text-slate-800 font-bold">
                                {matchingProvenance?.row_count_after?.toLocaleString() || "N/A"}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.2">
                                {formatDelta(matchingProvenance?.row_count_before, matchingProvenance?.row_count_after)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Highest Bias Subgroup Breakdown */}
                        <div className="pb-3 border-b border-slate-200/60">
                          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1.5">
                            Highest Bias Subgroup Breakdown
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            {parsedDemographics.map((demo, dIdx) => (
                              <div
                                key={`${demo.key}-${dIdx}`}
                                className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs flex items-center gap-1.5 shadow-2xs"
                              >
                                <span className="text-slate-400 font-medium text-[11px]">{demo.key}:</span>
                                <strong className="text-slate-900 font-bold">{demo.value}</strong>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Bias Score & Tolerance (No bottom button) */}
                        <div className="pt-1">
                          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
                            Discovered Bias Score
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black font-mono text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1">
                              {currentBias.fitness_score.toFixed(4)}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              (Threshold: {threshold.toFixed(2)})
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ================= SIDE B: RECOMMENDED ACTIONS (MITIGATION STRATEGY) ================= */
                    <div className="space-y-3.5">
                      {/* Mitigation Target Overview Banner */}
                      <div className="bg-gradient-to-br from-emerald-50/90 to-teal-50/70 border border-emerald-200/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider block mb-0.5">
                            Targeted Mitigation For Operation
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-slate-900">
                              {currentBias?.transformation_name || "N/A"}
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                              {currentBias?.script_name || "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Items List */}
                      <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
                          Recommended Algorithmic Actions:
                        </span>
                        {matchingRecommendation && matchingRecommendation.recommended_actions?.length > 0 ? (
                          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 custom-terminal-scroll">
                            {matchingRecommendation.recommended_actions.map((action, aIdx) => (
                              <div
                                key={aIdx}
                                className="bg-white border border-slate-200/90 rounded-xl p-3 flex items-start gap-2.5 text-xs leading-relaxed hover:border-slate-300 transition-all shadow-2xs"
                              >
                                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                                  {aIdx + 1}
                                </span>
                                <p className="text-slate-700 font-medium">{action}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-white rounded-xl p-4 text-xs text-slate-500 italic border border-slate-200">
                            No automated mitigation required; disparity metrics for this transformation are within safe statistical tolerances.
                          </div>
                        )}
                      </div>

                      {/* References & Citations */}
                      {matchingRecommendation?.references && matchingRecommendation.references.length > 0 && (
                        <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                            Academic Citations & Algorithmic Literature:
                          </span>
                          <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 custom-terminal-scroll">
                            {matchingRecommendation.references.map((ref, rIdx) => (
                              <div
                                key={rIdx}
                                className="bg-white border border-slate-200 rounded-xl p-2.5 text-[11px] flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-all"
                              >
                                <span className="text-slate-700 font-medium line-clamp-2">
                                  [{rIdx + 1}] {ref.citation}
                                </span>
                                {ref.url && (
                                  <a
                                    href={ref.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:text-blue-800 font-bold shrink-0 flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                                  >
                                    <span>Paper</span>
                                    <i className="bi bi-box-arrow-up-right text-[10px]" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: BIAS SCORES */}
        <div className="lg:col-span-5 pt-1">
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md p-6 flex flex-col justify-between h-full">

            {/* Card Header */}
            <div className="border-b border-slate-100 pb-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                  <i className="bi bi-graph-up-arrow" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-tight text-[#0F1B2B] uppercase">
                    BIAS SCORES
                  </h2>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Convergence trajectory and search fitness evaluation
                  </span>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="h-64 w-full mb-4">
              {chartData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                  <i className="bi bi-graph-up text-3xl text-slate-300" />
                  <span>No search evaluation points logged.</span>
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
                      label={{
                        value: "Unique Bias Score",
                        position: "insideBottomRight",
                        offset: -3,
                        fontSize: 9,
                        fill: "#94A3B8",
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#64748B" }}
                      tickLine={false}
                      axisLine={{ stroke: "#E2E8F0" }}
                      domain={[
                        (dataMin: number) => Math.max(0, parseFloat((dataMin - 0.05).toFixed(2))),
                        (dataMax: number) => parseFloat((dataMax + 0.05).toFixed(2)),
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
                      labelFormatter={(val) => `Evaluation #${val}`}
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
                      dot={{ r: 3, strokeWidth: 1, fill: "#0284C7" }}
                      activeDot={{ r: 4.5, strokeWidth: 1.5 }}
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

            {/* Root-Cause Summary */}
            {scriptRollups.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Pipeline Script Rollup:
                </span>
                <div className="space-y-1.5">
                  {scriptRollups.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-200/60"
                    >
                      <span className="font-mono text-slate-800 font-medium truncate max-w-[180px]">
                        {s.script_name}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-500">
                          {s.total_occurrences} occurrence{s.total_occurrences > 1 ? "s" : ""}
                        </span>
                        <span className="font-mono font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/60 text-[11px]">
                          Max: {s.max_score.toFixed(3)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}