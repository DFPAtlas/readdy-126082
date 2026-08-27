import type { RunCost } from '@/pages/ai-operations/types';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-background-200/40 last:border-0">
      <span className="text-xs text-foreground-600 shrink-0">{label}</span>
      <span className="text-xs text-foreground-300 text-right break-all">{value || '—'}</span>
    </div>
  );
}

export default function CostTracking({ cost }: { cost: RunCost }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Cost Tracking</h3>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">
          Demo cost data
        </span>
      </div>
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <Field label="Model" value={cost.model} />
        <Field label="Provider" value={cost.provider} />
        <Field label="Estimated tokens / units" value={cost.estimatedTokens} />
        <Field label="Estimated cost" value={cost.estimatedCost} />
        <Field label="Actual / demo cost" value={cost.actualCost} />
        <Field label="Tool cost" value={cost.toolCost} />
        <Field label="Total estimated cost" value={cost.totalEstimatedCost} />
      </div>
    </section>
  );
}