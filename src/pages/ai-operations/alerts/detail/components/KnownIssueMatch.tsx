import { Link } from 'react-router-dom';
import type { AiAlert } from '@/pages/ai-operations/types';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5 border-b border-background-200/30 last:border-0">
      <dt className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-foreground-100 mt-1">{value || '—'}</dd>
    </div>
  );
}

export default function KnownIssueMatch({ alert }: { alert: AiAlert }) {
  const k = alert.knownIssue;
  if (!k.knowledgeId) {
    return (
      <section className="bg-background-100 border border-background-200/60 rounded-lg">
        <div className="px-4 py-3 border-b border-background-200/60">
          <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Known Issue Match</h4>
        </div>
        <p className="px-4 py-4 text-sm text-foreground-500">No matching known issue / incident memory on record.</p>
      </section>
    );
  }

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Known Issue Match</h4>
        <Link
          to={`/ai-operations/knowledge/${k.knowledgeId}`}
          className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
        >
          Open Knowledge
          <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
        </Link>
      </div>
      <div className="px-4 py-2">
        <Row label="Match note" value={k.note} />
        <Row label="Previous root cause" value={k.previousRootCause} />
        <Row label="Previous resolution" value={k.previousResolution} />
        <Row label="Previous verification" value={k.previousVerification} />
      </div>
    </section>
  );
}