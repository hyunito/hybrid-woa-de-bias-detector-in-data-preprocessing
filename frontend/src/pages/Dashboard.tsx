export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-navy-900">Pipeline Ingestion</h1>
        <p className="text-sm text-slate-500">Upload your raw dataset CSV and data preprocessing Python pipeline scripts.</p>
      </div>
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-slate-400 text-center">
        [ Ingestion Dropzones & Script Reordering will go here ]
      </div>
    </div>
  );
}
