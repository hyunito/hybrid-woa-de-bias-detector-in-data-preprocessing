import { NavLink, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";

// Icon placeholder component with safe fallback
function IconPlaceholder({ src, alt, className }: { src: string; alt: string; className?: string }) {
    return (
        <div className={cn("flex items-center justify-center flex-shrink-0", className)}>
            <img
                src={src}
                alt={alt}
                className="w-full h-full object-contain"
                onError={(e) => {
                    // If the custom image file is not found yet, show a clean fallback box
                    const target = e.currentTarget;
                    target.style.display = "none";
                    if (target.parentElement) {
                        target.parentElement.classList.add("bg-slate-200", "rounded-md");
                    }
                }}
            />
        </div>
    );
}

const STEPS = [
    {
        path: "/dashboard",
        label: "Pipeline Ingestion",
        iconSrc: "/icons/pipeline-ingestion.svg",
        isFirst: true,
    },
    {
        path: "/configuration",
        label: "Audit Configuration",
        iconSrc: "/icons/audit-configuration.svg",
    },
    {
        path: "/processing",
        label: "Processing Monitor",
        iconSrc: "/icons/processing-monitor.svg",
    },
    {
        path: "/results",
        label: "Results",
        iconSrc: "/icons/results.svg",
    },
];

export default function Sidebar() {
    const location = useLocation();

    return (
        <aside className="w-64 bg-white border-r border-slate-300 flex flex-col justify-between h-screen sticky top-0 select-none shadow-sm">
            {/* 1. Top PROBA Branding Header */}
            <div>
                <div className="bg-[#ECEEF1] border-b border-slate-300 py-5 px-5 flex items-center justify-center gap-3">
                    <div className="w-14 h-14 flex-shrink-0">
                        <IconPlaceholder
                            src="/icons/proba-logo.svg"
                            alt="PROBA Logo"
                            className="w-13 h-13"
                        />
                    </div>
                    <div>
                        <span className="text-3xl font-bold tracking-wider text-[#0F1B2B]">
                            PROBA
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 tracking-tight block">
                            Provenance-based Bias Auditor
                        </span>
                    </div>
                </div>

                {/* 2. Stepper Navigation with Lineage Tree Lines */}
                <div className="pt-10 pb-6 px-6">
                    <nav className="relative">
                        {/* Vertical Connecting Line */}
                        <div className="absolute left-[18px] top-[24px] bottom-[9px] w-[1.5px] bg-[#64748B]" />

                        <div className="space-y-12">
                            {STEPS.map((step) => {
                                const isActive = location.pathname.startsWith(step.path);

                                return (
                                    <NavLink
                                        key={step.path}
                                        to={step.path}
                                        className="flex items-center group relative cursor-pointer"
                                    >
                                        {/* Horizontal Branch Tick (for steps 2, 3, and 4) */}
                                        {!step.isFirst && (
                                            <div className="absolute left-[19px] w-6 h-[1.5px] bg-[#64748B] -z-0" />
                                        )}

                                        {/* Step Icon Container */}
                                        <div className="relative z-10 flex items-center justify-center">
                                            {step.isFirst ? (
                                                <div
                                                    className={cn(
                                                        "w-10 h-10 items-center justify-center transition-all",
                                                        isActive
                                                            ? "border-[#0F1B2B] shadow-sm"
                                                            : "border-[#64748B] group-hover:border-[#0F1B2B]"
                                                    )}
                                                >
                                                    <IconPlaceholder
                                                        src={step.iconSrc}
                                                        alt={step.label}
                                                        className="w-12 h-12"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="ml-11 flex items-center justify-center">
                                                    <IconPlaceholder
                                                        src={step.iconSrc}
                                                        alt={step.label}
                                                        className="w-5 h-5"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Step Label */}
                                        <span
                                            className={cn(
                                                "ml-3.5 text-sm font-semibold transition-colors leading-snug",
                                                isActive
                                                    ? "text-[#0F1B2B] font-bold"
                                                    : "text-[#1E293B] group-hover:text-[#0F1B2B]"
                                            )}
                                        >
                                            {step.label}
                                        </span>
                                    </NavLink>
                                );
                            })}
                        </div>
                    </nav>
                </div>
            </div>

            {/* 3. Bottom Action Panels (Log History & Settings) */}
            <div className="border-t border-slate-300">
                {/* Log History */}
                <NavLink
                    to="/history"
                    className={({ isActive }) =>
                        cn(
                            "flex items-center gap-3.5 px-6 py-4 bg-[#ECEEF1] border-b border-slate-300 text-sm font-semibold transition-colors",
                            isActive
                                ? "bg-[#DFE3E8] text-[#0F1B2B]"
                                : "text-[#1E293B] hover:bg-[#E2E6EA]"
                        )
                    }
                >
                    <IconPlaceholder
                        src="/icons/log-history.svg"
                        alt="Log History"
                        className="w-8 h-8"
                    />
                    <span>Log History</span>
                </NavLink>

                {/* Settings */}
                <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                        cn(
                            "flex items-center gap-3.5 px-6 py-4 bg-[#ECEEF1] text-sm font-semibold transition-colors",
                            isActive
                                ? "bg-[#DFE3E8] text-[#0F1B2B]"
                                : "text-[#1E293B] hover:bg-[#E2E6EA]"
                        )
                    }
                >
                    <IconPlaceholder
                        src="/icons/settings.svg"
                        alt="Settings"
                        className="w-8 h-8"
                    />
                    <span>Settings</span>
                </NavLink>
            </div>
        </aside>
    );
}
