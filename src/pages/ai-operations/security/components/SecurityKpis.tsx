import type { AiSecurityPolicy } from '@/pages/ai-operations/types';
import { countAgentsGoverned } from '@/pages/ai-operations/security/selectors';
import { demoPolicyViolations, demoPolicyExceptions } from '@/mocks/ai-operations-security';

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

export default function SecurityKpis({ policies }: { policies: AiSecurityPolicy[] }) {
  const active = policies.filter((p) => p.status === 'active').length;
  const critical = policies.filter((p) => p.priority === 'critical' && p.status === 'active').length;
  const violations = demoPolicyViolations.length;
  const blocked = demoPolicyViolations.filter((v) => v.result === 'Blocked').length;
  const agents = countAgentsGoverned();
  const approvalRequired = policies.filter((p) => p.approvalRequired).length;
  const reviewRequired = policies.filter((p) => p.status === 'review_required').length;
  const exceptions = demoPolicyExceptions.length;

  const cards = [
    { label: 'Active Policies', value: active, icon: 'ri-shield-check-line', accent: 'bg-emerald-500/10 text-emerald-400' },
    { label: 'Critical Policies', value: critical, icon: 'ri-shield-flash-line', accent: 'bg-red-500/10 text-red-400' },
    { label: 'Policy Violations', value: violations, icon: 'ri-error-warning-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Blocked Actions', value: blocked, icon: 'ri-forbid-line', accent: 'bg-red-500/10 text-red-400' },
    { label: 'Agents Governed', value: agents, icon: 'ri-robot-2-line', accent: 'bg-accent-500/10 text-accent-400' },
    { label: 'Approval Required', value: approvalRequired, icon: 'ri-user-star-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Review Required', value: reviewRequired, icon: 'ri-file-search-line', accent: 'bg-secondary-500/10 text-secondary-300' },
    { label: 'Security Exceptions', value: exceptions, icon: 'ri-key-2-line', accent: 'bg-accent-500/10 text-accent-400' },
  ];

  return (
    <section aria-label="Security KPIs">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {cards.map((c) => (
          <KpiCard key={c.label} label={c.label} value={c.value} icon={c.icon} accent={c.accent} />
        ))}
      </div>
    </section>
  );
}