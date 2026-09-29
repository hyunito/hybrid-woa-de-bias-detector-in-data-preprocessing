import { NavLink } from "react-router-dom";

export default function Welcome() {
  return (
    <div className="flex flex-col h-full justify-between gap-6 max-w-7xl mx-auto w-full">
      <div className="flex-1 flex items-center bg-white rounded-3xl border border-slate-200/90 shadow-md p-8">
        <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
          <div className="min-w-0">
            <h1 className="text-5xl font-bold text-[#0F1B2B]">
              Keep track of bias<br />in your dataset.
            </h1>
            <p className="mt-8 text-base text-[#1E293B]">
              PROBA records every transformation in your dataset<br />and flags the ones that cause bias.
            </p>
            <NavLink
              to="/dashboard"
              className="mt-8 inline-flex text-xs font-bold text-[#0F1B2B] bg-[#ECEEF1] hover:bg-slate-200 border border-slate-300 rounded-xl px-7 py-2 shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 items-center gap-1.5"
            >
              Get started
            </NavLink>
          </div>
          <div className="flex-1 flex justify-center">
            <img
              src="/icons/proba-logo.svg"
              alt="PROBA Logo"
              className="w-56 h-56 sm:w-72 sm:h-72 object-contain flex-shrink-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
