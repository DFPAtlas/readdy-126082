import type { ModelRoutingPolicy } from '@/pages/ai-operations/types';
import { modelRoutingPolicy } from '@/mocks/ai-operations-models';

const PRIORITY_STYLES: Record<ModelRoutingPolicy['priority'], string> = {
  security: 'bg-red-500/10 text-red-400 border-red-500/25',
  capability: 'bg-accent-500/10 text-accent-400 border-accent-500/25',
  governance: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  operational: 'bg-secondary-500/10 text-secondary-300 border-secondary-500/25',
  cost: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
};

const PRIORITY_LABELS: Record<ModelRoutingPolicy['priority'], string> = {
  security: 'Security',
  capability: 'Capability',
  governance: 'Governance',
  operational: 'Operational',
  cost: 'Cost / Speed',
};

export default function RoutingPolicy() {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Routing Policy</h3>
        <span className="text-[10px] font-label text-foreground-600">Security, permissions &amp; capability rank above cost</span>
      </div>

      <ol className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {modelRoutingPolicy.map((rule) => (
          <li key={rule.rank} className="flex items-start gap-3 bg-background-50 border border-background-200/40 rounded-lg p-3">
            <span className="w-6 h-6 rounded-md bg-background-200/60 text-foreground-300 font-label text-xs flex items-center justify-center shrink-0">{rule.rank}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground-100">{rule.criterion}</span>
                <span className={`inline-flex items-center text-[9px] font-label px-1.5 py-0.5 rounded-full border ${PRIORITY_STYLES[rule.priority]}`}>
                  {PRIORITY_LABELS[rule.priority]}
                </span>
              </div>
              <p className="text-xs text-foreground-500 mt-1 leading-relaxed">{rule.description}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="text-[11px] font-label text-foreground-600 mt-4">
        Policy reference only — no automatic model routing occurs in this demo.
      </p>
    </section>
  );
}