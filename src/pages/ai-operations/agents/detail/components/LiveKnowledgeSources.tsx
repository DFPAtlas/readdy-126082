import { Link } from 'react-router-dom';
import type { ResolvedKnowledgePermission } from '@/pages/ai-operations/agents/detail/agentIntegrations';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

interface Props {
  state: 'live' | 'empty' | 'unavailable';
  items: ResolvedKnowledgePermission[];
}

function Flag({ value, label }: { value: boolean; label: string }) {
  return value ? <StatusPill tone="emerald" label={label} /> : <StatusPill tone="secondary" label={label} />;
}

function SectionBanner({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 text-center">
      <i className={`${icon} text-2xl text-foreground-600 w-8 h-8 flex items-center justify-center mx-auto`}></i>
      <p className="text-sm text-foreground-200 font-label font-medium mt-3">{title}</p>
      <p className="text-xs text-foreground-500 mt-1">{detail}</p>
    </div>
  );
}

export default function LiveKnowledgeSources({ state, items }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Registered Knowledge Access</h3>
        <span className="text-xs font-label text-foreground-600">{items.length} source{items.length === 1 ? '' : 's'}</span>
      </div>

      {state === 'unavailable' && (
        <SectionBanner
          icon="ri-error-warning-line"
          title="Knowledge access data unavailable"
          detail="Registered knowledge permissions could not be loaded from the live registry."
        />
      )}

      {state === 'empty' && (
        <SectionBanner
          icon="ri-book-open-line"
          title="No registered knowledge access"
          detail="This agent has no active or revoked knowledge-source permissions in the registry."
        />
      )}

      {state === 'live' && items.length > 0 && (
        <>
          <div className="bg-background-100 border border-background-200/60 rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Scope</th>
                    <th className="px-4 py-3 font-medium">Access Level</th>
                    <th className="px-4 py-3 font-medium">Read</th>
                    <th className="px-4 py-3 font-medium">Retrieve</th>
                    <th className="px-4 py-3 font-medium">Reference</th>
                    <th className="px-4 py-3 font-medium">Approval</th>
                    <th className="px-4 py-3 font-medium">State</th>
                    <th className="px-4 py-3 font-medium text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((k, i) => (
                    <tr key={`${k.knowledgeKey}-${i}`} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                      <td className="px-4 py-3 font-medium text-foreground-200 whitespace-nowrap">{k.name}</td>
                      <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{k.knowledgeType}</td>
                      <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{k.scope}</td>
                      <td className="px-4 py-3 text-foreground-400 whitespace-nowrap">{k.accessLevel}</td>
                      <td className="px-4 py-3"><Flag value={k.canRead} label={k.canRead ? 'Read' : 'No'} /></td>
                      <td className="px-4 py-3"><Flag value={k.canRetrieve} label={k.canRetrieve ? 'Retrieve' : 'No'} /></td>
                      <td className="px-4 py-3"><Flag value={k.canReference} label={k.canReference ? 'Reference' : 'No'} /></td>
                      <td className="px-4 py-3">{k.approvalRequired ? <StatusPill tone="amber" label="Required" /> : <StatusPill tone="secondary" label="No" />}</td>
                      <td className="px-4 py-3">{k.isActive ? <StatusPill tone="emerald" label="Active" /> : <StatusPill tone="secondary" label="Revoked" />}</td>
                      <td className="px-4 py-3 text-right">
                        {k.knowledgeKey ? (
                          <Link
                            to={`/ai-operations/knowledge/${k.knowledgeKey}`}
                            className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Open
                            <i className="ri-arrow-right-line text-sm w-4 h-4 flex items-center justify-center"></i>
                          </Link>
                        ) : (
                          <span className="text-xs font-label text-foreground-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] font-label text-foreground-600">
            Registered Knowledge Access — knowledge retrieval/ingestion runtime is not connected. No RAG, embedding or retrieval is running.
          </p>
        </>
      )}
    </section>
  );
}