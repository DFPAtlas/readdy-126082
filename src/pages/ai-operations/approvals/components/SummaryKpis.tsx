import type { AiApproval } from '@/pages/ai-operations/types';

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

export default function SummaryKpis({ approvals }: { approvals: AiApproval[] }) {
  const awaitingReview = approvals.filter((a) => ['pending', 'under_review'].includes(a.status)).length;
  const highCritical = approvals.filter((a) => a.severity === 'high' || a.severity === 'critical').length;
  const expiringSoon = approvals.filter((a) => a.expiryState === 'expiring_soon').length;
  const approvedToday = approvals.filter((a) => a.decision.type === 'approve' || a.decision.type === 'approve_with_conditions').length;
  const rejectedToday = approvals.filter((a) => a.decision.type === 'reject').length;
  const moreInfo = approvals.filter((a) => a.status === 'more_info_required').length;
  const verification = approvals.filter((a) => a.status === 'verification_required').length;
  const uat = approvals.filter((a) => a.status === 'uat_required').length;

  const cards = [
    { label: 'Awaiting Review', value: awaitingReview, icon: 'ri-shield-check-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'High / Critical Risk', value: highCritical, icon: 'ri-error-warning-line', accent: 'bg-red-500/10 text-red-400' },
    { label: 'Expiring Soon', value: expiringSoon, icon: 'ri-timer-line', accent: 'bg-accent-500/10 text-accent-400' },
    { label: 'Approved Today', value: approvedToday, icon: 'ri-checkbox-circle-line', accent: 'bg-emerald-500/10 text-emerald-400' },
    { label: 'Rejected Today', value: rejectedToday, icon: 'ri-close-circle-line', accent: 'bg-red-500/10 text-red-400' },
    { label: 'More Info Required', value: moreInfo, icon: 'ri-question-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'Verification Required', value: verification, icon: 'ri-eye-line', accent: 'bg-amber-500/10 text-amber-400' },
    { label: 'UAT Required', value: uat, icon: 'ri-test-tube-line', accent: 'bg-accent-500/10 text-accent-400' },
  ];

  return (
    <section aria-label="Approval KPIs">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {cards.map((c) => (
          <KpiCard key={c.label} label={c.label} value={c.value} icon={c.icon} accent={c.accent} />
        ))}
      </div>
    </section>
  );
}