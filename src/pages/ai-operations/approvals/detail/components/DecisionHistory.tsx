import type { ApprovalHistoryEvent } from '@/pages/ai-operations/types';

export default function DecisionHistory({ history }: { history: ApprovalHistoryEvent[] }) {
  if (history.length === 0) {
    return (
      <section className="space-y-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Decision History</h3>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
          <p className="text-sm text-foreground-500">No decisions recorded yet.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Decision History</h3>
      <div className="bg-background-100 border border-background-200/60 rounded-lg divide-y divide-background-200/40">
        {history.map((e, i) => (
          <div key={i} className="p-4 flex items-start gap-3">
            <div className="mt-0.5 w-2 h-2 rounded-full bg-accent-400 shrink-0"></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground-100">{e.action}</span>
                <span className="text-[11px] font-label text-foreground-600">{e.actor}</span>
              </div>
              {e.comment && <p className="text-xs text-foreground-500 mt-0.5">{e.comment}</p>}
              <p className="text-[11px] font-label text-foreground-600 mt-1">
                {e.timestamp} · {e.previousStatus} → {e.newStatus}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}