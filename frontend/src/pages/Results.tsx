import BottomBar from "../components/BottomBar";

export default function Results() {
  return (
    <div className="flex flex-col h-full justify-between gap-6 max-w-7xl mx-auto w-full">
      {/* Audit Results Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md flex-1 flex flex-col justify-between overflow-hidden">
        <div className="py-5 px-8 border-b border-slate-200">
          <h1 className="text-2xl font-black tracking-tight text-[#0F1B2B]">
            AUDIT RESULTS
          </h1>
        </div>

        <div className="p-8 flex-1 flex flex-col items-center justify-center text-slate-400 text-sm">
          [ Detected Root Cause & Fair World Comparison will be rendered here ]
        </div>
      </div>

      {/* Bottom Status Bar */}
      <BottomBar />
    </div>
  );
}
