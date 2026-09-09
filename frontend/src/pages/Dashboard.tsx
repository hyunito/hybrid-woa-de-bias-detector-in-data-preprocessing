import React, { useState, useRef } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "../lib/utils";
import BottomBar from "../components/BottomBar";

interface PipelineScript {
  id: string;
  name: string;
}

export default function Dashboard() {
  // Dataset file state
  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [isDraggingDataset, setIsDraggingDataset] = useState(false);
  const datasetInputRef = useRef<HTMLInputElement>(null);

  // Preprocessing scripts state
  const [scripts, setScripts] = useState<PipelineScript[]>([
    { id: "1", name: "handle_missing_data.py" },
    { id: "2", name: "remove_duplicates.py" },
    { id: "3", name: "remove_outliers.py" },
  ]);
  const [isDraggingScripts, setIsDraggingScripts] = useState(false);
  const scriptsInputRef = useRef<HTMLInputElement>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Dataset upload handlers
  const handleDatasetDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingDataset(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".csv")) {
        setDatasetFile(file);
      } else {
        alert("Please upload a valid .csv file.");
      }
    }
  };

  const handleDatasetSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setDatasetFile(e.target.files[0]);
    }
  };

  // Python scripts upload handlers
  const handleScriptsDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingScripts(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles: PipelineScript[] = Array.from(e.dataTransfer.files)
        .filter((f) => f.name.endsWith(".py"))
        .map((f, i) => ({
          id: `${Date.now()}-${i}`,
          name: f.name,
        }));
      if (newFiles.length > 0) {
        setScripts((prev) => [...prev, ...newFiles]);
      } else {
        alert("Please upload .py preprocessing script files.");
      }
    }
  };

  const handleScriptsSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles: PipelineScript[] = Array.from(e.target.files)
        .filter((f) => f.name.endsWith(".py"))
        .map((f, i) => ({
          id: `${Date.now()}-${i}`,
          name: f.name,
        }));
      setScripts((prev) => [...prev, ...newFiles]);
    }
  };

  // Drag-and-drop reordering
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
      {/* Dataset & Script Configuration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 items-stretch">
        
        {/* Dataset Dropzone Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md flex flex-col justify-between overflow-hidden">
          <div className="py-5 px-6 border-b border-slate-200 text-center">
            <h2 className="text-2xl font-black tracking-tight text-[#0F1B2B]">
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
                    <i className="bi bi-filetype-csv" />
                  </div>
                  <span className="font-bold text-base text-[#0F1B2B] break-all max-w-xs">
                    {datasetFile.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {(datasetFile.size / 1024).toFixed(1)} KB • Ready for audit
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDatasetFile(null);
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
              <span className="font-bold text-slate-700">Note:</span> Your .csv must contain demographic features (e.g., Race, Gender) and a binary target variable to enable bias auditing.
            </p>
          </div>
        </div>

        {/* Preprocessing Scripts Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md flex flex-col justify-between overflow-hidden">
          <div className="py-5 px-6 border-b border-slate-200 text-center">
            <h2 className="text-2xl font-black tracking-tight text-[#0F1B2B]">
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

              {/* Upload Dropzone */}
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

              <p className="text-[11px] text-slate-600 font-medium leading-relaxed border-t border-slate-200 mt-5 pt-3">
                <span className="font-bold text-slate-800">Note:</span> Drag scripts to set execution order. For the auditor to track provenance, you must put the{" "}
                <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px] text-slate-800 border border-slate-300">
                  @tracker.track("[Function's Task]")
                </code>{" "}
                above any function that modifies the dataframe.
              </p>
            </div>

            {/* Draggable Script List */}
            <div className="space-y-3 pt-1">
              {scripts.map((script, index) => (
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
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 text-xs transition-opacity p-1"
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Status & Navigation Bar */}
      <BottomBar>
        <NavLink
          to="/configuration"
          className="flex items-center gap-2 text-sm font-bold text-[#0F1B2B] hover:text-blue-700 transition-colors group"
        >
          <span>Proceed to Configuration</span>
          <i className="bi bi-arrow-right text-base group-hover:translate-x-1 transition-transform" />
        </NavLink>
      </BottomBar>
    </div>
  );
}
