import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import BottomBar from "../components/BottomBar";

interface SettingsState {
  dbHost: string;
  dbPort: string;
  dbName: string;
  dbUser: string;
  dbPass: string;
  showPassword: boolean;

  searchingAgents: number;
  maxIterations: number;

  populationSize: number;
  scaleFactor: number;
  crossoverRate: number;
  maxStagnationLimit: number;

  biasThreshold: number;
}

const DEFAULT_ALGO_SETTINGS = {
  searchingAgents: 30,
  maxIterations: 30,
  populationSize: 30,
  scaleFactor: 0.5,
  crossoverRate: 0.7,
  maxStagnationLimit: 25,
  biasThreshold: 0.2,
};

interface ParamLabelProps {
  label: string;
  tooltip: string;
}

function ParamLabel({ label, tooltip }: ParamLabelProps) {
  return (
    <div className="relative group flex items-center gap-1.5 cursor-help select-none">
      <span className="font-bold text-[#0F1B2B] group-hover:text-blue-600 transition-colors">
        {label}
      </span>
      <i className="bi bi-info-circle text-[11px] text-slate-400 group-hover:text-blue-600 transition-colors" />

      {/* Floating Tooltip Bubble */}
      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex flex-col z-50 w-64 p-2.5 bg-[#0F1B2B] text-white text-[11px] leading-relaxed rounded-xl shadow-xl pointer-events-none transition-all">
        <span>{tooltip}</span>
        {/* Subtle arrow pointer pointing down */}
        <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-[#0F1B2B]" />
      </div>
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SettingsState>({
    dbHost: "",
    dbPort: "5432",
    dbName: "",
    dbUser: "",
    dbPass: "",
    showPassword: false,
    ...DEFAULT_ALGO_SETTINGS,
  });

  const [isLoadingDb, setIsLoadingDb] = useState(true);
  const [isDbConnected, setIsDbConnected] = useState<boolean | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [restartSuccess, setRestartSuccess] = useState(false);

  // Load database configuration from backend .env
  useEffect(() => {
    let isMounted = true;
    const fetchDbSettings = async () => {
      setIsLoadingDb(true);
      try {
        const res = await fetch("http://127.0.0.1:8000/api/settings/database");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setSettings((prev) => ({
              ...prev,
              dbHost: data.db_host ?? "",
              dbPort: data.db_port ? String(data.db_port) : "5432",
              dbName: data.db_name ?? "",
              dbUser: data.db_user ?? "",
              dbPass: data.db_password ?? "",
            }));
            setIsDbConnected(Boolean(data.is_connected));
            setDbError(data.connection_error || null);
          }
        } else {
          if (isMounted) {
            setIsDbConnected(false);
            setDbError("Unable to retrieve database configuration.");
          }
        }

        const algoRes = await fetch("http://127.0.0.1:8000/api/settings/algorithm");
        if (algoRes.ok) {
          const algoData = await algoRes.json();
          if (isMounted) {
            setSettings((prev) => ({
              ...prev,
              searchingAgents: Number(algoData.searchingAgents ?? 30),
              maxIterations: Number(algoData.maxIterations ?? 30),
              populationSize: Number(algoData.populationSize ?? 30),
              scaleFactor: Number(algoData.scaleFactor ?? 0.5),
              crossoverRate: Number(algoData.crossoverRate ?? 0.7),
              maxStagnationLimit: Number(algoData.maxStagnationLimit ?? 25),
              biasThreshold: Number(algoData.biasThreshold ?? 0.2),
            }));
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setIsDbConnected(false);
          setDbError(err.message || "Failed to reach backend server.");
        }
      } finally {
        if (isMounted) setIsLoadingDb(false);
      }
    };

    fetchDbSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const updateField = <K extends keyof SettingsState>(field: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleReset = async () => {
    setSettings((prev) => ({
      ...prev,
      ...DEFAULT_ALGO_SETTINGS,
    }));
    try {
      const res = await fetch("http://127.0.0.1:8000/api/settings/database");
      if (res.ok) {
        const data = await res.json();
        setSettings((prev) => ({
          ...prev,
          dbHost: data.db_host ?? "",
          dbPort: data.db_port ? String(data.db_port) : "5432",
          dbName: data.db_name ?? "",
          dbUser: data.db_user ?? "",
          dbPass: data.db_password ?? "",
        }));
        setIsDbConnected(Boolean(data.is_connected));
        setDbError(data.connection_error || null);
      }
    } catch {
      // ignore
    }
  };

  const handleRestartSession = async () => {
    const confirmed = window.confirm(
      "Restart session and clean up all data?\n\nThis will permanently delete all uploaded datasets and pipeline scripts on the server, clear all browser storage and audit cache, and reset the workflow back to Pipeline Ingestion."
    );
    if (!confirmed) return;

    setIsRestarting(true);
    try {
      await fetch("http://127.0.0.1:8000/api/session/reset", {
        method: "POST",
      });
    } catch (err) {
      console.warn("Backend session reset request failed:", err);
    }

    // Clear all browser storage caches
    sessionStorage.clear();
    localStorage.removeItem("proba_session_id");
    localStorage.removeItem("pipeline_scripts");
    localStorage.removeItem("dataset_filename");
    localStorage.removeItem("audit_results");
    localStorage.removeItem("terminal_logs");
    localStorage.removeItem("chart_data");

    // Re-evaluate navigation lock guards across Sidebar and wizard steps
    window.dispatchEvent(new Event("proba_step_change"));

    setIsRestarting(false);
    setRestartSuccess(true);

    setTimeout(() => {
      navigate("/");
    }, 1200);
  };

  const handleApply = async () => {
    setIsSavingDb(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/settings/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          db_name: settings.dbName,
          db_user: settings.dbUser,
          db_password: settings.dbPass,
          db_host: settings.dbHost,
          db_port: settings.dbPort,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsDbConnected(Boolean(data.is_connected));
        setDbError(data.connection_error || null);
        window.dispatchEvent(new Event("proba_db_status_change"));
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      } else {
        setIsDbConnected(false);
        setDbError("Failed to save database settings.");
      }

      const algoRes = await fetch("http://127.0.0.1:8000/api/settings/algorithm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchingAgents: Number(settings.searchingAgents),
          maxIterations: Number(settings.maxIterations),
          populationSize: Number(settings.populationSize),
          scaleFactor: Number(settings.scaleFactor),
          crossoverRate: Number(settings.crossoverRate),
          maxStagnationLimit: Number(settings.maxStagnationLimit),
          biasThreshold: Number(settings.biasThreshold),
        }),
      });
      if (algoRes.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      } else {
        const errData = await algoRes.json();
        alert(`Failed to save algorithm settings: ${errData.detail || "Validation error"}`);
      }

    } catch (err: any) {
      setIsDbConnected(false);
      setDbError(err.message || "Failed to reach backend server.");
    } finally {
      setIsSavingDb(false);
    }
  };

  return (
    <div className="flex flex-col h-full justify-between gap-4 max-w-7xl mx-auto w-full">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md flex-1 flex flex-col justify-between overflow-hidden">
        <div className="py-3 px-8 border-b border-slate-200 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-[#0F1B2B]">
            SETTINGS
          </h1>
          <button
            type="button"
            onClick={handleRestartSession}
            disabled={isRestarting}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200/90 rounded-xl px-4 py-2 shadow-xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            title="Clean up all cache and delete uploaded datasets and scripts"
          >
            <i className={`bi ${isRestarting ? "bi-arrow-repeat animate-spin" : "bi-arrow-counterclockwise"}`} />
            <span>{isRestarting ? "Restarting..." : "Restart Session"}</span>
          </button>
        </div>

        <div className="p-4 flex-1 flex flex-col justify-between gap-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">

            <div className="border border-slate-300/90 rounded-2xl p-6 bg-white flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                  <h2 className="text-xs font-bold text-[#0F1B2B] tracking-wider uppercase">
                    DATABASE SETUP
                  </h2>
                </div>
                <div className="space-y-2">
                  <div>
                    <input
                      type="text"
                      value={settings.dbHost}
                      onChange={(e) => updateField("dbHost", e.target.value)}
                      placeholder="Host/IP Address"
                      className="w-full border border-slate-300 rounded-xl py-2.5 px-4 text-xs font-medium text-[#0F1B2B] placeholder:text-slate-400 focus:outline-hidden focus:border-slate-500 transition-colors"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      value={settings.dbPort}
                      onChange={(e) => updateField("dbPort", e.target.value)}
                      placeholder="Port Number"
                      className="w-full border border-slate-300 rounded-xl py-2.5 px-4 text-xs font-medium text-[#0F1B2B] placeholder:text-slate-400 focus:outline-hidden focus:border-slate-500 transition-colors"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      value={settings.dbName}
                      onChange={(e) => updateField("dbName", e.target.value)}
                      placeholder="Database Name"
                      className="w-full border border-slate-300 rounded-xl py-2.5 px-4 text-xs font-medium text-[#0F1B2B] placeholder:text-slate-400 focus:outline-hidden focus:border-slate-500 transition-colors"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      value={settings.dbUser}
                      onChange={(e) => updateField("dbUser", e.target.value)}
                      placeholder="Username"
                      className="w-full border border-slate-300 rounded-xl py-2.5 px-4 text-xs font-medium text-[#0F1B2B] placeholder:text-slate-400 focus:outline-hidden focus:border-slate-500 transition-colors"
                    />
                  </div>

                  <div className="relative">
                    <input
                      type={settings.showPassword ? "text" : "password"}
                      value={settings.dbPass}
                      onChange={(e) => updateField("dbPass", e.target.value)}
                      placeholder="Password"
                      className="w-full border border-slate-300 rounded-xl py-2.5 px-4 text-xs font-medium text-[#0F1B2B] placeholder:text-slate-400 focus:outline-hidden focus:border-slate-500 transition-colors pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => updateField("showPassword", !settings.showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-hidden cursor-pointer"
                    >
                      <i className={`bi ${settings.showPassword ? "bi-eye-slash-fill" : "bi-eye-fill"}`} />
                    </button>
                  </div>
                </div>

                {dbError && !isDbConnected && !isLoadingDb && (
                  <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 flex items-start gap-2">
                    <i className="bi bi-exclamation-triangle-fill text-rose-500 mt-0.5 shrink-0" />
                    <span className="break-all">{dbError}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between gap-3">

              <div className="border border-slate-300/90 rounded-2xl p-5 bg-white shadow-xs">
                <h2 className="text-xs font-bold text-[#0F1B2B] tracking-wider pb-3 border-b border-slate-200 mb-2 uppercase">
                  WHALE OPTIMIZATION ALGORITHM
                </h2>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <ParamLabel
                      label="Number of Searching Agents"
                      tooltip="The number of search agents exploring different combinations in the dataset to detect bias."
                    />
                    <div className="flex items-center border border-slate-300 rounded-lg px-2 py-1 bg-white">
                      <input
                        type="number"
                        min="5"
                        max="200"
                        value={settings.searchingAgents}
                        onChange={(e) => updateField("searchingAgents", Number(e.target.value))}
                        className="w-12 text-right font-semibold text-[#0F1B2B] focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <ParamLabel
                      label="Maximum Number of Iterations"
                      tooltip="The maximum number of search cycles the algorithm will run before stopping."
                    />
                    <div className="flex items-center border border-slate-300 rounded-lg px-2 py-1 bg-white">
                      <input
                        type="number"
                        min="10"
                        max="5000"
                        value={settings.maxIterations}
                        onChange={(e) => updateField("maxIterations", Number(e.target.value))}
                        className="w-12 text-right font-semibold text-[#0F1B2B] focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-slate-300/90 rounded-2xl p-5 bg-white shadow-xs">
                <h2 className="text-xs font-bold text-[#0F1B2B] tracking-wider pb-3 border-b border-slate-200 mb-2 uppercase">
                  DIFFERENTIAL EVOLUTION
                </h2>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <ParamLabel
                      label="Population Size"
                      tooltip="The total number of candidate bias patterns tracked and refined during the search."
                    />

                    <div className="flex items-center border border-slate-300 rounded-lg px-2 py-1 bg-white">
                      <input
                        type="number"
                        min="10"
                        max="200"
                        value={settings.populationSize}
                        onChange={(e) => updateField("populationSize", Number(e.target.value))}
                        className="w-12 text-right font-semibold text-[#0F1B2B] focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <ParamLabel
                      label="Scale Factor"
                      tooltip="Controls how aggressively the search explores new, untested demographic combinations."
                    />

                    <div className="flex items-center border border-slate-300 rounded-lg px-2 py-1 bg-white">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="2.0"
                        value={settings.scaleFactor}
                        onChange={(e) => updateField("scaleFactor", Number(e.target.value))}
                        className="w-12 text-right font-semibold text-[#0F1B2B] focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <ParamLabel
                      label="Crossover Rate"
                      tooltip="The probability of combining characteristics from two candidate groups to discover intersectional bias."
                    />
                    <div className="flex items-center border border-slate-300 rounded-lg px-2 py-1 bg-white">
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={settings.crossoverRate}
                        onChange={(e) => updateField("crossoverRate", Number(e.target.value))}
                        className="w-12 text-right font-semibold text-[#0F1B2B] focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <ParamLabel
                      label="Maximum Stagnation Limit"
                      tooltip="The number of rounds with no new findings before the algorithm resets to avoid getting stuck."
                    />
                    <div className="flex items-center border border-slate-300 rounded-lg px-2 py-1 bg-white">
                      <input
                        type="number"
                        min="5"
                        max="1000"
                        value={settings.maxStagnationLimit}
                        onChange={(e) => updateField("maxStagnationLimit", Number(e.target.value))}
                        className="w-12 text-right font-semibold text-[#0F1B2B] focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
          <div className="border border-slate-300/90 rounded-2xl p-3 px-6 bg-white shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <ParamLabel
                label="BIAS THESHOLD"
                tooltip="The disparity tolerance level above which a demographic group is officially flagged as biased."
              />
              <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                {settings.biasThreshold.toFixed(2)}
              </span>
            </div>

            <div className="py-1 px-2">
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={settings.biasThreshold}
                onChange={(e) => updateField("biasThreshold", Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-hidden"
              />
              <div className="flex justify-between text-[11px] font-bold text-slate-700 mt-2">
                <span>0</span>
                <span className="text-slate-400 font-normal">0.5</span>
                <span className="text-slate-400 font-normal">1.0</span>
                <span className="text-slate-400 font-normal">1.5</span>
                <span>2</span>
              </div>
            </div>
          </div>

        </div>
      </div>
      <BottomBar>
        <div className="flex items-center gap-3">
          {restartSuccess && (
            <span className="text-xs font-bold text-rose-600 flex items-center gap-1 animate-fade-in">
              <i className="bi bi-check-circle-fill" /> Session Reset. Redirecting...
            </span>
          )}

          {saveSuccess && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-fade-in">
              <i className="bi bi-check-circle-fill" /> Saved
            </span>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-bold text-slate-700 hover:text-[#0F1B2B] transition-colors cursor-pointer px-2 py-1.5"
          >
            Reset to Default
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isSavingDb}
            className="text-xs font-bold text-[#0F1B2B] bg-[#ECEEF1] hover:bg-slate-200 border border-slate-300 rounded-xl px-7 py-2 shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSavingDb && <i className="bi bi-arrow-repeat animate-spin text-xs" />}
            <span>{isSavingDb ? "Saving..." : "Apply"}</span>
          </button>
        </div>
      </BottomBar>
    </div>
  );
}
