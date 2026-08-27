import { Link } from 'react-router-dom';
import type { ToolConnection } from '@/pages/ai-operations/types';
import { CONNECTION_STATUS, ENVIRONMENT_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function SiteUsage({ connection }: { connection: ToolConnection }) {
  const { siteUsage } = connection;

  if (siteUsage.length === 0) {
    return (
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Site Usage</h3>
        <p className="text-sm text-foreground-500">No registered sites currently use this connection.</p>
      </section>
    );
  }

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Site Usage</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-2 py-2 font-medium">Site</th>
              <th className="px-2 py-2 font-medium">Environment</th>
              <th className="px-2 py-2 font-medium">Usage purpose</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Criticality</th>
              <th className="px-2 py-2 font-medium text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {siteUsage.map((u) => {
              const status = CONNECTION_STATUS[u.status];
              return (
                <tr key={u.siteId} className="border-t border-background-200/40">
                  <td className="px-2 py-2.5 font-medium text-foreground-200 whitespace-nowrap">{u.siteName}</td>
                  <td className="px-2 py-2.5 text-foreground-500 whitespace-nowrap">{ENVIRONMENT_LABELS[u.environment]}</td>
                  <td className="px-2 py-2.5 text-foreground-400 whitespace-nowrap">{u.purpose}</td>
                  <td className="px-2 py-2.5"><StatusPill tone={status.tone} label={status.label} /></td>
                  <td className="px-2 py-2.5">
                    <span className={`text-xs font-label whitespace-nowrap ${u.critical ? 'text-red-400' : 'text-foreground-500'}`}>{u.critical ? 'Critical' : 'Optional'}</span>
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <Link
                      to={`/ai-operations/sites/${u.siteId}`}
                      className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 cursor-pointer whitespace-nowrap"
                    >
                      Open Site
                      <i className="ri-arrow-right-line text-sm w-4 h-4 flex items-center justify-center"></i>
                    </Link>
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