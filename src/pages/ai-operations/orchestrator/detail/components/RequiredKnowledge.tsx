import { Link } from 'react-router-dom';
import type { AiOrchestration } from '@/pages/ai-operations/types';
import { getKnowledgeForOrchestration } from '@/pages/ai-operations/knowledge/selectors';
import { KNOWLEDGE_SOURCE_TYPE_LABELS } from '@/pages/ai-operations/constants';

export default function RequiredKnowledge({ orchestration }: { orchestration: AiOrchestration }) {
  const sources = getKnowledgeForOrchestration(orchestration.siteId);

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Required Knowledge</h3>
        <span className="text-[11px] font-label text-foreground-600">No retrieval occurs</span>
      </div>
      <div className="divide-y divide-background-200/40">
        {sources.map((s) => (
          <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-background-200/30 transition-colors duration-150">
            <div className="min-w-0">
              <Link to={`/ai-operations/knowledge/${s.id}`} className="text-sm text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer">
                {s.title}
              </Link>
              <p className="text-[10px] font-label text-foreground-600 mt-0.5">
                {KNOWLEDGE_SOURCE_TYPE_LABELS[s.type]} · {s.scope === 'group' ? 'Group-wide' : s.siteName}
              </p>
            </div>
            <Link
              to={`/ai-operations/knowledge/${s.id}`}
              className="inline-flex items-center gap-1 text-[11px] font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Open Knowledge
              <i className="ri-arrow-right-line w-3 h-3 flex items-center justify-center"></i>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}