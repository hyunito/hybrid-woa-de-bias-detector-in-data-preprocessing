import { useState, useEffect, useMemo } from "react";
import { useParams, NavLink, useNavigate } from "react-router-dom";
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
import BottomBar from "../components/BottomBar";
import { cn } from "../lib/utils";

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
  intersectional_demographics?: Record<string, any>;
}

interface ChartPoint {
  step: number;
  fitness_score: number;
  best_fitness: number;
}

export default function Results() {
  const { auditId: paramAuditId } = useParams();
  const navigate = useNavigate();

  const auditId = useMemo(() => {
    return (
      paramAuditId ||
      sessionStorage.getItem("current_audit_id") ||
      "audit-" + Math.random().toString(36).substring(2, 8)
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

  // Auto-expand visible count if user selects a finding beyond the current page
  useEffect(() => {
    if (selectedBiasIndex >= visibleBiasCount) {
      setVisibleBiasCount(Math.ceil((selectedBiasIndex + 1) / 10) * 10);
    }
  }, [selectedBiasIndex, visibleBiasCount]);

  // Strict step-completion guard: redirect back if prerequisites not met
  useEffect(() => {
    const ds = sessionStorage.getItem("scanned_dataset");
    const sc = sessionStorage.getItem("pipeline_scripts");
    const cfg = sessionStorage.getItem("audit_config");
    const res = sessionStorage.getItem("audit_results");

    let hasSc = false;
    try {
      const parsed = JSON.parse(sc || "[]");
      hasSc = Array.isArray(parsed) && parsed.length > 0;
    } catch {
      hasSc = false;
    }

    if (!ds || !hasSc) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (!cfg) {
      navigate("/configuration", { replace: true });
      return;
    }
    if (!res && !paramAuditId) {
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

      // 1. Try loading cached chart data
      try {
        const cachedChart = sessionStorage.getItem("chart_data");
        if (cachedChart) {
          const parsed = JSON.parse(cachedChart);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setChartData(parsed);
          }
        }
      } catch (e) {
        console.warn("Could not parse cached terminal logs or chart data:", e);
      }

      // 2. Try loading cached audit results
      let foundInSession = false;
      try {
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
        console.warn("Could not parse cached audit_results:", e);
      }

      // 3. If missing from session or paramAuditId specified, fetch from API
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/audit/results/${auditId}`);
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
          // If neither session nor backend has this ID
          if (isMounted) {
            setErrorMessage(`Audit report for session #${auditId} is currently unavailable.`);
          }
        }
      } catch (err: any) {
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
  }, [auditId]);

  // Selected Bias Finding
  const currentBias = rankedBiases[selectedBiasIndex] || rankedBiases[0] || null;

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

  // Download Report as JSON
  const handleDownloadReport = () => {
    const reportPayload = {
      audit_id: auditId,
      exported_at: new Date().toISOString(),
      threshold,
      total_ranked_findings: rankedBiases.length,
      qualifying_recommendations: recommendations.length,
      ranked_biases: rankedBiases,
      recommendations,
      script_rollups: scriptRollups,
      provenance_records: provenanceRecords,
      chart_points: chartData,
    };

    const blob = new Blob([JSON.stringify(reportPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proba_audit_report_${auditId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Format Delta rows
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
    <div className="flex flex-col h-full justify-between gap-6 max-w-7xl mx-auto w-full pb-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm py-5 px-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black tracking-tight text-[#0F1B2B]">
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

          <button
            type="button"
            onClick={handleDownloadReport}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <i className="bi bi-download text-xs" />
            <span>Export JSON</span>
          </button>
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
        {/* Left Card */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 shadow-md p-6 flex flex-col justify-between overflow-hidden">
          <div>
            <div className="border-b border-slate-100 pb-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                  <i className="bi bi-diagram-3-fill" />
                </div>
                <div>
                  <h2 className="text-sm font-black tracking-tight text-[#0F1B2B] uppercase">
                    TRACEABILITY LINEAGE
                  </h2>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Provenance metadata and root-cause transformation analysis
                  </span>
                </div>
              </div>

              {rankedBiases.length > 0 && (
                <span className="bg-blue-50 text-blue-700 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-blue-100">
                  Finding {selectedBiasIndex + 1} of {rankedBiases.length}
                </span>
              )}
            </div>

            {/* Subgroup Selector Pills (Top 10 + See More) */}
            {rankedBiases.length > 1 && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Discovered Bias Findings (Ranked by Bias Score):
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
                      onClick={() => setSelectedBiasIndex(idx)}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 shrink-0",
                        selectedBiasIndex === idx
                          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      <span>#{bias.rank || idx + 1}</span>
                      <span className="font-mono">({bias.fitness_score.toFixed(3)})</span>
                      <span className="text-[10px] opacity-80">{bias.transformation_name}</span>
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

            {/* Lineage Grid */}
            <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 space-y-3">
              {/* Transformation & Script */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3 border-b border-slate-200/60">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-0.5">
                    Transformation
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {currentBias?.transformation_name || matchingProvenance?.transformation_name || "N/A"}
                    </span>
                    {matchingRecommendation?.category && (
                      <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                        {matchingRecommendation.category}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-0.5">
                    Script Name
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 inline-block">
                    {currentBias?.script_name || matchingProvenance?.script_name || "N/A"}
                  </span>
                </div>
              </div>

              {/* Timestamp & Row Count Before/After */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3 border-b border-slate-200/60">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-0.5">
                    Execution Timestamp
                  </span>
                  <span className="text-xs font-mono text-slate-700">
                    {matchingProvenance?.timestamp
                      ? new Date(matchingProvenance.timestamp).toLocaleString()
                      : "2026-09-19 (Pipeline Streamed)"}
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

              {/* Highest Bias Group Breakdown */}
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

              {/* Bias Score & Privileged Group */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
                    Discovered Bias Score
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black font-mono text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1">
                      {currentBias ? currentBias.fitness_score.toFixed(4) : "0.0000"}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      (Threshold: {threshold.toFixed(2)})
                    </span>
                  </div>
                </div>
              </div>
            </div>


          </div>
        </div>

        {/* Right Card */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/90 shadow-md p-6 flex flex-col justify-between">
          <div>
            {/* Card Header */}
            <div className="border-b border-slate-100 pb-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                  <i className="bi bi-graph-up-arrow" />
                </div>
                <div>
                  <h2 className="text-sm font-black tracking-tight text-[#0F1B2B] uppercase">
                    BIAS SCORE VS. ITERATIONS
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
                        value: "Iterations / Discoveries",
                        position: "insideBottomRight",
                        offset: -5,
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
                      name="Best Envelope"
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

      {/* Separate Full-Width Card: Recommended Actions (Mitigation Strategy) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md p-6">
        <div className="border-b border-slate-100 pb-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
              <i className="bi bi-shield-check" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-[#0F1B2B] uppercase">
                RECOMMENDED ACTIONS (MITIGATION STRATEGY)
              </h2>
              <span className="text-[11px] text-slate-500 font-medium">
                Actionable mitigation recommendations and algorithm literature for {currentBias?.transformation_name || "selected finding"}
              </span>
            </div>
          </div>

          {matchingRecommendation?.category && (
            <span className="bg-emerald-50 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-emerald-200 font-mono self-start sm:self-auto">
              Strategy Category: {matchingRecommendation.category}
            </span>
          )}
        </div>

        {/* Action Items List */}
        {matchingRecommendation && matchingRecommendation.recommended_actions?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {matchingRecommendation.recommended_actions.map((action, aIdx) => (
              <div
                key={aIdx}
                className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs leading-relaxed hover:border-slate-300 transition-all"
              >
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold font-mono text-[11px] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  {aIdx + 1}
                </span>
                <p className="text-slate-700 font-medium">{action}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 rounded-2xl p-4 text-xs text-slate-500 italic mb-4">
            No automated mitigation required; disparity metrics for this transformation are within safe statistical tolerances.
          </div>
        )}

        {/* References & Citations */}
        {matchingRecommendation?.references && matchingRecommendation.references.length > 0 && (
          <div className="pt-3 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Academic Citations & Algorithmic Literature:
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {matchingRecommendation.references.map((ref, rIdx) => (
                <div
                  key={rIdx}
                  className="bg-white border border-slate-200 rounded-xl p-3 text-[11px] flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-all"
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

      {/* Bottom Bar: Action Slot (Postgres status removed) */}
      <BottomBar showDbStatus={false}>
        <div className="flex items-center justify-between w-full">
          <NavLink
            to="/dashboard"
            className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <i className="bi bi-arrow-left text-sm" />
            <span>Run New Audit</span>
          </NavLink>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadReport}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
            >
              <i className="bi bi-download" />
              <span>Download Report (JSON)</span>
            </button>
            <NavLink
              to="/history"
              className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors cursor-pointer"
            >
              <span>View Audit History</span>
              <i className="bi bi-arrow-right" />
            </NavLink>
          </div>
        </div>
      </BottomBar>
    </div>
  );
}
