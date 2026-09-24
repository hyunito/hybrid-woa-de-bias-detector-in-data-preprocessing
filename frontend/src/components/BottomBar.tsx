import { useState, useEffect, type ReactNode } from "react";
import { cn } from "../lib/utils";

interface BottomBarProps {
  isConnected?: boolean;
  showDbStatus?: boolean;
  className?: string;
  children?: ReactNode;
}

export default function BottomBar({
  isConnected: propIsConnected,
  showDbStatus = true,
  className,
  children,
}: BottomBarProps) {
  const [internalConnected, setInternalConnected] = useState<boolean | null>(
    propIsConnected !== undefined ? propIsConnected : null
  );

  useEffect(() => {
    if (propIsConnected !== undefined) {
      setInternalConnected(propIsConnected);
      return;
    }

    let isMounted = true;

    const checkDbStatus = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/settings/database/status");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setInternalConnected(Boolean(data.is_connected));
          }
        } else {
          if (isMounted) setInternalConnected(false);
        }
      } catch {
        if (isMounted) setInternalConnected(false);
      }
    };

    checkDbStatus();

    // Listen for settings updates to immediately refresh connection badge
    const handleStatusChange = () => {
      checkDbStatus();
    };
    window.addEventListener("proba_db_status_change", handleStatusChange);

    // Periodic check every 15 seconds
    const interval = setInterval(checkDbStatus, 15000);

    return () => {
      isMounted = false;
      window.removeEventListener("proba_db_status_change", handleStatusChange);
      clearInterval(interval);
    };
  }, [propIsConnected]);

  const activeConnected = propIsConnected !== undefined ? propIsConnected : internalConnected;

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
            {activeConnected === null
              ? "Checking..."
              : activeConnected
              ? "Connected"
              : "Disconnected"}
          </span>
          <span
            className={`w-2.5 h-2.5 rounded-full inline-block shadow-xs ml-0.5 ${
              activeConnected === null
                ? "bg-amber-400 animate-pulse"
                : activeConnected
                ? "bg-emerald-500 animate-pulse"
                : "bg-rose-500"
            }`}
          />
        </div>
      )}

      {children && (
        <div className={cn(showDbStatus ? "border-l border-slate-300 pl-8" : "w-full flex items-center justify-between")}>
          {children}
        </div>
      )}
    </div>
  );
}
