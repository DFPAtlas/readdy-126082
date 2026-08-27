import { Link } from 'react-router-dom';
import type { KnowledgeSource } from '@/pages/ai-operations/types';

export default function SourceRelationships({ source }: { source: KnowledgeSource }) {
  const { relationships } = source;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Source Relationships</h3>
      </div>
      {relationships.length === 0 ? (
        <p className="px-4 py-6 text-sm text-foreground-500">No linked knowledge records.</p>
      ) : (
        <div className="divide-y divide-background-200/40">
          {relationships.map((r) => (
            <div key={`${r.relationType}-${r.title}`} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">{r.relationType}</p>
                {r.sourceId ? (
                  <Link to={`/ai-operations/knowledge/${r.sourceId}`} className="text-sm text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer">
                    {r.title}
                  </Link>
                ) : (
                  <p className="text-sm text-foreground-300">{r.title}</p>
                )}
              </div>
              {r.sourceId && (
                <Link
                  to={`/ai-operations/knowledge/${r.sourceId}`}
                  className="inline-flex items-center gap-1 text-[11px] font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Open
                  <i className="ri-arrow-right-line w-3 h-3 flex items-center justify-center"></i>
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}