import React, { useState, useRef, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "../lib/utils";
import BottomBar from "../components/BottomBar";

interface PipelineScript {
  id: string;
  name: string;
}

export default function Dashboard() {
  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [isDraggingDataset, setIsDraggingDataset] = useState(false);
  const datasetInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    total_columns: number;
    columns: Array<{ id: string; name: string; type: string; is_binary: boolean }>;
    binary_targets: Array<{ column: string; values: string[] }>;
    saved_path?: string;
  } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Session ID for resource tracking and safe exit cleanup
  const [sessionId] = useState<string>(() => {
    let existing = sessionStorage.getItem("current_session_id");
    if (!existing) {
      existing = Math.random().toString(36).substring(2, 11);
      sessionStorage.setItem("current_session_id", existing);
    }
    return existing;
  });

  const [scripts, setScripts] = useState<PipelineScript[]>(() => {
    try {
      const saved = sessionStorage.getItem("pipeline_scripts");
      return saved && saved !== "undefined" ? JSON.parse(saved) : [];
    } catch (e) {
      console.warn("Failed to parse pipeline_scripts from sessionStorage, resetting:", e);
      return [];
    }
  });

  useEffect(() => {
    sessionStorage.setItem("pipeline_scripts", JSON.stringify(scripts));
    window.dispatchEvent(new Event("proba_step_change"));
  }, [scripts]);

  const [isDraggingScripts, setIsDraggingScripts] = useState(false);
  const scriptsInputRef = useRef<HTMLInputElement>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isUploadingScripts, setIsUploadingScripts] = useState(false);
  const [scriptUploadNotice, setScriptUploadNotice] = useState<string | null>(null);

  // Upload and stream dataset to backend/dataset/ in chunks
  const uploadAndScanDataset = async (file: File) => {
    setIsScanning(true);
    setScanError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("session_id", sessionId);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/dataset/scan", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to stream and scan dataset");
      }

      const data = await response.json();
      console.log("[Dashboard] Streamed dataset to disk & scanned successfully:", data);
      setScanResult(data);

      sessionStorage.setItem("scanned_dataset", JSON.stringify(data));
      window.dispatchEvent(new Event("proba_step_change"));
    } catch (err: any) {
      console.error("Scanning error:", err);
      setScanError(err.message || "Could not connect to backend server. Make sure it is running on port 8000.");
    } finally {
      setIsScanning(false);
    }
  };

  // Upload preprocessing scripts to backend/pipeline/
  const uploadScriptsToBackend = async (pyFiles: File[]) => {
    if (pyFiles.length === 0) return;
    setIsUploadingScripts(true);
    setScriptUploadNotice(null);

    const formData = new FormData();
    pyFiles.forEach((f) => formData.append("files", f));
    formData.append("session_id", sessionId);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/pipeline/upload-scripts", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to upload scripts to backend");
      }

      const data = await response.json();
      console.log("[Dashboard] Uploaded scripts successfully to backend/pipeline/:", data);
      setScriptUploadNotice(`Saved ${data.uploaded_count} script(s) to pipeline engine.`);
    } catch (err: any) {
      console.error("Script upload error:", err);
      setScriptUploadNotice(`Upload warning: ${err.message}`);
    } finally {
      setIsUploadingScripts(false);
    }
  };

  const handleDatasetDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingDataset(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".csv")) {
        setDatasetFile(file);
        uploadAndScanDataset(file);
      } else {
        alert("Please upload a valid .csv file.");
      }
    }
  };

  const handleDatasetSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setDatasetFile(file);
      uploadAndScanDataset(file);
    }
  };

  const handleScriptsDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingScripts(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const pyFiles = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith(".py"));
      if (pyFiles.length > 0) {
        const newScripts: PipelineScript[] = pyFiles.map((f, i) => ({
          id: `${Date.now()}-${i}`,
          name: f.name,
        }));
        setScripts((prev) => [...prev, ...newScripts]);
        uploadScriptsToBackend(pyFiles);
      } else {
        alert("Please upload .py preprocessing script files.");
      }
    }
  };

  const handleScriptsSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const pyFiles = Array.from(e.target.files).filter((f) => f.name.endsWith(".py"));
      if (pyFiles.length > 0) {
        const newScripts: PipelineScript[] = pyFiles.map((f, i) => ({
          id: `${Date.now()}-${i}`,
          name: f.name,
        }));
        setScripts((prev) => [...prev, ...newScripts]);
        uploadScriptsToBackend(pyFiles);
      }
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const reordered = [...scripts];
    const draggedItem = reordered[draggedIndex];
    reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    setScripts(reordered);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const removeScript = (id: string) => {
    setScripts((prev) => prev.filter((s) => s.id !== id));
  };



  return (
    <div className="flex flex-col h-full justify-between gap-6 max-w-7xl mx-auto w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 items-stretch">
        {/* Left: Dataset Upload */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md flex flex-col justify-between overflow-hidden">
          <div className="py-5 px-6 border-b border-slate-200 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[#0F1B2B]">
              Dataset
            </h2>
          </div>

          <div className="p-8 flex-1 flex flex-col items-center justify-center">
            <input
              type="file"
              ref={datasetInputRef}
              onChange={handleDatasetSelect}
              accept=".csv"
              className="hidden"
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingDataset(true);
              }}
              onDragLeave={() => setIsDraggingDataset(false)}
              onDrop={handleDatasetDrop}
              onClick={() => datasetInputRef.current?.click()}
              className={cn(
                "w-full border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer min-h-[260px]",
                isDraggingDataset
                  ? "border-blue-600 bg-blue-50/60 scale-[1.01]"
                  : "border-slate-400/90 hover:border-slate-600 hover:bg-slate-50/70"
              )}
            >
              {datasetFile ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 text-2xl mb-1">
                    {isScanning ? (
                      <i className="bi bi-arrow-repeat animate-spin text-blue-600" />
                    ) : (
                      <i className="bi bi-filetype-csv" />
                    )}
                  </div>
                  <span className="font-bold text-base text-[#0F1B2B] break-all max-w-xs">
                    {datasetFile.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {(datasetFile.size / 1024).toFixed(1)} KB
                  </span>

                  {isScanning && (
                    <span className="text-xs font-semibold text-blue-600 animate-pulse mt-1">
                      Streaming to disk and inspecting schema...
                    </span>
                  )}

                  {scanResult && !isScanning && (
                    <div className="mt-1 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                      <i className="bi bi-check-circle-fill text-emerald-600" />
                      <span>
                        <strong>{scanResult.total_columns}</strong> columns detected | <strong>{scanResult.binary_targets.length}</strong> binary targets
                      </span>
                    </div>
                  )}

                  {scanError && (
                    <div className="mt-1 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5 text-xs text-red-700 flex items-center gap-1.5 max-w-xs text-center">
                      <i className="bi bi-exclamation-triangle-fill text-red-600 flex-shrink-0" />
                      <span>{scanError}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDatasetFile(null);
                      setScanResult(null);
                      setScanError(null);
                      sessionStorage.removeItem("scanned_dataset");
    window.dispatchEvent(new Event("proba_step_change"));
                    }}
                    className="mt-2 text-xs font-bold text-red-600 hover:underline"
                  >
                    Remove File
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4 text-[#0F1B2B]">
                    <i className="bi bi-upload text-4xl stroke-[1.5]" />
                  </div>
                  <p className="text-sm font-bold text-[#0F1B2B]">
                    Drag and drop your .csv file here
                  </p>
                  <p className="text-xs font-semibold text-slate-500 my-1">
                    OR
                  </p>
                  <p className="text-sm font-bold text-[#0F1B2B] underline underline-offset-2 hover:text-blue-700">
                    Browse Files
                  </p>
                </>
              )}
            </div>

            <p className="text-[11px] text-slate-500 text-center mt-6 leading-relaxed max-w-sm">
              <span className="font-bold text-slate-700">Note:</span> Large datasets are streamed directly to local storage to prevent memory overflow. File must contain demographic features and a binary target.
            </p>
          </div>
        </div>

        {/* Right: Pipeline Scripts Upload */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md flex flex-col justify-between overflow-hidden">
          <div className="py-5 px-6 border-b border-slate-200 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[#0F1B2B]">
              Data Pipeline Scripts
            </h2>
          </div>

          <div className="p-8 flex-1 flex flex-col justify-between gap-6">
            <div>
              <input
                type="file"
                ref={scriptsInputRef}
                onChange={handleScriptsSelect}
                accept=".py"
                multiple
                className="hidden"
              />
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingScripts(true);
                }}
                onDragLeave={() => setIsDraggingScripts(false)}
                onDrop={handleScriptsDrop}
                onClick={() => scriptsInputRef.current?.click()}
                className={cn(
                  "w-full border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer",
                  isDraggingScripts
                    ? "border-blue-600 bg-blue-50/60 scale-[1.01]"
                    : "border-slate-400/90 hover:border-slate-600 hover:bg-slate-50/70"
                )}
              >
                <div className="mb-2 text-[#0F1B2B]">
                  <i className="bi bi-upload text-3xl stroke-[1.5]" />
                </div>
                <p className="text-sm font-bold text-[#0F1B2B]">
                  Drag and drop your preprocessing scripts here
                </p>
                <p className="text-xs font-semibold text-slate-500 my-0.5">
                  OR
                </p>
                <p className="text-sm font-bold text-[#0F1B2B] underline underline-offset-2 hover:text-blue-700">
                  Browse Files
                </p>
                <span className="text-[11px] text-slate-500 mt-2 block">
                  Supported format: .py only
                </span>
              </div>

              {isUploadingScripts && (
                <div className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-blue-600">
                  <i className="bi bi-arrow-repeat animate-spin" />
                  <span>Saving scripts to pipeline directory...</span>
                </div>
              )}

              {scriptUploadNotice && !isUploadingScripts && (
                <div className="mt-3 text-center text-xs font-medium text-slate-600">
                  {scriptUploadNotice}
                </div>
              )}

              <p className="text-[11px] text-slate-600 font-medium leading-relaxed border-t border-slate-200 mt-5 pt-3">
                <span className="font-bold text-slate-800">Note:</span> Drag scripts to set execution order. Please ensure scripts are connected sequentially so the pipeline can execute from the first script. For the auditor to track provenance, you must put the{" "}
                <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px] text-slate-800 border border-slate-300">
                  @tracker.track("[Function's Task]")
                </code>{" "}
                above any function that modifies the dataframe.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              {scripts.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  No preprocessing scripts uploaded yet.
                </div>
              ) : (
                scripts.map((script, index) => (
                  <div
                    key={script.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "bg-[#ECEEF1] border border-slate-300/90 rounded-2xl py-3.5 px-5 flex items-center justify-between transition-all select-none shadow-xs group",
                      draggedIndex === index
                        ? "opacity-50 border-blue-500 bg-blue-50 scale-[0.98]"
                        : "hover:bg-slate-200/80 cursor-grab active:cursor-grabbing"
                    )}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-slate-600 group-hover:text-[#0F1B2B] flex items-center">
                        <i className="bi bi-grid-3x2-gap-fill text-lg" />
                      </div>
                      <span className="text-sm font-bold text-[#0F1B2B]">
                        {script.name}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeScript(script.id);
                      }}
                      title="Remove script"
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 text-xs transition-opacity p-1 cursor-pointer"
                    >
                      <i className="bi bi-x-lg" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <BottomBar>
        {(scanResult || datasetFile || !!sessionStorage.getItem("scanned_dataset")) && scripts.length > 0 ? (
          <NavLink
            to="/configuration"
            className="flex items-center gap-2 text-sm font-bold text-[#0F1B2B] hover:text-blue-700 transition-colors group cursor-pointer"
          >
            <span>Proceed to Configuration</span>
            <i className="bi bi-arrow-right text-base group-hover:translate-x-1 transition-transform" />
          </NavLink>
        ) : (
          <div
            className="flex items-center gap-2 text-sm font-bold text-[#0F1B2B] opacity-50 cursor-default select-none pointer-events-none"
          >
            <span>Proceed to Configuration</span>
            <i className="bi bi-arrow-right text-base" />
          </div>
        )}
      </BottomBar>
    </div>
  );
}
