import type { KnowledgeSource } from '@/pages/ai-operations/types';

export default function ReviewHistory({ source }: { source: KnowledgeSource }) {
  const { reviewHistory } = source;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Review History</h3>
        <span className="text-[11px] font-label text-foreground-600">{reviewHistory.length} entries</span>
      </div>

      {reviewHistory.length === 0 ? (
        <p className="px-4 py-6 text-sm text-foreground-500">No review history yet.</p>
      ) : (
        <div className="divide-y divide-background-200/40">
          {reviewHistory.map((r) => (
            <div key={`${r.date}-${r.action}`} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm text-foreground-100">
                    {r.action} <span className="font-mono text-foreground-300">{r.version}</span>
                  </p>
                  <p className="text-[11px] font-label text-foreground-500 mt-0.5">{r.summary}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-label text-foreground-500">{r.date}</p>
                  <p className="text-[11px] font-label text-foreground-600 mt-0.5">{r.actor}</p>
                </div>
              </div>
              <p className="text-[10px] font-label text-foreground-600 mt-1.5">{r.statusChange}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}