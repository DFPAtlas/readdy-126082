import { Link } from 'react-router-dom';
import type { AiOrchestration } from '@/pages/ai-operations/types';
import { ACCESS_MODE_LABELS, CONNECTION_STATUS, ENVIRONMENT_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import { resolveConnectionId } from '@/pages/ai-operations/tools/connectionRefs';

export default function RequiredTools({ orchestration }: { orchestration: AiOrchestration }) {
  const { tools } = orchestration;

  if (tools.length === 0) {
    return (
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Required Tools</h3>
        <p className="text-sm text-foreground-500">No tool metadata required for this orchestration.</p>
      </section>
    );
  }

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Required Tools</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-[10px] font-label uppercase tracking-wide text-foreground-600 border-b border-background-200/60">
              <th className="py-2 pr-4 font-medium">Tool</th>
              <th className="py-2 pr-4 font-medium">Agent</th>
              <th className="py-2 pr-4 font-medium">Access</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Scope</th>
              <th className="py-2 pr-4 font-medium">Environment</th>
              <th className="py-2 font-medium">Criticality</th>
            </tr>
          </thead>
          <tbody>
            {tools.map((t, i) => {
              const connectionId = resolveConnectionId(t.tool);
              return (
              <tr key={`${t.tool}-${i}`} className="border-b border-background-200/40 last:border-0">
                <td className="py-2.5 pr-4 text-foreground-100 whitespace-nowrap">
                  {connectionId ? (
                    <Link to={`/ai-operations/tools/${connectionId}`} className="text-accent-400 hover:text-accent-300 cursor-pointer inline-flex items-center gap-1">
                      {t.tool}
                      <i className="ri-arrow-right-line text-sm w-4 h-4 flex items-center justify-center"></i>
                    </Link>
                  ) : (
                    t.tool
                  )}
                </td>
                <td className="py-2.5 pr-4 text-foreground-300 whitespace-nowrap">{t.agentName}</td>
                <td className="py-2.5 pr-4 text-foreground-500 whitespace-nowrap">{ACCESS_MODE_LABELS[t.accessMode]}</td>
                <td className="py-2.5 pr-4 whitespace-nowrap"><StatusPill tone={CONNECTION_STATUS[t.status].tone} label={CONNECTION_STATUS[t.status].label} /></td>
                <td className="py-2.5 pr-4 text-foreground-500 whitespace-nowrap">{t.scope}</td>
                <td className="py-2.5 pr-4 text-foreground-500 whitespace-nowrap">{ENVIRONMENT_LABELS[t.environment]}</td>
                <td className="py-2.5 whitespace-nowrap">
                  <span className={`text-xs font-label ${t.critical ? 'text-red-400' : 'text-foreground-500'}`}>{t.critical ? 'Critical' : 'Optional'}</span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}