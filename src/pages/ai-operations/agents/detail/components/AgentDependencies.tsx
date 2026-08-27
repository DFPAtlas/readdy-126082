import type { AgentDependency } from '@/pages/ai-operations/types';
import { DEPENDENCY_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function AgentDependencies({ dependencies }: { dependencies: AgentDependency[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Agent Dependencies</h3>
        <span className="text-xs font-label text-foreground-600">{dependencies.length} dependencies</span>
      </div>

      {dependencies.length === 0 ? (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
          <p className="text-sm text-foreground-500">No dependencies defined yet.</p>
        </div>
      ) : (
        <div className="bg-background-100 border border-background-200/60 rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Dependency</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Criticality</th>
                  <th className="px-4 py-3 font-medium">Last Checked</th>
                </tr>
              </thead>
              <tbody>
                {dependencies.map((d) => {
                  const status = DEPENDENCY_STATUS[d.status];
                  return (
                    <tr key={d.name} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                      <td className="px-4 py-3 font-medium text-foreground-200 whitespace-nowrap">{d.name}</td>
                      <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} /></td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-label whitespace-nowrap ${d.critical ? 'text-red-400' : 'text-foreground-500'}`}>
                          {d.critical ? 'Critical' : 'Non-critical'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{d.lastChecked}</td>
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