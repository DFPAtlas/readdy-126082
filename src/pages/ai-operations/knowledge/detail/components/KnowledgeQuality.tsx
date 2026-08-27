import type { KnowledgeSource } from '@/pages/ai-operations/types';
import { QUALITY_CHECK_STATE } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function KnowledgeQuality({ source }: { source: KnowledgeSource }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Knowledge Quality</h3>
      </div>
      <div className="divide-y divide-background-200/40">
        {source.quality.map((q) => {
          const state = QUALITY_CHECK_STATE[q.state];
          return (
            <div key={q.name} className="px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground-200">{q.name}</p>
                <p className="text-[11px] font-label text-foreground-600 mt-0.5">{q.note}</p>
              </div>
              <StatusPill tone={state.tone} label={state.label} />
            </div>
          );
        })}
      </div>
      <div className="px-4 py-3 border-t border-background-200/60">
        <p className="text-[11px] font-label text-foreground-600">No live validation is performed — checks reflect stored metadata only.</p>
      </div>
    </section>
  );
}