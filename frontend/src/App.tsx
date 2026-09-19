import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Configuration from "./pages/Configuration";
import Processing from "./pages/Processing";
import Results from "./pages/Results";
import History from "./pages/History";
import Settings from "./pages/Settings";

export default function App() {
  useEffect(() => {
    // 1. Session Lifecycle Detection via Browser Session Cookie
    // Browsers automatically delete session cookies when the browser is closed.
    // If this cookie is missing, this is a brand new browser window/launch.
    const isSessionActive = document.cookie
      .split("; ")
      .some((c) => c.startsWith("proba_session_active="));

    if (!isSessionActive) {
      // Browser was closed and reopened: purge any stale session items restored by the browser
      const oldSessionId = sessionStorage.getItem("current_session_id");
      if (oldSessionId) {
        fetch(`http://127.0.0.1:8000/api/session/cleanup/${oldSessionId}`, {
          method: "POST",
        }).catch(() => {});
      }

      sessionStorage.removeItem("pipeline_scripts");
      sessionStorage.removeItem("scanned_dataset");
      sessionStorage.removeItem("audit_config");
      sessionStorage.removeItem("current_audit_id");
      sessionStorage.removeItem("audit_results");

      const newSessionId = Math.random().toString(36).substring(2, 11);
      sessionStorage.setItem("current_session_id", newSessionId);

      // Set session cookie (no expires attribute => deleted when browser closes)
      document.cookie = "proba_session_active=true; path=/";
    }

    // Pipeline scripts and dataset stay securely in their respective backend folders
  }, []);

  return (
    <BrowserRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-gradient-to-br from-[#122336] via-[#253D56] to-[#3C5774]">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-6 lg:p-10 flex flex-col justify-between">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/ingestion" element={<Navigate to="/dashboard" replace />} />
            <Route path="/configuration" element={<Configuration />} />
            <Route path="/processing" element={<Processing />} />
            <Route path="/results" element={<Results />} />
            <Route path="/results/:auditId" element={<Results />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
