import type { KnowledgeSource } from '@/pages/ai-operations/types';
import { REVIEW_STATE, KNOWLEDGE_SOURCE_TYPE_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function Overview({ source }: { source: KnowledgeSource }) {
  const review = REVIEW_STATE[source.reviewState];

  const rows = [
    { label: 'Owner / team', value: source.ownerTeam },
    { label: 'Source / reference', value: source.reference, mono: true },
    { label: 'Content format', value: source.contentFormat },
    { label: 'Version', value: source.version, mono: true },
    { label: 'Created', value: source.createdAt },
    { label: 'Updated', value: source.updatedAt },
    { label: 'Last reviewed', value: source.lastReviewed },
    { label: 'Next review', value: source.nextReview },
    { label: 'Trusted source', value: source.trustedSource ? 'Yes' : 'No' },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Overview</h3>
        <StatusPill tone={review.tone} label={`Review: ${review.label}`} />
      </div>

      <p className="text-sm text-foreground-300 mt-3 leading-relaxed">{source.description}</p>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-background-200/40 pb-2">
            <span className="text-xs font-label text-foreground-600 whitespace-nowrap">{r.label}</span>
            <span className={`text-sm text-foreground-200 text-right ${r.mono ? 'font-mono' : ''}`}>{r.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Type:</span>
        <span className="inline-flex items-center text-[11px] font-label px-2 py-0.5 rounded-full bg-secondary-500/10 text-secondary-300">
          {KNOWLEDGE_SOURCE_TYPE_LABELS[source.type]}
        </span>
        <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide ml-2">Sensitivity:</span>
        <span className="inline-flex items-center text-[11px] font-label px-2 py-0.5 rounded-full bg-background-50 border border-background-200/60 text-foreground-300">
          {source.sensitivity}
        </span>
      </div>

      {source.notes && <p className="text-xs text-foreground-500 mt-3 leading-relaxed">{source.notes}</p>}

      <p className="text-[11px] font-label text-foreground-600 mt-3">
        Raw sensitive document content is never displayed — only safe metadata and references.
      </p>
    </section>
  );
}