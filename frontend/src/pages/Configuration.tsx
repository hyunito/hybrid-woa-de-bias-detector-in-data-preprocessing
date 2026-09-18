import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import BottomBar from "../components/BottomBar";

interface ProtectedAttribute {
  id: string;
  name: string;
  type: "Categorical" | "Continuous";
}

interface ScannedColumn {
  id: string;
  name: string;
  type: "Categorical" | "Continuous";
  is_binary: boolean;
  unique_values?: string[];
  sample_values?: string[];
}

interface ScannedDataset {
  filename: string;
  total_columns: number;
  columns: ScannedColumn[];
  binary_targets: Array<{ column: string; values: string[] }>;
}

export default function Configuration() {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [scannedData] = useState<ScannedDataset | null>(() => {
  try {
      const saved = sessionStorage.getItem("scanned_dataset");
      return saved && saved !== "undefined" ? JSON.parse(saved) : null;
    } catch (e) {
      console.warn("Failed to parse scanned_dataset from sessionStorage, resetting:", e);
      return null;
    }
  });


  const availableColumns = scannedData?.columns.map((c) => c.name) || [];
  const binaryTargetColumns = scannedData?.binary_targets?.map((b) => b.column) || 
    scannedData?.columns.filter((c) => c.is_binary).map((c) => c.name) || [];

  const [selectedAttributes, setSelectedAttributes] = useState<ProtectedAttribute[]>([]);
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);

  const [targetColumn, setTargetColumn] = useState<string>("");
  const [favorableOutcome, setFavorableOutcome] = useState<string>("");
  const [unfavorableOutcome, setUnfavorableOutcome] = useState<string>("");

  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);
  const [isFavorableDropdownOpen, setIsFavorableDropdownOpen] = useState(false);
  const [isUnfavorableDropdownOpen, setIsUnfavorableDropdownOpen] = useState(false);

  const selectedBinary = scannedData?.binary_targets?.find((b) => b.column === targetColumn);
  const targetOutcomes = selectedBinary?.values || 
    scannedData?.columns.find((c) => c.name === targetColumn)?.unique_values || [];

  const addAttribute = (colName: string) => {
    if (!selectedAttributes.some((a) => a.name === colName)) {
      setSelectedAttributes((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${colName}`,
          name: colName,
          type: "Categorical",
        },
      ]);
    }
    setIsColumnDropdownOpen(false);
  };

  const removeAttribute = (id: string) => {
    setSelectedAttributes((prev) => prev.filter((a) => a.id !== id));
  };

  const toggleAttributeType = (id: string, newType: "Categorical" | "Continuous") => {
    setSelectedAttributes((prev) =>
      prev.map((a) => (a.id === id ? { ...a, type: newType } : a))
    );
  };

  const handleTargetChange = (newTarget: string) => {
    setTargetColumn(newTarget);
    setFavorableOutcome("");
    setUnfavorableOutcome("");
    setIsTargetDropdownOpen(false);
  };

  const handleProceed = async () => {
    setErrorMessage(null);

    // Validation checks
    if (selectedAttributes.length === 0) {
      setErrorMessage("Please select at least one protected demographic attribute.");
      return;
    }
    if (!targetColumn) {
      setErrorMessage("Please select a target variable column.");
      return;
    }
    if (!favorableOutcome) {
      setErrorMessage("Please select a favorable outcome value.");
      return;
    }
    if (!unfavorableOutcome) {
      setErrorMessage("Please select an unfavorable outcome value.");
      return;
    }

    setIsProcessing(true);

    // Read arranged scripts from sessionStorage
    let pipelineScripts = [];
    try {
      const savedScripts = sessionStorage.getItem("pipeline_scripts");
      if (savedScripts) {
        pipelineScripts = JSON.parse(savedScripts);
      }
    } catch (e) {
      console.warn("Failed to parse pipeline_scripts:", e);
    }

    const config = {
      protected_attributes: selectedAttributes.map((a) => ({
        name: a.name,
        type: a.type.toLowerCase(),
      })),
      target_variable: {
        name: targetColumn,
        positive: favorableOutcome,
        negative: unfavorableOutcome,
      },
      pipeline_scripts: pipelineScripts,
    };

    // Save configuration to sessionStorage
    sessionStorage.setItem("audit_config", JSON.stringify(config));

    try {
      const response = await fetch("http://127.0.0.1:8000/api/tracker/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to setup dynamic tracker on backend.");
      }

      const result = await response.json();
      console.log("[Configuration] Dynamic tracker_setup.py generated:", result);

      // Navigate to Processing Monitor
      navigate("/processing");
    } catch (err: any) {
      console.error("Tracker setup error:", err);
      setErrorMessage(err.message || "Could not connect to backend server.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full justify-between gap-6 max-w-7xl mx-auto w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 items-stretch">
        
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md flex flex-col justify-between overflow-hidden">
          <div className="py-5 px-6 border-b border-slate-200 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[#0F1B2B] leading-snug">
              Select and Configure Protected<br />Demographic Attributes
            </h2>
          </div>

          <div className="p-8 flex-1 flex flex-col justify-between gap-6">
            <div className="space-y-5">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsColumnDropdownOpen((prev) => !prev)}
                  className="w-full border border-slate-400/90 rounded-2xl py-3 px-5 flex items-center justify-between text-sm text-slate-700 bg-white hover:border-slate-600 transition-colors cursor-pointer text-left"
                >
                  <span className="text-slate-600">Select column/s from dataset</span>
                  <i className={cn("bi bi-chevron-down text-xs text-slate-500 transition-transform", isColumnDropdownOpen && "rotate-180")} />
                </button>

                {isColumnDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-300 rounded-2xl shadow-xl z-30 py-2 max-h-56 overflow-y-auto">
                    {availableColumns.length === 0 ? (
                      <div className="px-5 py-3 text-xs text-slate-400">
                        No columns found. Please upload a dataset in the Dashboard first.
                      </div>
                    ) : (
                      availableColumns.map((col) => {
                        const isAlreadySelected = selectedAttributes.some((a) => a.name === col);
                        return (
                          <button
                            key={col}
                            type="button"
                            disabled={isAlreadySelected}
                            onClick={() => addAttribute(col)}
                            className={cn(
                              "w-full text-left px-5 py-2.5 text-sm flex items-center justify-between transition-colors",
                              isAlreadySelected
                                ? "text-slate-400 bg-slate-50 cursor-not-allowed"
                                : "text-[#0F1B2B] hover:bg-blue-50/70 font-semibold cursor-pointer"
                            )}
                          >
                            <span>{col}</span>
                            {isAlreadySelected && <span className="text-xs text-slate-400 font-normal">Added</span>}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              <div className="border border-slate-300/90 rounded-2xl p-5 bg-[#F8FAFC]/60">
                <span className="text-sm font-bold text-[#0F1B2B] text-center mb-4 block">
                  Column/s Selected
                </span>

                <div className="space-y-3">
                  {selectedAttributes.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 font-medium">
                      No demographic attributes selected yet. Select from above.
                    </div>
                  ) : (
                    selectedAttributes.map((attr) => (
                      <div
                        key={attr.id}
                        className="border border-slate-300 bg-white rounded-2xl p-2.5 px-4 flex items-center justify-between shadow-xs transition-all hover:border-slate-400"
                      >
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => removeAttribute(attr.id)}
                            className="text-slate-400 hover:text-red-600 text-xs font-bold transition-colors cursor-pointer p-0.5"
                            title="Remove attribute"
                          >
                            <i className="bi bi-x-lg text-xs" />
                          </button>
                          <span className="text-sm font-bold text-[#0F1B2B]">
                            {attr.name}
                          </span>
                        </div>

                        <div className="bg-slate-100 rounded-xl p-1 flex items-center border border-slate-200">
                          <button
                            type="button"
                            onClick={() => toggleAttributeType(attr.id, "Categorical")}
                            className={cn(
                              "text-xs px-3 py-1 rounded-lg transition-all cursor-pointer",
                              attr.type === "Categorical"
                                ? "bg-white font-bold text-[#0F1B2B] shadow-xs"
                                : "text-slate-500 hover:text-slate-800 font-medium"
                            )}
                          >
                            Categorical
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleAttributeType(attr.id, "Continuous")}
                            className={cn(
                              "text-xs px-3 py-1 rounded-lg transition-all cursor-pointer",
                              attr.type === "Continuous"
                                ? "bg-white font-bold text-[#0F1B2B] shadow-xs"
                                : "text-slate-500 hover:text-slate-800 font-medium"
                            )}
                          >
                            Continuous
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 pt-2">
              <i className="bi bi-info-circle text-slate-500 text-sm flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                This establishes the core demographic variables that the system will monitor and allows the system to analyze combinations of characteristics to expose the highest bias.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md flex flex-col justify-between overflow-hidden">
          <div className="py-5 px-6 border-b border-slate-200 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[#0F1B2B] leading-snug">
              Define the Binary Target Variable and its<br />Outcome Values
            </h2>
          </div>

          <div className="p-8 flex-1 flex flex-col justify-between gap-6">
            <div className="space-y-6">

              <div>
                <label className="text-xs font-bold text-[#0F1B2B] mb-2 block">
                  Select binary target column from the dataset
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTargetDropdownOpen((p) => !p);
                      setIsFavorableDropdownOpen(false);
                      setIsUnfavorableDropdownOpen(false);
                    }}
                    className="w-full border border-slate-400/90 rounded-2xl py-3 px-5 flex items-center justify-between text-sm font-semibold text-[#0F1B2B] bg-white hover:border-slate-600 transition-colors cursor-pointer text-left"
                  >
                    <span>{targetColumn || "Select target column from dataset"}</span>
                    <i className={cn("bi bi-chevron-down text-xs text-slate-500 transition-transform", isTargetDropdownOpen && "rotate-180")} />
                  </button>

                  {isTargetDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-300 rounded-2xl shadow-xl z-30 py-2 max-h-56 overflow-y-auto">
                      {binaryTargetColumns.length === 0 ? (
                        <div className="px-5 py-3 text-xs text-slate-400">
                          No binary columns (2 unique values) detected in this dataset.
                        </div>
                      ) : (
                        binaryTargetColumns.map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => handleTargetChange(col)}
                            className={cn(
                              "w-full text-left px-5 py-2.5 text-sm font-semibold hover:bg-blue-50/70 transition-colors",
                              targetColumn === col ? "text-blue-600 bg-blue-50/50" : "text-[#0F1B2B]"
                            )}
                          >
                            {col}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#0F1B2B] mb-2 block">
                  Select favorable outcome value
                </label>
                <div className="relative">
                  <button
                    type="button"
                    disabled={!targetColumn}
                    onClick={() => {
                      setIsFavorableDropdownOpen((p) => !p);
                      setIsTargetDropdownOpen(false);
                      setIsUnfavorableDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full border border-slate-400/90 rounded-2xl py-3 px-5 flex items-center justify-between text-sm font-semibold bg-white transition-colors text-left",
                      !targetColumn
                        ? "opacity-50 cursor-not-allowed bg-slate-50"
                        : "text-[#0F1B2B] hover:border-slate-600 cursor-pointer"
                    )}
                  >
                    <span>{favorableOutcome || (targetColumn ? "Select favorable outcome value" : "Select a target column first")}</span>
                    <i className={cn("bi bi-chevron-down text-xs text-slate-500 transition-transform", isFavorableDropdownOpen && "rotate-180")} />
                  </button>

                  {isFavorableDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-300 rounded-2xl shadow-xl z-30 py-2 max-h-56 overflow-y-auto">
                      {targetOutcomes.length === 0 ? (
                        <div className="px-5 py-3 text-xs text-slate-400">
                          No outcome values found for {targetColumn}.
                        </div>
                      ) : (
                        targetOutcomes.map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              setFavorableOutcome(val);
                              setIsFavorableDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-5 py-2.5 text-sm font-semibold hover:bg-blue-50/70 transition-colors",
                              favorableOutcome === val ? "text-blue-600 bg-blue-50/50" : "text-[#0F1B2B]"
                            )}
                          >
                            {val}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#0F1B2B] mb-2 block">
                  Select unfavorable outcome value
                </label>
                <div className="relative">
                  <button
                    type="button"
                    disabled={!targetColumn}
                    onClick={() => {
                      setIsUnfavorableDropdownOpen((p) => !p);
                      setIsTargetDropdownOpen(false);
                      setIsFavorableDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full border border-slate-400/90 rounded-2xl py-3 px-5 flex items-center justify-between text-sm font-semibold bg-white transition-colors text-left",
                      !targetColumn
                        ? "opacity-50 cursor-not-allowed bg-slate-50"
                        : "text-[#0F1B2B] hover:border-slate-600 cursor-pointer"
                    )}
                  >
                    <span>{unfavorableOutcome || (targetColumn ? "Select unfavorable outcome value" : "Select a target column first")}</span>
                    <i className={cn("bi bi-chevron-down text-xs text-slate-500 transition-transform", isUnfavorableDropdownOpen && "rotate-180")} />
                  </button>

                  {isUnfavorableDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-300 rounded-2xl shadow-xl z-30 py-2 max-h-56 overflow-y-auto">
                      {targetOutcomes.length === 0 ? (
                        <div className="px-5 py-3 text-xs text-slate-400">
                          No outcome values found for {targetColumn}.
                        </div>
                      ) : (
                        targetOutcomes.map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => {
                              setUnfavorableOutcome(val);
                              setIsUnfavorableDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-5 py-2.5 text-sm font-semibold hover:bg-blue-50/70 transition-colors",
                              unfavorableOutcome === val ? "text-blue-600 bg-blue-50/50" : "text-[#0F1B2B]"
                            )}
                          >
                            {val}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>

            <div className="flex items-start gap-2.5 pt-2">
              <i className="bi bi-info-circle text-slate-500 text-sm flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                Defining outcome values is required to compute selection rates for mathematical bias calculation.
              </p>
            </div>
          </div>
        </div>

      </div>

      <BottomBar>
        <div className="flex items-center gap-4">
          {errorMessage && (
            <div className="text-xs font-semibold text-rose-600 max-w-sm flex items-center gap-1.5 animate-fade-in">
              <i className="bi bi-exclamation-circle-fill flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleProceed}
            className={cn(
              "flex items-center gap-2 text-sm font-bold transition-all cursor-pointer",
              isProcessing
                ? "text-slate-400 cursor-not-allowed"
                : "text-[#0F1B2B] hover:text-blue-700 group"
            )}
          >
            {isProcessing ? (
              <>
                <i className="bi bi-arrow-repeat animate-spin text-base" />
                <span>Configuring Tracker...</span>
              </>
            ) : (
              <>
                <span>Process</span>
                <i className="bi bi-arrow-right text-base group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      </BottomBar>
    </div>
  );
}
