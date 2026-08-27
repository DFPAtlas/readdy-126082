import type { ApprovalImpact } from '@/pages/ai-operations/types';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-background-200/40 last:border-0">
      <span className="text-xs text-foreground-600 shrink-0">{label}</span>
      <span className="text-xs text-foreground-300 text-right break-all">{value || '—'}</span>
    </div>
  );
}

export default function ImpactAssessment({ impact }: { impact: ApprovalImpact }) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Impact Assessment</h3>
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
          <div>
            <Row label="Systems affected" value={impact.systemsAffected} />
            <Row label="Sites affected" value={impact.sitesAffected} />
            <Row label="Users affected" value={impact.usersAffected} />
            <Row label="Records affected" value={impact.recordsAffected} />
            <Row label="Service interruption expected" value={impact.serviceInterruptionExpected ? 'Yes' : 'No'} />
          </div>
          <div>
            <Row label="Estimated downtime" value={impact.estimatedDowntime} />
            <Row label="Customer impact" value={impact.customerImpact} />
            <Row label="Financial impact" value={impact.financialImpact} />
            <Row label="Security impact" value={impact.securityImpact} />
            <Row label="Compliance impact" value={impact.complianceImpact} />
            <Row label="Reversibility" value={impact.reversibility} />
          </div>
        </div>
      </div>
    </section>
  );
}