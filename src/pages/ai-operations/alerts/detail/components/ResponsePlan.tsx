const STEPS = [
  'Acknowledge',
  'Diagnose',
  'Contain',
  'Recommend',
  'Approval (if required)',
  'Repair',
  'Verify',
  'UAT (if required)',
  'Monitor',
  'Close',
];

export default function ResponsePlan() {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Response Plan</h4>
      </div>
      <div className="px-4 py-4">
        <ol className="space-y-2">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-accent-500/10 text-accent-400 text-xs font-label flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="text-sm text-foreground-200">{step}</span>
            </li>
          ))}
        </ol>
        <p className="text-[11px] font-label text-foreground-600 mt-3">No step executes automatically — this is a recommended plan only.</p>
      </div>
    </section>
  );
}