export interface RoutingDecisionItem {
  timestamp: string;
  label: string;
  result: string;
  reason: string;
  actor: string;
}

export default function RoutingDecisions({ items }: { items: RoutingDecisionItem[] }) {
  if (items.length === 0) {
    return (
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-6 text-center">
        <i className="ri-git-commit-line text-2xl text-foreground-600 w-8 h-8 flex items-center justify-center mx-auto"></i>
        <p className="text-sm text-foreground-500 mt-3">No routing decisions recorded for this orchestration yet.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Routing Decisions</h3>
        <span className="text-[11px] font-label text-foreground-600">Append-only · chronological</span>
      </div>
      <div className="bg-background-100 border border-background-200/60 rounded-lg">
        <ol className="divide-y divide-background-200/40">
          {items.map((d, i) => (
            <li key={`${d.timestamp}-${i}`} className="flex items-start gap-3 px-4 py-3 hover:bg-background-50/60 transition-colors">
              <div className="w-7 h-7 rounded-full bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0 mt-0.5">
                <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm font-label font-medium text-foreground-100">{d.label}</p>
                  <span className="text-[11px] font-label text-foreground-600 whitespace-nowrap">{d.timestamp}</span>
                </div>
                <p className="text-xs text-foreground-300 mt-0.5">{d.result}</p>
                {d.reason && <p className="text-[11px] text-foreground-500 mt-0.5">{d.reason}</p>}
                <p className="text-[10px] font-label text-foreground-600 mt-1 uppercase tracking-wide">{d.actor}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}