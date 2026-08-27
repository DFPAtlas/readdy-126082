import type { SiteDependency } from '@/pages/ai-operations/types';
import { DEPENDENCY_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

interface DependenciesSectionProps {
  dependencies: SiteDependency[];
}

export default function DependenciesSection({ dependencies }: DependenciesSectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Dependencies</h3>

      {dependencies.length === 0 ? (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
          <p className="text-sm text-foreground-500">No dependencies listed.</p>
        </div>
      ) : (
        <div className="bg-background-100 border border-background-200/60 rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-center">Critical</th>
                  <th className="px-4 py-3 font-medium">Last Checked</th>
                </tr>
              </thead>
              <tbody>
                {dependencies.map((dep) => {
                  const status = DEPENDENCY_STATUS[dep.status];
                  return (
                    <tr key={dep.name} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                      <td className="px-4 py-3 font-medium text-foreground-200 whitespace-nowrap">{dep.name}</td>
                      <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{dep.type}</td>
                      <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} /></td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-label whitespace-nowrap ${dep.critical ? 'text-red-400' : 'text-foreground-600'}`}>
                          {dep.critical ? 'Critical' : 'Non-critical'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{dep.lastChecked}</td>
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