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
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
