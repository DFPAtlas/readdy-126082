import { useAudit } from '@/pages/ai-operations/audit/AuditContext';

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

export default function AuditKpis() {
  const { events, evidence } = useAudit();

  const countToday = events.filter((e) => e.timestamp.startsWith('2026-08-25')).length;
  const highRisk = events.filter((e) => e.risk === 'red' || e.severity === 'critical' || e.severity === 'high').length;
  const evidenceComplete = evidence.filter((e) => e.status === 'available' && e.integrityState === 'pass').length;
  const evidenceMissing = evidence.filter((e) => e.status === 'missing').length;
  const approvalDecisions = events.filter((e) => e.eventType === 'approval_decision').length;
  const policyBlocks = events.filter((e) => e.outcome === 'blocked').length;
  const verificationFailures = events.filter((e) => e.verification.required && e.verification.status === 'Failed').length;
  const reviewRequired = events.filter((e) => e.reviewRequired).length;

  const cards = [
    { label: 'Audit Events Today', value: countToday, icon: 'ri-file-list-3-line', accent: 'bg-accent-500/10 text-accent-400' },
    { label: 'High-Risk Events', value: highRisk, icon: 'ri-alarm-warning-line', accent: 'bg-red-500/10 text-red-400' },
    { label: 'Evidence Complete', value: evidenceComplete, icon: 'ri-checkbox-circle-line', accent: 'bg-emerald-500/10 text-emerald-400' },
    { label: 'Evidence Missing', value: evidenceMissing, icon: 'ri-file-warning-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Approval Decisions', value: approvalDecisions, icon: 'ri-shield-check-line', accent: 'bg-emerald-500/10 text-emerald-400' },
    { label: 'Policy Blocks', value: policyBlocks, icon: 'ri-forbid-line', accent: 'bg-red-500/10 text-red-400' },
    { label: 'Verification Failures', value: verificationFailures, icon: 'ri-close-circle-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Requiring Review', value: reviewRequired, icon: 'ri-file-search-line', accent: 'bg-secondary-500/10 text-secondary-300' },
  ];

  return (
    <section aria-label="Audit KPIs">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {cards.map((c) => (
          <KpiCard key={c.label} label={c.label} value={c.value} icon={c.icon} accent={c.accent} />
        ))}
      </div>
    </section>
  );
}