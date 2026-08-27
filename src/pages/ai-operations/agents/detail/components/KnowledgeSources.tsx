import { Link } from 'react-router-dom';
import { getKnowledgeForAgent } from '@/pages/ai-operations/knowledge/selectors';
import { KNOWLEDGE_SOURCE_TYPE_LABELS, KNOWLEDGE_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function KnowledgeSources({ agentId }: { agentId: string }) {
  const sources = getKnowledgeForAgent(agentId);

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Knowledge Sources</h3>
        <span className="text-[11px] font-label text-foreground-600">{sources.length} sources</span>
      </div>

      {sources.length === 0 ? (
        <p className="px-4 py-6 text-sm text-foreground-500">No knowledge sources assigned to this agent.</p>
      ) : (
        <div className="divide-y divide-background-200/40 max-h-96 overflow-y-auto">
          {sources.map((s) => {
            const status = KNOWLEDGE_STATUS[s.status];
            return (
              <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-background-200/30 transition-colors duration-150">
                <div className="min-w-0">
                  <Link to={`/ai-operations/knowledge/${s.id}`} className="text-sm font-medium text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer">
                    {s.title}
                  </Link>
                  <p className="text-[10px] font-label text-foreground-600 mt-0.5">
                    {KNOWLEDGE_SOURCE_TYPE_LABELS[s.type]} · {s.scope === 'group' ? 'Group-wide' : s.siteName}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusPill tone={status.tone} label={status.label} />
                  <Link
                    to={`/ai-operations/knowledge/${s.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Open
                    <i className="ri-arrow-right-line w-3 h-3 flex items-center justify-center"></i>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}