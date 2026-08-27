import type { ExecutionGateCheck } from '@/pages/ai-operations/types';
import { GATE_STATE } from '@/pages/ai-operations/constants';

const STATE_STYLES: Record<string, string> = {
  pass: 'text-emerald-400',
  blocked: 'text-red-400',
  not_required: 'text-foreground-600',
};

export default function ExecutionGate({ checks }: { checks: ExecutionGateCheck[] }) {
  if (checks.length === 0) {
    return (
      <section className="space-y-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Execution Gate</h3>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
          <p className="text-sm text-foreground-500">Execution gate not yet evaluated.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Execution Gate</h3>
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          {checks.map((c) => {
            const label = GATE_STATE[c.state].label;
            return (
              <div key={c.name} className="flex items-start justify-between gap-3 py-1.5 border-b border-background-200/40">
                <div className="min-w-0">
                  <p className="text-xs font-label text-foreground-500">{c.name}</p>
                  <p className="text-[11px] text-foreground-600">{c.note}</p>
                </div>
                <span className={`text-xs font-label whitespace-nowrap ${STATE_STYLES[c.state]}`}>{label}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] font-label text-foreground-600 mt-3">
          Execution disabled — agent runtime is not connected. This gate does not execute any action.
        </p>
      </div>
    </section>
  );
}