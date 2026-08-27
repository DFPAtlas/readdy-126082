import { getEfficiency } from '@/pages/ai-operations/costs/selectors';

export default function EfficiencyPanel() {
  const metrics = getEfficiency();

  return (
    <section aria-label="Efficiency" className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-label font-semibold text-foreground-100">Efficiency</h3>
        <span className="text-[11px] font-label text-foreground-500">Demo metrics</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <div key={m.key} className="p-3 rounded-md bg-background-50 border border-background-200/50">
            <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">{m.label}</p>
            <p className="text-base font-heading font-semibold text-foreground-100 mt-1">{m.value}</p>
            <p className="text-[11px] text-foreground-500 mt-1">{m.note}</p>
          </div>
        ))}
      </div>

      <p className="text-[11px] font-label text-foreground-600 mt-3">
        Efficiency figures are illustrative demo values and do not represent verified business savings.
      </p>
    </section>
  );
}