import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Configuration from "./pages/Configuration";
import Processing from "./pages/Processing";
import Results from "./pages/Results";
import History from "./pages/History";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-[#F8FAFC]">
        {/* Persistent Left Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 p-8 max-w-6xl mx-auto overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/ingestion" replace />} />
            <Route path="/ingestion" element={<Dashboard />} />
            <Route path="/configuration" element={<Configuration />} />
            <Route path="/processing" element={<Processing />} />
            <Route path="/results" element={<Results />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
