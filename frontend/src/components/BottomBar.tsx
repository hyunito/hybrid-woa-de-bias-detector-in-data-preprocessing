import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface BottomBarProps {
  isConnected?: boolean;
  showDbStatus?: boolean;
  className?: string;
  children?: ReactNode;
}

export default function BottomBar({
  isConnected = true,
  showDbStatus = true,
  className,
  children,
}: BottomBarProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-slate-200/90 shadow-md p-4 px-8 flex items-center justify-between",
        className
      )}
    >
      {/* PostgreSQL Database Connection Status */}
      {showDbStatus && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#0F1B2B]">
            PostgreSQL Database Connection:
          </span>
          <span className="text-sm font-semibold text-slate-700">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
          <span
            className={`w-2.5 h-2.5 rounded-full inline-block shadow-xs ml-0.5 ${
              isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
            }`}
          />
        </div>
      )}

      {/* Dynamic Action Buttons Slot */}
      {children && (
        <div className={cn(showDbStatus ? "border-l border-slate-300 pl-8" : "w-full flex items-center justify-between")}>
          {children}
        </div>
      )}
    </div>
  );
}
