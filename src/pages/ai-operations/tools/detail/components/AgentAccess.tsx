import { Link } from 'react-router-dom';
import type { ToolConnection } from '@/pages/ai-operations/types';
import type { ToolsDataSourceMode } from '@/pages/ai-operations/tools/ToolsContext';
import { ACCESS_MODE_LABELS, RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

interface AgentAccessProps {
  connection: ToolConnection;
  mode?: ToolsDataSourceMode;
  onGrant?: () => void;
  onRevoke?: (agentId: string) => void;
}

export default function AgentAccess({ connection, mode, onGrant, onRevoke }: AgentAccessProps) {
  const { agentAccess } = connection;
  const live = mode === 'live';

  if (agentAccess.length === 0 && !live) {
    return (
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Agent Access</h3>
        <p className="text-sm text-foreground-500">No agents currently use this connection.</p>
      </section>
    );
  }

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Agent Access</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-label text-foreground-600">{agentAccess.length} agents</span>
          {live && onGrant && (
            <button
              onClick={onGrant}
              className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-user-add-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Grant Access
            </button>
          )}
        </div>
      </div>

      {agentAccess.length === 0 ? (
        <p className="text-sm text-foreground-500">No agents currently use this connection.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
                <th className="px-2 py-2 font-medium">Agent</th>
                <th className="px-2 py-2 font-medium">Site</th>
                <th className="px-2 py-2 font-medium">Access</th>
                <th className="px-2 py-2 font-medium">Allowed</th>
                <th className="px-2 py-2 font-medium">Restricted</th>
                <th className="px-2 py-2 font-medium">Risk</th>
                <th className="px-2 py-2 font-medium">Approval</th>
                <th className="px-2 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {agentAccess.map((a) => {
                const risk = RISK_LEVEL[a.risk];
                const revoked = a.status === 'disconnected';
                return (
                  <tr key={a.agentId} className="border-t border-background-200/40 align-top">
                    <td className="px-2 py-2.5 font-medium text-foreground-200 whitespace-nowrap">
                      {a.agentName}
                      {revoked && <span className="ml-2 text-[10px] font-label text-red-400 whitespace-nowrap">revoked</span>}
                    </td>
                    <td className="px-2 py-2.5 text-foreground-500 whitespace-nowrap">{a.site}</td>
                    <td className="px-2 py-2.5 text-foreground-400 whitespace-nowrap">{ACCESS_MODE_LABELS[a.accessMode]}</td>
                    <td className="px-2 py-2.5">
                      <div className="space-y-0.5">
                        {a.allowedOperations.map((op) => (
                          <p key={op} className="text-[11px] text-foreground-400 whitespace-nowrap">{op}</p>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="space-y-0.5">
                        {a.restrictedOperations.map((op) => (
                          <p key={op} className="text-[11px] text-red-400/80 whitespace-nowrap">{op}</p>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-2.5"><StatusPill tone={risk.tone} label={risk.label} /></td>
                    <td className="px-2 py-2.5 text-foreground-500 whitespace-nowrap">{a.approvalRequired ? 'Required' : '—'}</td>
                    <td className="px-2 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/ai-operations/agents/${a.agentId}`}
                          className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 cursor-pointer whitespace-nowrap"
                        >
                          Open Agent
                        </Link>
                        {live && !revoked && onRevoke && (
                          <button
                            onClick={() => onRevoke(a.agentId)}
                            className="inline-flex items-center gap-1 text-xs font-label text-red-400 hover:text-red-300 cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-close-circle-line text-sm w-4 h-4 flex items-center justify-center"></i>
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}