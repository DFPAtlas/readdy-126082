import type { AiModel } from '@/pages/ai-operations/types';

export default function Limits({ model }: { model: AiModel }) {
  const rows = [
    { label: 'Context window', value: model.limits.contextWindow },
    { label: 'Maximum output', value: model.limits.maxOutput },
    { label: 'Request / rate', value: model.limits.rate },
    { label: 'Concurrency', value: model.limits.concurrency },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Limits</h3>
      <div className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-background-200/40 pb-2">
            <span className="text-xs font-label text-foreground-600 whitespace-nowrap">{r.label}</span>
            <span className="text-sm text-foreground-200 text-right">{r.value}</span>
          </div>
        ))}
        {model.limits.localResource && (
          <div className="flex items-baseline justify-between gap-3 border-b border-background-200/40 pb-2">
            <span className="text-xs font-label text-foreground-600 whitespace-nowrap">Local resource</span>
            <span className="text-sm text-foreground-200 text-right">{model.limits.localResource}</span>
          </div>
        )}
      </div>
      <p className="text-[11px] font-label text-foreground-600 mt-3">
        Demo limits only — not production guarantees.
      </p>
    </section>
  );
}