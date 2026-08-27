import { Link } from 'react-router-dom';
import type { ToolConnection } from '@/pages/ai-operations/types';
import {
  TOOL_CONNECTION_STATUS,
  CONNECTION_HEALTH,
  TOOL_CATEGORY_LABELS,
  ENVIRONMENT_LABELS,
} from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

const CRITICALITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export default function RegistryTable({ connections }: { connections: ToolConnection[] }) {
  if (connections.length === 0) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
        <p className="text-sm text-foreground-500">No connections match the current filters.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block bg-background-100 border border-background-200/60 rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Tool / Connection</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Site / Scope</th>
                <th className="px-4 py-3 font-medium">Environment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Health</th>
                <th className="px-4 py-3 font-medium">Criticality</th>
                <th className="px-4 py-3 font-medium">Agents</th>
                <th className="px-4 py-3 font-medium">Last Checked</th>
                <th className="px-4 py-3 font-medium text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((c) => {
                const status = TOOL_CONNECTION_STATUS[c.status];
                const health = CONNECTION_HEALTH[c.health.state];
                const criticality = c.criticality;
                return (
                  <tr key={c.id} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground-200 whitespace-nowrap">{c.name}</p>
                      <p className="text-[11px] font-label text-foreground-600 whitespace-nowrap">{c.id}</p>
                    </td>
                    <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{c.provider}</td>
                    <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{TOOL_CATEGORY_LABELS[c.category]}</td>
                    <td className="px-4 py-3 text-foreground-400 whitespace-nowrap">{c.scope}</td>
                    <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{ENVIRONMENT_LABELS[c.environment]}</td>
                    <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} /></td>
                    <td className="px-4 py-3"><StatusPill tone={health.tone} label={health.label} /></td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-label whitespace-nowrap ${criticality === 'critical' ? 'text-red-400' : criticality === 'high' ? 'text-amber-400' : 'text-foreground-500'}`}>
                        {CRITICALITY_LABELS[criticality]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{c.agentAccess.length}</td>
                    <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{c.lastChecked}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/ai-operations/tools/${c.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Open
                        <i className="ri-arrow-right-line text-sm w-4 h-4 flex items-center justify-center"></i>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {connections.map((c) => {
          const status = TOOL_CONNECTION_STATUS[c.status];
          const health = CONNECTION_HEALTH[c.health.state];
          return (
            <div key={c.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground-200">{c.name}</p>
                  <p className="text-[11px] font-label text-foreground-600">{c.id} · {c.provider}</p>
                </div>
                <Link
                  to={`/ai-operations/tools/${c.id}`}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 cursor-pointer whitespace-nowrap"
                >
                  Open
                  <i className="ri-arrow-right-line text-sm w-4 h-4 flex items-center justify-center"></i>
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={status.tone} label={status.label} />
                <StatusPill tone={health.tone} label={health.label} />
                <span className="text-[11px] font-label text-foreground-500 whitespace-nowrap">{TOOL_CATEGORY_LABELS[c.category]}</span>
                <span className="text-[11px] font-label text-foreground-500 whitespace-nowrap">{c.scope}</span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-background-200/40 text-[11px] font-label text-foreground-500">
                <span className="whitespace-nowrap">{ENVIRONMENT_LABELS[c.environment]}</span>
                <span className="whitespace-nowrap">{c.agentAccess.length} agents</span>
                <span className="whitespace-nowrap">{c.lastChecked}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}