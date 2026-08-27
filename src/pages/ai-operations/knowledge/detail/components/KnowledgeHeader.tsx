import { Link } from 'react-router-dom';
import type { KnowledgeSource } from '@/pages/ai-operations/types';
import {
  KNOWLEDGE_STATUS,
  INFORMATION_CLASSIFICATION,
  KNOWLEDGE_SOURCE_TYPE_LABELS,
  KNOWLEDGE_SCOPE_LABELS,
} from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function KnowledgeHeader({ source, onEdit }: { source: KnowledgeSource; onEdit: () => void }) {
  const status = KNOWLEDGE_STATUS[source.status];
  const classification = INFORMATION_CLASSIFICATION[source.classification];

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-2 text-xs font-label text-foreground-500 flex-wrap">
        <Link to="/ai-operations" className="hover:text-foreground-200 transition-colors cursor-pointer">AI Operations</Link>
        <span className="text-foreground-600">→</span>
        <Link to="/ai-operations/knowledge" className="hover:text-foreground-200 transition-colors cursor-pointer">Knowledge &amp; Memory</Link>
        <span className="text-foreground-600">→</span>
        <span className="text-foreground-300 font-mono">{source.title}</span>
      </nav>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">{source.title}</h1>
            <StatusPill tone={status.tone} label={status.label} />
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <StatusPill tone={classification.tone} label={classification.label} />
            <span className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5">
              <i className="ri-book-2-line text-sm w-4 h-4 flex items-center justify-center"></i>
              {KNOWLEDGE_SOURCE_TYPE_LABELS[source.type]}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5">
              <i className="ri-global-line text-sm w-4 h-4 flex items-center justify-center"></i>
              {KNOWLEDGE_SCOPE_LABELS[source.scope]}
            </span>
          </div>
          <p className="text-xs font-label text-foreground-500 mt-2">
            {source.scope === 'group' ? 'Group-wide' : source.siteName} · v{source.version} · <span className="font-mono">{source.id}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:text-foreground-100 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-edit-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}