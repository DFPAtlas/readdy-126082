import type { AiModel } from '@/pages/ai-operations/types';

export default function UsageCost({ model }: { model: AiModel }) {
  const u = model.usage;

  const metrics = [
    { label: 'Jobs today', value: u.jobsToday },
    { label: 'Estimated input tokens', value: u.estimatedInputTokens },
    { label: 'Estimated output tokens', value: u.estimatedOutputTokens },
    { label: 'Estimated provider cost', value: u.estimatedProviderCost },
    { label: 'Local compute estimate', value: u.localComputeEstimate },
    { label: 'Average cost / run', value: u.avgCostPerRun },
    { label: 'Average response time', value: u.avgResponseTime },
    { label: 'Failure rate', value: u.failureRate },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Usage &amp; Cost</h3>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
          <i className="ri-information-line w-3 h-3 flex items-center justify-center"></i>
          Demo data — not production billing
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="bg-background-50 border border-background-200/40 rounded-lg p-3">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">{m.label}</p>
            <p className="text-base font-heading font-bold text-foreground-100 mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
        <div className="flex items-baseline justify-between gap-3 border-b border-background-200/40 pb-2">
          <span className="text-foreground-600 whitespace-nowrap">Input cost</span>
          <span className="text-foreground-300 text-right">{model.inputCost}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-b border-background-200/40 pb-2">
          <span className="text-foreground-600 whitespace-nowrap">Output cost</span>
          <span className="text-foreground-300 text-right">{model.outputCost}</span>
        </div>
      </div>
    </section>
  );
}