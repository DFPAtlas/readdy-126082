import { Link } from 'react-router-dom';
import type { ResolvedToolAccess } from '@/pages/ai-operations/agents/detail/agentIntegrations';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

interface Props {
  state: 'live' | 'empty' | 'unavailable';
  items: ResolvedToolAccess[];
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

export default function LiveAgentTools({ state, items }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Registered Tool Access</h3>
        <span className="text-xs font-label text-foreground-600">{items.length} access{items.length === 1 ? '' : 'es'}</span>
      </div>

      {state === 'unavailable' && (
        <SectionBanner
          icon="ri-error-warning-line"
          title="Tool access data unavailable"
          detail="Registered tool access could not be loaded from the live registry."
        />
      )}

      {state === 'empty' && (
        <SectionBanner
          icon="ri-tools-line"
          title="No registered tool access"
          detail="This agent has no active or revoked tool-access records in the registry."
        />
      )}

      {state === 'live' && items.length > 0 && (
        <>
          <div className="bg-background-100 border border-background-200/60 rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
                    <th className="px-4 py-3 font-medium">Tool / Connection</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Access Level</th>
                    <th className="px-4 py-3 font-medium">Allowed Operations</th>
                    <th className="px-4 py-3 font-medium">Restricted</th>
                    <th className="px-4 py-3 font-medium">Approval</th>
                    <th className="px-4 py-3 font-medium">Risk Limit</th>
                    <th className="px-4 py-3 font-medium">State</th>
                    <th className="px-4 py-3 font-medium text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => (
                    <tr key={t.connectionKey} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                      <td className="px-4 py-3 font-medium text-foreground-200 whitespace-nowrap">
                        {t.connectionKey ? (
                          <Link to={`/ai-operations/tools/${t.connectionKey}`} className="hover:text-accent-400 transition-colors cursor-pointer">
                            {t.name}
                          </Link>
                        ) : (
                          t.name
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{t.category}</td>
                      <td className="px-4 py-3 text-foreground-400 font-label whitespace-nowrap">{t.accessLevel}</td>
                      <td className="px-4 py-3 text-foreground-500">
                        {t.allowedOperations.length > 0 ? (
                          <span className="inline-flex flex-wrap gap-1 max-w-[220px]">
                            {t.allowedOperations.map((op) => (
                              <span key={op} className="text-[11px] text-foreground-500 bg-background-50 border border-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">{op}</span>
                            ))}
                          </span>
                        ) : (
                          <span className="text-foreground-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground-500">
                        {t.restrictedOperations.length > 0 ? (
                          <span className="inline-flex flex-wrap gap-1 max-w-[220px]">
                            {t.restrictedOperations.map((op) => (
                              <span key={op} className="text-[11px] text-foreground-600 bg-background-50 border border-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">{op}</span>
                            ))}
                          </span>
                        ) : (
                          <span className="text-foreground-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{t.approvalRequired ? <StatusPill tone="amber" label="Required" /> : <StatusPill tone="secondary" label="No" />}</td>
                      <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{t.riskLimit}</td>
                      <td className="px-4 py-3">{t.isActive ? <StatusPill tone="emerald" label="Active" /> : <StatusPill tone="secondary" label="Revoked" />}</td>
                      <td className="px-4 py-3 text-right">
                        {t.connectionKey ? (
                          <Link
                            to={`/ai-operations/tools/${t.connectionKey}`}
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
            Registered Tool Access — runtime tool execution is not connected. A healthy registry status does not imply a live connection.
          </p>
        </>
      )}
    </section>
  );
}