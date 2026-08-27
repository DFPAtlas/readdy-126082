import type { ApprovalEvidence } from '@/pages/ai-operations/types';

export default function Evidence({ evidence }: { evidence: ApprovalEvidence[] }) {
  if (evidence.length === 0) {
    return (
      <section className="space-y-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Evidence</h3>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
          <p className="text-sm text-foreground-500">No evidence attached.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Evidence</h3>
      <div className="bg-background-100 border border-background-200/60 rounded-lg divide-y divide-background-200/40">
        {evidence.map((e, i) => (
          <div key={`${e.referenceId}-${i}`} className="p-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-500 bg-background-200/50 border border-background-300/40 rounded-full px-2 py-0.5 whitespace-nowrap">
                  {e.type}
                </span>
                <span className="font-mono text-xs text-accent-400">{e.referenceId}</span>
              </div>
              <p className="text-sm font-medium text-foreground-100 mt-1.5">{e.title}</p>
              <p className="text-xs text-foreground-500 mt-0.5">{e.summary}</p>
              <p className="text-[11px] font-label text-foreground-600 mt-1">{e.source} · {e.timestamp} · {e.confidence !== '—' ? `${e.confidence} confidence` : ''}</p>
            </div>
            <button
              disabled
              title="Future-state"
              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-50 border border-background-200/60 rounded-md px-2.5 py-1.5 opacity-60 cursor-not-allowed whitespace-nowrap"
            >
              <i className="ri-eye-line text-sm w-4 h-4 flex items-center justify-center"></i>
              View
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}