import { NavLink, useLocation } from "react-router-dom";
import {
    FileUp,
    Sliders,
    Activity,
    CheckCircle2,
    History as HistoryIcon,
    Settings as SettingsIcon,
    ShieldAlert
} from "lucide-react";
import { cn } from "../lib/utils";

const STEPS = [
    { path: "/dashboard", label: "Pipeline Ingestion", icon: FileUp },
    { path: "/configuration", label: "Audit Configuration", step: 1, icon: Sliders },
    { path: "/processing", label: "Processing Monitor", step: 2, icon: Activity },
    { path: "/results", label: "Audit Results", step: 3, icon: CheckCircle2 },
];

export default function Sidebar() {
    const location = useLocation();

    return (
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col justify-between h-screen sticky top-0">
            {/* Top Branding */}
            <div>
                <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-navy-900 flex items-center justify-center text-white shadow-sm">
                        <ShieldAlert className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <span className="font-bold text-lg tracking-wider text-navy-900 block leading-tight">PROBA</span>
                        <span className="text-[11px] font-medium text-slate-400 tracking-tight block">Bias Audit System</span>
                    </div>
                </div>

                {/* 4-Step Vertical Stepper */}
                <div className="p-6">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-4">
                        Audit Flow
                    </span>
                    <nav className="relative space-y-2">
                        {/* Connecting Vertical Line */}
                        <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-200 -z-0" />

                        {STEPS.map((step) => {
                            const Icon = step.icon;
                            const isActive = location.pathname.startsWith(step.path);

                            return (
                                <NavLink
                                    key={step.path}
                                    to={step.path}
                                    className={cn(
                                        "flex items-center gap-3.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative z-10",
                                        isActive
                                            ? "bg-navy-900 text-white shadow-sm"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-colors",
                                            isActive
                                                ? "bg-white text-navy-900 border-white"
                                                : "bg-white text-slate-500 border-slate-300"
                                        )}
                                    >
                                        {step.step}
                                    </div>
                                    <span>{step.label}</span>
                                </NavLink>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* Bottom Utility Navigation */}
            <div className="p-4 border-t border-slate-100 space-y-1">
                <NavLink
                    to="/history"
                    className={({ isActive }) =>
                        cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                            isActive
                                ? "bg-slate-100 text-navy-900 font-semibold"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        )
                    }
                >
                    <HistoryIcon className="w-4 h-4 text-slate-500" />
                    <span>Audit History</span>
                </NavLink>
                <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                        cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                            isActive
                                ? "bg-slate-100 text-navy-900 font-semibold"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        )
                    }
                >
                    <SettingsIcon className="w-4 h-4 text-slate-500" />
                    <span>Settings</span>
                </NavLink>
            </div>
        </aside>
    );
}
