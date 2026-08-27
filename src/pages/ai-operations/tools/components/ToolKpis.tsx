import type { ToolConnection } from '@/pages/ai-operations/types';

function KpiCard({ label, value, icon, accent }: { label: string; value: string | number; icon: string; accent: string }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 hover:border-background-300/60 transition-colors duration-150">
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
          <i className={`${icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
        </div>
      </div>
      <p className="text-2xl font-heading font-bold text-foreground-100">{value}</p>
    </div>
  );
}

export default function ToolKpis({ connections }: { connections: ToolConnection[] }) {
  const connected = connections.filter((c) => c.status === 'connected').length;
  const degraded = connections.filter((c) => c.status === 'degraded').length;
  const disconnected = connections.filter((c) => ['disconnected', 'not_configured', 'disabled', 'error'].includes(c.status)).length;
  const restricted = connections.filter((c) => c.accessMode === 'restricted').length;
  const critical = connections.filter((c) => c.criticality === 'critical').length;
  const configIssues = connections.filter((c) => ['partial', 'missing', 'invalid'].includes(c.configurationState)).length;

  const agentsWithAccess = new Set<string>();
  connections.forEach((c) => c.agentAccess.forEach((a) => agentsWithAccess.add(a.agentId)));

  const cards = [
    { label: 'Total Connections', value: connections.length, icon: 'ri-plug-2-line', accent: 'bg-secondary-500/10 text-secondary-300' },
    { label: 'Connected', value: connected, icon: 'ri-checkbox-circle-line', accent: 'bg-emerald-500/10 text-emerald-400' },
    { label: 'Degraded', value: degraded, icon: 'ri-alert-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Disconnected', value: disconnected, icon: 'ri-plug-line', accent: 'bg-red-500/10 text-red-400' },
    { label: 'Restricted', value: restricted, icon: 'ri-shield-keyhole-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Agents With Tool Access', value: agentsWithAccess.size, icon: 'ri-robot-2-line', accent: 'bg-accent-500/10 text-accent-400' },
    { label: 'Critical Connections', value: critical, icon: 'ri-error-warning-line', accent: 'bg-red-500/10 text-red-400' },
    { label: 'Configuration Issues', value: configIssues, icon: 'ri-settings-3-line', accent: 'bg-amber-500/10 text-amber-400' },
  ];

  return (
    <section aria-label="Connection KPIs">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {cards.map((c) => (
          <KpiCard key={c.label} label={c.label} value={c.value} icon={c.icon} accent={c.accent} />
        ))}
      </div>
    </section>
  );
}