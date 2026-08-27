import type { AiAlert } from '@/pages/ai-operations/types';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5 border-b border-background-200/30 last:border-0">
      <dt className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-foreground-100 mt-1">{value || '—'}</dd>
    </div>
  );
}

export default function DiagnosticsSummary({ alert }: { alert: AiAlert }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Diagnostics Summary</h4>
      </div>
      <div className="px-4 py-2">
        <Row label="Suspected cause" value={alert.diagnostics.suspectedCause} />
        <Row label="Affected component" value={alert.diagnostics.affectedComponent} />
        <Row label="Related failures" value={alert.diagnostics.relatedFailures} />
        <Row label="Confidence" value={alert.diagnostics.confidence} />
        <Row label="Known-issue match" value={alert.diagnostics.knownIssueMatch} />
        <Row label="Recommended investigation" value={alert.diagnostics.recommendedInvestigation} />
      </div>
      <p className="px-4 pb-3 text-[11px] font-label text-foreground-600">
        Diagnostics are demo summaries only — no hidden chain-of-thought or raw logs are exposed.
      </p>
    </section>
  );
}