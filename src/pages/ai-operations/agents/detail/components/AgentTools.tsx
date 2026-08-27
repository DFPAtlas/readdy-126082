import { Link } from 'react-router-dom';
import type { AgentTool } from '@/pages/ai-operations/types';
import { CONNECTION_STATUS, ACCESS_MODE_LABELS, ENVIRONMENT_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import { resolveConnectionId } from '@/pages/ai-operations/tools/connectionRefs';

export default function AgentTools({ tools }: { tools: AgentTool[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Agent Tools</h3>
        <span className="text-xs font-label text-foreground-600">{tools.length} tools</span>
      </div>

      {tools.length === 0 ? (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
          <p className="text-sm text-foreground-500">No tools configured yet.</p>
        </div>
      ) : (
        <div className="bg-background-100 border border-background-200/60 rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Tool</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Access Mode</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Environment</th>
                  <th className="px-4 py-3 font-medium">Scope</th>
                  <th className="px-4 py-3 font-medium">Last Checked</th>
                  <th className="px-4 py-3 font-medium text-right">Connection</th>
                </tr>
              </thead>
              <tbody>
                {tools.map((tool) => {
                  const status = CONNECTION_STATUS[tool.status];
                  const connectionId = resolveConnectionId(tool.name);
                  return (
                    <tr key={tool.name} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                      <td className="px-4 py-3 font-medium text-foreground-200 whitespace-nowrap">{tool.name}</td>
                      <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{tool.type}</td>
                      <td className="px-4 py-3 text-foreground-400 font-label whitespace-nowrap">{ACCESS_MODE_LABELS[tool.accessMode]}</td>
                      <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} /></td>
                      <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{ENVIRONMENT_LABELS[tool.environment]}</td>
                      <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{tool.scope}</td>
                      <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{tool.lastChecked}</td>
                      <td className="px-4 py-3 text-right">
                        {connectionId ? (
                          <Link
                            to={`/ai-operations/tools/${connectionId}`}
                            className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 cursor-pointer whitespace-nowrap"
                          >
                            Open Connection
                            <i className="ri-arrow-right-line text-sm w-4 h-4 flex items-center justify-center"></i>
                          </Link>
                        ) : (
                          <span className="text-xs font-label text-foreground-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}