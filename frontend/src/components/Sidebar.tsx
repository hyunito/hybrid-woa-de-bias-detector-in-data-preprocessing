import { useState, useEffect, useCallback } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";

// =========================================================================
// SUB-STEPS CONFIGURATION (Audit Configuration, Processing Monitor, Results)
// =========================================================================
const STEPS = [
  {
    path: "/configuration",
    key: "configuration" as const,
    label: "Audit Configuration",
    icon: "bi bi-pencil-fill text-lg",
  },
  {
    path: "/processing",
    key: "processing" as const,
    label: "Processing Monitor",
    icon: "bi bi-tv text-xl",
  },
  {
    path: "/results",
    key: "results" as const,
    label: "Results",
    icon: "bi bi-clipboard-check-fill text-xl",
  },
];

// =========================================================================
// BOTTOM NAVIGATION CONFIGURATION (Log History, Settings)
// =========================================================================
const BOTTOM_NAV = [
  {
    path: "/history",
    label: "Log History",
    icon: "bi bi-folder-fill text-lg",
  },
  {
    path: "/settings",
    label: "Settings",
    icon: "bi bi-gear-fill text-lg",
  },
];

export default function Sidebar() {
  const location = useLocation();
  const isDashboardActive = location.pathname.startsWith("/dashboard");

  const [unlocked, setUnlocked] = useState({
    configuration: false,
    processing: false,
    results: false,
  });

  const checkUnlocked = useCallback(() => {
    try {
      // Step 1 check: Dataset + Pipeline scripts uploaded
      const dataset = sessionStorage.getItem("scanned_dataset");
      const rawScripts = sessionStorage.getItem("pipeline_scripts");
      let hasScripts = false;
      try {
        const parsed = JSON.parse(rawScripts || "[]");
        hasScripts = Array.isArray(parsed) && parsed.length > 0;
      } catch {
        hasScripts = false;
      }
      const configUnlocked = !!dataset && hasScripts;

      // Step 2 check: Audit configuration saved
      const auditConfig = sessionStorage.getItem("audit_config");
      const processingUnlocked = configUnlocked && !!auditConfig;

      // Step 3 check: Audit executed & completed
      const auditResults = sessionStorage.getItem("audit_results");
      const resultsUnlocked = processingUnlocked && !!auditResults;

      setUnlocked({
        configuration: configUnlocked,
        processing: processingUnlocked,
        results: resultsUnlocked,
      });
    } catch {
      setUnlocked({
        configuration: false,
        processing: false,
        results: false,
      });
    }
  }, []);

  useEffect(() => {
    checkUnlocked();
    const handleStepChange = () => checkUnlocked();
    window.addEventListener("proba_step_change", handleStepChange);
    window.addEventListener("storage", handleStepChange);
    return () => {
      window.removeEventListener("proba_step_change", handleStepChange);
      window.removeEventListener("storage", handleStepChange);
    };
  }, [location.pathname, checkUnlocked]);

  return (
    <aside className="w-64 bg-white border-r border-slate-300 flex flex-col justify-between h-screen sticky top-0 select-none shadow-sm">
      <div>
        <div className="bg-[#ECEEF1] border-b border-slate-300 py-5 px-5 flex items-center justify-center gap-3">
          <img
            src="/icons/proba-logo.svg"
            alt="PROBA Logo"
            className="w-12 h-12 object-contain flex-shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = "none";
            }}
          />
          <div>
            <span className="text-3xl font-bold tracking-wider text-[#0F1B2B] block">
              PROBA
            </span>
            <span className="text-[10px] font-medium text-slate-400 tracking-tight block">
              Provenance-based Bias Auditor
            </span>
          </div>
        </div>

        {/* Navigation Area */}
        <div className="pt-8 pb-6 px-6">
          {/* Pipeline Ingestion (Always accessible) */}
          <NavLink
            to="/dashboard"
            className={cn(
              "flex items-center group cursor-pointer py-1.5 px-2 -mx-2 rounded-lg transition-colors",
              isDashboardActive ? "bg-slate-200/60" : "hover:bg-slate-100/80"
            )}
          >
            <div className="w-10 h-10 rounded-full border-2 border-[#1E293B] bg-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <img
                src="/icons/pipeline-ingestion.svg"
                alt="Pipeline Ingestion"
                className="w-5 h-5 object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
            </div>

            <span
              className={cn(
                "ml-3.5 text-[15px] font-bold transition-colors leading-snug",
                isDashboardActive
                  ? "text-[#0F1B2B] font-bold"
                  : "text-[#1E293B] group-hover:text-[#0F1B2B]"
              )}
            >
              Pipeline Ingestion
            </span>
          </NavLink>

          <nav className="relative mt-8">
            {/* Vertical Tree Connector Line */}
            <div className="absolute left-[18px] -top-10 bottom-[19px] w-[2px] bg-[#64748B]" />

            <div className="space-y-10">
              {STEPS.map((step) => {
                const isUnlocked = unlocked[step.key];
                const isActive = location.pathname.startsWith(step.path);

                if (!isUnlocked) {
                  return (
                    <div
                      key={step.path}
                      className="flex items-center group relative cursor-default select-none pointer-events-none"
                    >
                      {/* Horizontal Branch Line */}
                      <div className="absolute left-[18px] w-4 h-[2px] bg-[#64748B] -z-0" />

                      {/* Inner Pill: icon visible, text 50% opacity, no lock icon, no cursor-not-allowed */}
                      <div className="ml-8 flex items-center py-1.5 px-3 rounded-lg">
                        <div className="flex items-center justify-center text-[#1E293B]">
                          <i className={cn(step.icon)} />
                        </div>
                        <span className="ml-3 text-[12px] text-[#1E293B] opacity-50 leading-snug whitespace-nowrap">
                          {step.label}
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <NavLink
                    key={step.path}
                    to={step.path}
                    className="flex items-center group relative cursor-pointer"
                  >
                    {/* Horizontal Branch Line */}
                    <div className="absolute left-[18px] w-4 h-[2px] bg-[#64748B] -z-0" />

                    {/* Inner Hover Pill */}
                    <div
                      className={cn(
                        "ml-8 flex items-center py-1.5 px-3 rounded-lg transition-all duration-150",
                        isActive
                          ? "bg-slate-200/60 shadow-xs"
                          : "hover:bg-slate-100/80 group-hover:bg-slate-100/80"
                      )}
                    >
                      <div className="flex items-center justify-center text-[#1E293B] group-hover:text-[#0F1B2B] transition-colors">
                        <i className={cn(step.icon, isActive && "text-[#0F1B2B]")} />
                      </div>

                      <span
                        className={cn(
                          "ml-3 text-[12px] transition-colors leading-snug whitespace-nowrap",
                          isActive
                            ? "text-[#0F1B2B] font-semibold"
                            : "text-[#1E293B] group-hover:text-[#0F1B2B]"
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                  </NavLink>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      {/* BOTTOM SECTION (Log History & Settings) */}
      <div className="border-t border-slate-300">
        {BOTTOM_NAV.map((item) => {
          const isHistory = item.path === "/history";

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3.5 px-6 py-4 bg-[#ECEEF1] text-sm font-semibold transition-colors",
                  isHistory && "border-b border-slate-300",
                  isActive
                    ? "bg-[#DFE3E8] text-[#0F1B2B] font-bold"
                    : "text-[#1E293B] hover:bg-[#D4DAE2] hover:text-[#0F1B2B]"
                )
              }
            >
              <i className={cn(item.icon, "text-[#1E293B]")} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </aside>
  );
}
