import type { SiteRegistryRecord } from '@/pages/ai-operations/types';
import { ENVIRONMENT_LABELS, RISK_LEVEL } from '@/pages/ai-operations/constants';

interface OverviewSectionProps {
  site: SiteRegistryRecord;
}

const KPI_ICONS: Record<string, string> = {
  'Active Agents': 'ri-robot-2-line',
  'Jobs Today': 'ri-stack-line',
  'Failed Runs': 'ri-error-warning-line',
  Alerts: 'ri-alert-line',
  'Pending Approvals': 'ri-shield-check-line',
  'Support Tickets': 'ri-ticket-2-line',
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-foreground-200 mt-0.5 break-words">{value || '—'}</p>
    </div>
  );
}

export default function OverviewSection({ site }: OverviewSectionProps) {
  const kpis = [
    { label: 'Active Agents', value: site.activeAgentCount, accent: 'bg-accent-500/10 text-accent-400' },
    { label: 'Jobs Today', value: site.currentJobs, accent: 'bg-accent-500/10 text-accent-400' },
    { label: 'Failed Runs', value: site.failedJobs, accent: 'bg-red-500/10 text-red-400' },
    { label: 'Alerts', value: site.openAlerts, accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Pending Approvals', value: site.pendingApprovals, accent: 'bg-emerald-500/10 text-emerald-400' },
    { label: 'Support Tickets', value: site.openTickets, accent: 'bg-emerald-500/10 text-emerald-400' },
  ];

  const crit = RISK_LEVEL[site.criticality];

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Overview</h3>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-background-100 border border-background-200/60 rounded-lg p-4 hover:border-background-300/60 transition-colors duration-150">
            <div className="flex items-center justify-between mb-3 gap-2">
              <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{kpi.label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${kpi.accent}`}>
                <i className={`${KPI_ICONS[kpi.label]} text-sm w-4 h-4 flex items-center justify-center`}></i>
              </div>
            </div>
            <p className="text-2xl font-heading font-bold text-foreground-100">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-background-100 border border-background-200/60 rounded-lg p-5 space-y-4">
        <div>
          <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide">Description</p>
          <p className="text-sm text-foreground-300 mt-1 leading-relaxed max-w-3xl">{site.description}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <Field label="Owner / Team" value={site.ownerTeam} />
          <Field label="Environment" value={ENVIRONMENT_LABELS[site.environment]} />
          <Field label="Criticality" value={crit.label} />
          <Field label="Repository" value={site.repository} />
          <Field label="Readdy Project" value={site.readdyProject} />
          <Field label="Supabase Project" value={site.supabaseProject} />
          <Field label="n8n Connection" value={site.n8nConnection} />
          <Field label="Last Health Check" value={site.lastHealthCheck} />
          <Field label="Last AI Activity" value={site.lastAgentActivity} />
          <Field label="Open Alerts" value={String(site.openAlerts)} />
          <Field label="Open Support Tickets" value={String(site.openTickets)} />
          <Field label="UAT Status" value={site.uatStatus} />
        </div>

        {site.notes && (
          <div className="border-t border-background-200/60 pt-4">
            <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide">Notes</p>
            <p className="text-sm text-foreground-400 mt-1">{site.notes}</p>
          </div>
        )}
      </div>
    </section>
  );
}