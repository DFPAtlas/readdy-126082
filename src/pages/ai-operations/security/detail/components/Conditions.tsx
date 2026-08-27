import type { AiSecurityPolicy } from '@/pages/ai-operations/types';

export default function Conditions({ policy }: { policy: AiSecurityPolicy }) {
  if (policy.conditions.length === 0) {
    return (
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Conditions</h3>
        <p className="text-sm text-foreground-500 mt-3">No structured conditions defined for this policy.</p>
      </section>
    );
  }

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Conditions</h3>

      <div className="mt-4 space-y-3">
        {policy.conditions.map((c, i) => (
          <div key={i} className="bg-background-50 border border-background-200/60 rounded-lg p-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <span className="inline-flex items-center justify-center text-[10px] font-label font-bold text-accent-300 bg-accent-500/10 border border-accent-500/20 rounded px-2 py-0.5 shrink-0 uppercase">
                If
              </span>
              <span className="text-sm text-foreground-200 font-mono text-xs">{c.when}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mt-2">
              <span className="inline-flex items-center justify-center text-[10px] font-label font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5 shrink-0 uppercase">
                Then
              </span>
              <span className="text-sm text-foreground-200 font-mono text-xs">{c.then}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}