import type { KnowledgeSource } from '@/pages/ai-operations/types';

export default function SourceGovernance({ source }: { source: KnowledgeSource }) {
  const g = source.governance;

  const rows = [
    { label: 'Trusted source', value: g.trustedSource ? 'Yes' : 'No' },
    { label: 'Source owner', value: g.owner },
    { label: 'Review required', value: g.reviewRequired ? 'Yes' : 'No' },
    { label: 'Review frequency', value: g.reviewFrequency },
    { label: 'Last reviewer / team', value: g.lastReviewer },
    { label: 'Version control', value: g.versionControl },
    { label: 'Expiry / review date', value: g.expiryDate },
    { label: 'Audit required', value: g.auditRequired ? 'Enabled' : 'Not required' },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Source Governance</h3>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-background-200/40 pb-2">
            <span className="text-xs font-label text-foreground-600 whitespace-nowrap">{r.label}</span>
            <span className="text-sm text-foreground-200 text-right">{r.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}