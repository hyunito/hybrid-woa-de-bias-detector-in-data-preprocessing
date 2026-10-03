import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import { hasUploadedDataset, hasConfiguredScripts, hasConfiguredAudit } from "../lib/storage";

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

function getUnlockedStatus() {
  const configUnlocked = hasUploadedDataset() && hasConfiguredScripts();
  const processingUnlocked = configUnlocked && hasConfiguredAudit();
  const resultsUnlocked = processingUnlocked && Boolean(sessionStorage.getItem("audit_results"));
  return {
    configuration: configUnlocked,
    processing: processingUnlocked,
    results: resultsUnlocked,
  };
}

export default function Sidebar() {
  const location = useLocation();
  const isDashboardActive = location.pathname.startsWith("/dashboard");

  const [unlocked, setUnlocked] = useState(getUnlockedStatus);

  // Collapsed state persisted in localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("sidebar_collapsed") === "true";
  });

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    const handleStepChange = () => setUnlocked(getUnlockedStatus());
    window.addEventListener("proba_step_change", handleStepChange);
    window.addEventListener("storage", handleStepChange);
    return () => {
      window.removeEventListener("proba_step_change", handleStepChange);
      window.removeEventListener("storage", handleStepChange);
    };
  }, []);

  return (
    <aside
      className={cn(
        "bg-white border-r border-slate-300 flex flex-col justify-between h-screen sticky top-0 select-none shadow-sm transition-all duration-300 ease-in-out z-20 flex-shrink-0",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      <div>
        {/* Top Header with Logo & 3-line Collapse Toggle */}
        <div
          className={cn(
            "bg-[#ECEEF1] border-b border-slate-300 py-4 px-3 flex items-center h-[82px] transition-all",
            isCollapsed ? "justify-center" : "justify-between"
          )}
        >
          {!isCollapsed && (
            <NavLink
              to="/welcome"
              className="flex items-center gap-3 overflow-hidden text-left pl-2 group"
            >
              <img
                src="/icons/proba-logo.svg"
                alt="PROBA Logo"
                className="w-10 h-10 object-contain flex-shrink-0 group-hover:scale-105 transition-transform"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
              <div>
                <span className="text-2xl font-bold tracking-wider text-[#0F1B2B] block leading-none">
                  PROBA
                </span>
                <span className="text-[9px] font-medium text-slate-400 tracking-tight block mt-1 whitespace-nowrap">
                  Provenance Bias Auditor
                </span>
              </div>
            </NavLink>
          )}

          {/* 3-Line Hamburger Toggle Button */}
          <button
            type="button"
            onClick={toggleSidebar}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="p-2 rounded-xl text-slate-600 hover:text-[#0F1B2B] hover:bg-slate-200/80 transition-colors cursor-pointer flex items-center justify-center flex-shrink-0"
          >
            <i className="bi bi-list text-2xl leading-none" />
          </button>
        </div>

        {/* Navigation Area */}
        <div className={cn("pt-6 pb-6 transition-all", isCollapsed ? "px-2" : "px-6")}>
          {/* Pipeline Ingestion (Always accessible) */}
          <NavLink
            to="/dashboard"
            title={isCollapsed ? "Pipeline Ingestion" : undefined}
            className={cn(
              "flex items-center group cursor-pointer py-1.5 rounded-lg transition-colors",
              isCollapsed ? "justify-center px-0" : "px-2 -mx-2",
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

            {!isCollapsed && (
              <span
                className={cn(
                  "ml-3.5 text-[15px] font-bold transition-colors leading-snug whitespace-nowrap",
                  isDashboardActive
                    ? "text-[#0F1B2B]"
                    : "text-[#1E293B] group-hover:text-[#0F1B2B]"
                )}
              >
                Pipeline Ingestion
              </span>
            )}
          </NavLink>

          <nav className={cn("relative transition-all", isCollapsed ? "mt-6" : "mt-8")}>
            {/* Vertical Tree Connector Line (expanded only) */}
            {!isCollapsed && (
              <div className="absolute left-[18px] -top-10 bottom-[19px] w-[2px] bg-[#64748B]" />
            )}

            <div className={cn("space-y-6 transition-all", !isCollapsed && "space-y-10")}>
              {STEPS.map((step) => {
                const isUnlocked = unlocked[step.key];
                const isActive = location.pathname.startsWith(step.path);

                if (!isUnlocked) {
                  return (
                    <div
                      key={step.path}
                      title={isCollapsed ? `${step.label} (Locked)` : undefined}
                      className={cn(
                        "flex items-center group relative cursor-default select-none pointer-events-none",
                        isCollapsed ? "justify-center" : ""
                      )}
                    >
                      {!isCollapsed && (
                        <div className="absolute left-[18px] w-4 h-[2px] bg-[#64748B] -z-0" />
                      )}
                      <div
                        className={cn(
                          "flex items-center rounded-lg opacity-40",
                          isCollapsed ? "w-10 h-10 justify-center" : "ml-8 py-1.5 px-3"
                        )}
                      >
                        <div className="flex items-center justify-center text-[#1E293B]">
                          <i className={cn(step.icon)} />
                        </div>
                        {!isCollapsed && (
                          <span className="ml-3 text-[12px] text-[#1E293B] leading-snug whitespace-nowrap">
                            {step.label}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <NavLink
                    key={step.path}
                    to={step.path}
                    title={isCollapsed ? step.label : undefined}
                    className={cn(
                      "flex items-center group relative cursor-pointer",
                      isCollapsed ? "justify-center" : ""
                    )}
                  >
                    {!isCollapsed && (
                      <div className="absolute left-[18px] w-4 h-[2px] bg-[#64748B] -z-0" />
                    )}

                    <div
                      className={cn(
                        "flex items-center rounded-lg transition-all duration-150",
                        isCollapsed
                          ? "w-10 h-10 justify-center"
                          : "ml-8 py-1.5 px-3",
                        isActive
                          ? "bg-slate-200/80 shadow-xs"
                          : "hover:bg-slate-100/80 group-hover:bg-slate-100/80"
                      )}
                    >
                      <div className="flex items-center justify-center text-[#1E293B] group-hover:text-[#0F1B2B] transition-colors">
                        <i className={cn(step.icon, isActive && "text-[#0F1B2B]")} />
                      </div>

                      {!isCollapsed && (
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
                      )}
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
              title={isCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center bg-[#ECEEF1] text-sm font-semibold transition-colors",
                  isCollapsed ? "justify-center py-4 px-0" : "gap-3.5 px-6 py-4",
                  isHistory && "border-b border-slate-300",
                  isActive
                    ? "bg-[#DFE3E8] text-[#0F1B2B] font-bold"
                    : "text-[#1E293B] hover:bg-[#D4DAE2] hover:text-[#0F1B2B]"
                )
              }
            >
              <i className={cn(item.icon, "text-[#1E293B]")} />
              {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </NavLink>
          );
        })}
      </div>
    </aside>
  );
}
