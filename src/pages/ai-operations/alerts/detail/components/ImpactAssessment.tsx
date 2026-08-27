import type { AiAlert } from '@/pages/ai-operations/types';

export default function ImpactAssessment({ alert }: { alert: AiAlert }) {
  const i = alert.impactAssessment;
  const rows = [
    { label: 'Users affected', value: i.usersAffected },
    { label: 'Sites affected', value: i.sitesAffected },
    { label: 'Service impact', value: i.serviceImpact },
    { label: 'Financial impact', value: i.financialImpact },
    { label: 'Security impact', value: i.securityImpact },
    { label: 'Compliance impact', value: i.complianceImpact },
    { label: 'Customer impact', value: i.customerImpact },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Impact Assessment</h4>
      </div>
      <div className="px-4 py-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        {rows.map((r) => (
          <div key={r.label} className="py-2.5 border-b border-background-200/30">
            <dt className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">{r.label}</dt>
            <dd className="text-sm text-foreground-100 mt-1">{r.value || '—'}</dd>
          </div>
        ))}
      </div>
      <p className="px-4 pb-3 text-[11px] font-label text-foreground-600">Demo impact metadata only.</p>
    </section>
  );
}