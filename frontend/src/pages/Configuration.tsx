import { useState } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "../lib/utils";
import BottomBar from "../components/BottomBar";

interface ProtectedAttribute {
  id: string;
  name: string;
  type: "Categorical" | "Continuous";
}

const AVAILABLE_COLUMNS = [
  "Race",
  "Sex",
  "Age",
  "Marital Status",
  "Workclass",
  "Education",
  "Occupation",
  "Relationship",
  "Place of Birth",
];

const TARGET_COLUMNS = ["Income", "Credit Status", "Hired", "Approval", "Recidivism"];

const OUTCOME_OPTIONS: Record<string, { favorable: string[]; unfavorable: string[] }> = {
  Income: {
    favorable: ["> 50,000", "> 50K", "1", "High Income"],
    unfavorable: ["<= 50,000", "<= 50K", "0", "Low Income"],
  },
  "Credit Status": {
    favorable: ["Good", "Approved", "1"],
    unfavorable: ["Bad", "Denied", "0"],
  },
  Hired: {
    favorable: ["Yes", "1", "Hired"],
    unfavorable: ["No", "0", "Not Hired"],
  },
  Approval: {
    favorable: ["Approved", "1"],
    unfavorable: ["Denied", "0"],
  },
  Recidivism: {
    favorable: ["No", "0", "Low Risk"],
    unfavorable: ["Yes", "1", "High Risk"],
  },
};

export default function Configuration() {
  // Demographic attributes state
  const [selectedAttributes, setSelectedAttributes] = useState<ProtectedAttribute[]>([
    { id: "1", name: "Race", type: "Categorical" },
    { id: "2", name: "Sex", type: "Categorical" },
    { id: "3", name: "Age", type: "Continuous" },
  ]);
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);

  // Binary target variable state
  const [targetColumn, setTargetColumn] = useState("Income");
  const [favorableOutcome, setFavorableOutcome] = useState("> 50,000");
  const [unfavorableOutcome, setUnfavorableOutcome] = useState("<= 50,000");

  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);
  const [isFavorableDropdownOpen, setIsFavorableDropdownOpen] = useState(false);
  const [isUnfavorableDropdownOpen, setIsUnfavorableDropdownOpen] = useState(false);

  // Attribute management
  const addAttribute = (colName: string) => {
    if (!selectedAttributes.some((a) => a.name === colName)) {
      setSelectedAttributes((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${colName}`,
          name: colName,
          type: colName === "Age" ? "Continuous" : "Categorical",
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

  // Target variable selection
  const handleTargetChange = (newTarget: string) => {
    setTargetColumn(newTarget);
    const options = OUTCOME_OPTIONS[newTarget] || {
      favorable: ["1", "Yes", "Positive"],
      unfavorable: ["0", "No", "Negative"],
    };
    setFavorableOutcome(options.favorable[0]);
    setUnfavorableOutcome(options.unfavorable[0]);
    setIsTargetDropdownOpen(false);
  };

  return (
    <div className="flex flex-col h-full justify-between gap-6 max-w-7xl mx-auto w-full">
      {/* Protected Attributes & Target Variable Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 items-stretch">
        
        {/* Protected Demographic Attributes Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md flex flex-col justify-between overflow-hidden">
          <div className="py-5 px-6 border-b border-slate-200 text-center">
            <h2 className="text-2xl font-black tracking-tight text-[#0F1B2B] leading-snug">
              Select and Configure Protected<br />Demographic Attributes
            </h2>
          </div>

          <div className="p-8 flex-1 flex flex-col justify-between gap-6">
            <div className="space-y-5">
              {/* Column Selection Dropdown */}
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
                    {AVAILABLE_COLUMNS.map((col) => {
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
                    })}
                  </div>
                )}
              </div>

              {/* Selected Columns List */}
              <div className="border border-slate-300/90 rounded-2xl p-5 bg-[#F8FAFC]/60">
                <span className="text-sm font-bold text-[#0F1B2B] text-center mb-4 block">
                  Column/s Selected
                </span>

                <div className="space-y-3">
                  {selectedAttributes.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 font-medium">
                      No demographic attributes selected yet.
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

                        {/* Type Toggle */}
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

        {/* Binary Target Variable Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md flex flex-col justify-between overflow-hidden">
          <div className="py-5 px-6 border-b border-slate-200 text-center">
            <h2 className="text-2xl font-black tracking-tight text-[#0F1B2B] leading-snug">
              Define the Binary Target Variable and its<br />Outcome Values
            </h2>
          </div>

          <div className="p-8 flex-1 flex flex-col justify-between gap-6">
            <div className="space-y-6">
              
              {/* Target Column Selector */}
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
                    <span>{targetColumn}</span>
                    <i className={cn("bi bi-chevron-down text-xs text-slate-500 transition-transform", isTargetDropdownOpen && "rotate-180")} />
                  </button>

                  {isTargetDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-300 rounded-2xl shadow-xl z-30 py-2">
                      {TARGET_COLUMNS.map((col) => (
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
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Favorable Outcome Selector */}
              <div>
                <label className="text-xs font-bold text-[#0F1B2B] mb-2 block">
                  Select favorable outcome value
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFavorableDropdownOpen((p) => !p);
                      setIsTargetDropdownOpen(false);
                      setIsUnfavorableDropdownOpen(false);
                    }}
                    className="w-full border border-slate-400/90 rounded-2xl py-3 px-5 flex items-center justify-between text-sm font-semibold text-[#0F1B2B] bg-white hover:border-slate-600 transition-colors cursor-pointer text-left"
                  >
                    <span>{favorableOutcome}</span>
                    <i className={cn("bi bi-chevron-down text-xs text-slate-500 transition-transform", isFavorableDropdownOpen && "rotate-180")} />
                  </button>

                  {isFavorableDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-300 rounded-2xl shadow-xl z-30 py-2">
                      {(OUTCOME_OPTIONS[targetColumn]?.favorable || ["> 50,000", "1", "Approved"]).map((val) => (
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
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Unfavorable Outcome Selector */}
              <div>
                <label className="text-xs font-bold text-[#0F1B2B] mb-2 block">
                  Select unfavorable outcome value
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnfavorableDropdownOpen((p) => !p);
                      setIsTargetDropdownOpen(false);
                      setIsFavorableDropdownOpen(false);
                    }}
                    className="w-full border border-slate-400/90 rounded-2xl py-3 px-5 flex items-center justify-between text-sm font-semibold text-[#0F1B2B] bg-white hover:border-slate-600 transition-colors cursor-pointer text-left"
                  >
                    <span>{unfavorableOutcome}</span>
                    <i className={cn("bi bi-chevron-down text-xs text-slate-500 transition-transform", isUnfavorableDropdownOpen && "rotate-180")} />
                  </button>

                  {isUnfavorableDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-300 rounded-2xl shadow-xl z-30 py-2">
                      {(OUTCOME_OPTIONS[targetColumn]?.unfavorable || ["<= 50,000", "0", "Denied"]).map((val) => (
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
                      ))}
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

      {/* Bottom Status & Navigation Bar */}
      <BottomBar>
        <NavLink
          to="/processing"
          className="flex items-center gap-2 text-sm font-bold text-[#0F1B2B] hover:text-blue-700 transition-colors group"
        >
          <span>Process</span>
          <i className="bi bi-arrow-right text-base group-hover:translate-x-1 transition-transform" />
        </NavLink>
      </BottomBar>
    </div>
  );
}
