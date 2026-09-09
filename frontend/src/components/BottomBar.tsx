import React from "react";

interface BottomBarProps {
  isConnected?: boolean;
  children?: React.ReactNode;
}

export default function BottomBar({ isConnected = true, children }: BottomBarProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-md p-4 px-8 flex items-center justify-between">
      {/* PostgreSQL Database Connection Status */}
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

      {/* Dynamic Action Buttons Slot (e.g. Proceed to Configuration, Run Audit, etc.) */}
      {children && (
        <div className="border-l border-slate-300 pl-8">
          {children}
        </div>
      )}
    </div>
  );
}
