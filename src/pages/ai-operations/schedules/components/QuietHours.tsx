import type { QuietHoursPolicy } from '@/pages/ai-operations/types';

export default function QuietHours({ policies }: { policies: QuietHoursPolicy[] }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Quiet Hours</h3>
        <span className="text-[11px] font-label text-foreground-600">no real timing logic</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
        {policies.map((q) => (
          <div key={q.id} className="bg-background-50 border border-background-200/60 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground-100">{q.siteName}</p>
                <p className="text-[10px] font-label text-foreground-600 font-mono mt-0.5">{q.id}</p>
              </div>
              <span className="text-sm font-label text-foreground-300 font-mono whitespace-nowrap">{q.start} – {q.end}</span>
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-label rounded-full px-2 py-0.5 border whitespace-nowrap ${q.suppressNonCritical ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' : 'text-foreground-600 bg-background-100 border-background-200/60'}`}>
                Suppress non-critical: {q.suppressNonCritical ? 'Yes' : 'No'}
              </span>
              <span className={`text-[10px] font-label rounded-full px-2 py-0.5 border whitespace-nowrap ${q.delayNormalAutomation ? 'text-accent-400 bg-accent-500/10 border-accent-500/25' : 'text-foreground-600 bg-background-100 border-background-200/60'}`}>
                Delay normal: {q.delayNormalAutomation ? 'Yes' : 'No'}
              </span>
              <span className={`text-[10px] font-label rounded-full px-2 py-0.5 border whitespace-nowrap ${q.criticalBypass ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : 'text-foreground-600 bg-background-100 border-background-200/60'}`}>
                Critical bypass: {q.criticalBypass ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}