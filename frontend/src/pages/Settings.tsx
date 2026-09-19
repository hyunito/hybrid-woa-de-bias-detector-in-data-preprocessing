import { useState } from "react";
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

const DEFAULT_SETTINGS: SettingsState = {
  dbHost: "localhost",
  dbPort: "5432",
  dbName: "bias_audit_db",
  dbUser: "postgres",
  dbPass: "password123",
  showPassword: false,

  searchingAgents: 30,
  maxIterations: 500,

  populationSize: 50,
  scaleFactor: 0.5,
  crossoverRate: 0.9,
  maxStagnationLimit: 100,

  biasThreshold: 0.8,
};

export default function Settings() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const updateField = <K extends keyof SettingsState>(field: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const handleApply = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="flex flex-col h-full justify-between gap-4 max-w-7xl mx-auto w-full">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md flex-1 flex flex-col justify-between overflow-hidden">
        <div className="py-3 border-b border-slate-200 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[#0F1B2B]">
            SETTINGS
          </h1>
        </div>

        <div className="p-4 flex-1 flex flex-col justify-between gap-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">

            <div className="border border-slate-300/90 rounded-2xl p-6 bg-white flex flex-col justify-between shadow-xs">
              <div>
                <h2 className="text-xs font-bold text-[#0F1B2B] tracking-wider pb-3 border-b border-slate-200 mb-3 uppercase">
                  DATABASE SETUP
                </h2>

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
                      placeholder="Port"
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
                      className="w-full border border-slate-300 rounded-xl py-2.5 pl-4 pr-10 text-xs font-medium text-[#0F1B2B] placeholder:text-slate-400 focus:outline-hidden focus:border-slate-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => updateField("showPassword", !settings.showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <i className={`bi ${settings.showPassword ? "bi-eye" : "bi-eye-slash"} text-sm`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-3">

              <div className="border border-slate-300/90 rounded-2xl p-5 bg-white shadow-xs">
                <h2 className="text-xs font-bold text-[#0F1B2B] tracking-wider pb-3 border-b border-slate-200 mb-2 uppercase">
                  WHALE OPTIMIZATION ALGORITHM
                </h2>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#0F1B2B]">
                      Number of Searching Agents
                    </span>
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
                    <span className="font-bold text-[#0F1B2B]">
                      Maximum Number of Iterations
                    </span>
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
                    <span className="font-bold text-[#0F1B2B]">
                      Population Size
                    </span>
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
                    <span className="font-bold text-[#0F1B2B]">
                      Scale Factor
                    </span>
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
                    <span className="font-bold text-[#0F1B2B]">
                      Crossover Rate
                    </span>
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
                    <span className="font-bold text-[#0F1B2B]">
                      Maximum Stagnation Limit
                    </span>
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
          <div className="border border-slate-300/90 rounded-2xl p-2 px-6 bg-white shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-2">
              <h2 className="text-xs font-bold text-[#0F1B2B] tracking-wider uppercase">
                BIAS THRESHOLD
              </h2>
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
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-fade-in">
              <i className="bi bi-check-circle-fill" /> Settings Applied!
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
            className="text-xs font-bold text-[#0F1B2B] bg-[#ECEEF1] hover:bg-slate-200 border border-slate-300 rounded-xl px-7 py-2 shadow-xs transition-all cursor-pointer active:scale-95"
          >
            Apply
          </button>
        </div>
      </BottomBar>
    </div>
  );
}
