import { Link } from 'react-router-dom';
import type { SiteRegistryRecord } from '@/pages/ai-operations/types';
import { SITE_STATUS, AI_STATUS, ENVIRONMENT_LABELS, BUSINESS_TYPE_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

interface RegistryTableProps {
  sites: SiteRegistryRecord[];
}

export default function RegistryTable({ sites }: RegistryTableProps) {
  if (sites.length === 0) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center">
        <i className="ri-global-line text-3xl text-foreground-600 w-8 h-8 flex items-center justify-center mx-auto"></i>
        <p className="text-sm text-foreground-400 mt-3">No sites match the current filters.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block bg-background-100 border border-background-200/60 rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Site</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Env</th>
                <th className="px-4 py-3 font-medium">Operational</th>
                <th className="px-4 py-3 font-medium">AI</th>
                <th className="px-4 py-3 font-medium text-center">Agents</th>
                <th className="px-4 py-3 font-medium text-center">Alerts</th>
                <th className="px-4 py-3 font-medium">UAT</th>
                <th className="px-4 py-3 font-medium">Last Activity</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => {
                const op = SITE_STATUS[site.operationalStatus];
                const ai = AI_STATUS[site.aiStatus];
                return (
                  <tr key={site.id} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground-200 whitespace-nowrap">{site.name}</p>
                      <p className="text-[11px] font-label text-foreground-600 whitespace-nowrap">{site.domain}</p>
                    </td>
                    <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{BUSINESS_TYPE_LABELS[site.businessType]}</td>
                    <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{ENVIRONMENT_LABELS[site.environment]}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={op.tone} label={op.label} pulse={site.operationalStatus === 'critical'} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={ai.tone} label={ai.label} />
                    </td>
                    <td className="px-4 py-3 text-center text-foreground-300 font-label">{site.activeAgentCount}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-label ${site.openAlerts > 0 ? 'text-amber-400 font-medium' : 'text-foreground-600'}`}>{site.openAlerts}</span>
                    </td>
                    <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{site.uatStatus}</td>
                    <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{site.lastAgentActivity}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/ai-operations/sites/${site.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                      >
                        Open
                        <i className="ri-arrow-right-line text-xs w-4 h-4 flex items-center justify-center"></i>
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
        {sites.map((site) => {
          const op = SITE_STATUS[site.operationalStatus];
          const ai = AI_STATUS[site.aiStatus];
          return (
            <div key={site.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground-200">{site.name}</p>
                  <p className="text-[11px] font-label text-foreground-600">{site.domain}</p>
                </div>
                <StatusPill tone={op.tone} label={op.label} pulse={site.operationalStatus === 'critical'} />
              </div>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <StatusPill tone={ai.tone} label={ai.label} />
                <span className="text-[11px] font-label text-foreground-600">{BUSINESS_TYPE_LABELS[site.businessType]} · {ENVIRONMENT_LABELS[site.environment]}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div className="bg-background-50 rounded-md py-2">
                  <p className="text-sm font-heading font-bold text-foreground-100">{site.activeAgentCount}</p>
                  <p className="text-[10px] font-label text-foreground-600">Agents</p>
                </div>
                <div className="bg-background-50 rounded-md py-2">
                  <p className={`text-sm font-heading font-bold ${site.openAlerts > 0 ? 'text-amber-400' : 'text-foreground-100'}`}>{site.openAlerts}</p>
                  <p className="text-[10px] font-label text-foreground-600">Alerts</p>
                </div>
                <div className="bg-background-50 rounded-md py-2">
                  <p className="text-sm font-heading font-bold text-foreground-100">{site.uatStatus}</p>
                  <p className="text-[10px] font-label text-foreground-600">UAT</p>
                </div>
              </div>

              <Link
                to={`/ai-operations/sites/${site.id}`}
                className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-2 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                Open AI Operations
                <i className="ri-arrow-right-line text-xs w-4 h-4 flex items-center justify-center"></i>
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}