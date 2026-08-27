import { Link } from 'react-router-dom';
import type { KnowledgeSource } from '@/pages/ai-operations/types';
import {
  KNOWLEDGE_SOURCE_TYPE_LABELS,
  KNOWLEDGE_STATUS,
  INFORMATION_CLASSIFICATION,
  KNOWLEDGE_SCOPE_LABELS,
} from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function KnowledgeRegistry({ sources }: { sources: KnowledgeSource[] }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Knowledge Sources</h3>
        <span className="text-[11px] font-label text-foreground-600">{sources.length} sources</span>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Source</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Site / Scope</th>
              <th className="px-4 py-2.5 font-medium">Classification</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Version</th>
              <th className="px-4 py-2.5 font-medium">Agents</th>
              <th className="px-4 py-2.5 font-medium">Last Review</th>
              <th className="px-4 py-2.5 font-medium">Next Review</th>
              <th className="px-4 py-2.5 font-medium text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => {
              const status = KNOWLEDGE_STATUS[s.status];
              const classification = INFORMATION_CLASSIFICATION[s.classification];
              return (
                <tr key={s.id} className="border-b border-background-200/30 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <Link to={`/ai-operations/knowledge/${s.id}`} className="font-medium text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer">
                      {s.title}
                    </Link>
                    <p className="text-[10px] font-label text-foreground-600 font-mono mt-0.5">{s.id}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{KNOWLEDGE_SOURCE_TYPE_LABELS[s.type]}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">
                    {s.scope === 'group' ? 'Group-wide' : s.siteName}
                    <p className="text-[10px] font-label text-foreground-600">{KNOWLEDGE_SCOPE_LABELS[s.scope]}</p>
                  </td>
                  <td className="px-4 py-3"><StatusPill tone={classification.tone} label={classification.label} /></td>
                  <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} /></td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap font-mono">{s.version}</td>
                  <td className="px-4 py-3 text-foreground-300">{s.agentAccess.length}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{s.lastReviewed}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{s.nextReview}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/ai-operations/knowledge/${s.id}`}
                      className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Open
                      <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden divide-y divide-background-200/40">
        {sources.map((s) => {
          const status = KNOWLEDGE_STATUS[s.status];
          const classification = INFORMATION_CLASSIFICATION[s.classification];
          return (
            <Link key={s.id} to={`/ai-operations/knowledge/${s.id}`} className="block px-4 py-3 hover:bg-background-200/30 transition-colors duration-150 cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground-100">{s.title}</p>
                  <p className="text-[10px] font-label text-foreground-600 mt-0.5">
                    {KNOWLEDGE_SOURCE_TYPE_LABELS[s.type]} · {s.scope === 'group' ? 'Group-wide' : s.siteName} · v{s.version}
                  </p>
                </div>
                <StatusPill tone={status.tone} label={status.label} />
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <StatusPill tone={classification.tone} label={classification.label} />
                <span className="text-[11px] font-label text-foreground-500">{s.agentAccess.length} agents</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}