export default function Configuration() {
    return (
        <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
                <h1 className="text-2xl font-bold text-navy-900">Audit Configuration</h1>
                <p className="text-sm text-slate-500">Define protected demographic attributes and configure the binary target variable.</p>
            </div>
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-slate-400 text-center">
                [ Protected Attributes & Target Variable selectors will go here ]
            </div>
        </div>
    );
}
