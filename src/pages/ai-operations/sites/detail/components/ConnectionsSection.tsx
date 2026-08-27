import { Link } from 'react-router-dom';
import type { SiteConnection } from '@/pages/ai-operations/types';
import { CONNECTION_STATUS, ENVIRONMENT_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import { resolveConnectionId } from '@/pages/ai-operations/tools/connectionRefs';

interface ConnectionsSectionProps {
  connections: SiteConnection[];
}

const PROVIDER_ICONS: Record<string, string> = {
  Supabase: 'ri-database-2-line',
  n8n: 'ri-flow-chart',
  GitHub: 'ri-github-fill',
  Readdy: 'ri-radar-line',
  Billing: 'ri-bank-card-line',
  Email: 'ri-mail-line',
  Authentication: 'ri-shield-keyhole-line',
  Hosting: 'ri-server-line',
};

export default function ConnectionsSection({ connections }: ConnectionsSectionProps) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Infrastructure &amp; Connections</h3>

      {connections.length === 0 ? (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
          <p className="text-sm text-foreground-500">No connections configured.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {connections.map((conn) => {
            const status = CONNECTION_STATUS[conn.status];
            const connectionId = resolveConnectionId(conn.provider);
            return (
              <div key={`${conn.provider}-${conn.reference}`} className="bg-background-100 border border-background-200/60 rounded-lg p-4 hover:border-background-300/60 transition-colors duration-150">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-background-50 border border-background-200/60 flex items-center justify-center shrink-0">
                    <i className={`${PROVIDER_ICONS[conn.provider] ?? 'ri-plug-2-line'} text-sm text-foreground-300 w-4 h-4 flex items-center justify-center`}></i>
                  </div>
                  <StatusPill tone={status.tone} label={status.label} />
                </div>
                <p className="text-sm font-medium text-foreground-200">{conn.provider}</p>
                <p className="text-[11px] font-label text-foreground-600 mt-0.5 break-all">{conn.reference}</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-background-200/40 text-[11px] font-label text-foreground-500">
                  <span className="whitespace-nowrap">{ENVIRONMENT_LABELS[conn.environment]}</span>
                  <span className="whitespace-nowrap">{conn.lastChecked}</span>
                </div>
                <p className="text-[11px] font-label text-foreground-600 mt-2 whitespace-nowrap">{conn.configurationState}</p>
                {connectionId && (
                  <Link
                    to={`/ai-operations/tools/${connectionId}`}
                    className="inline-flex items-center gap-1 mt-2 text-xs font-label text-accent-400 hover:text-accent-300 cursor-pointer whitespace-nowrap"
                  >
                    Open Connection
                    <i className="ri-arrow-right-line text-sm w-4 h-4 flex items-center justify-center"></i>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}