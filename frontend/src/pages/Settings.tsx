export default function Settings() {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-navy-900">System & Algorithm Settings</h1>
        <p className="text-sm text-slate-500">Configure PostgreSQL credentials, WOA search agents, DE parameters, and bias threshold.</p>
      </div>
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-slate-400 text-center">
        [ Database and Threshold parameter cards will go here ]
      </div>
    </div>
  );
}
