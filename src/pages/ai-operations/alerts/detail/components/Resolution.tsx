import type { AiAlert } from '@/pages/ai-operations/types';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5 border-b border-background-200/30 last:border-0">
      <dt className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-foreground-100 mt-1">{value || '—'}</dd>
    </div>
  );
}

export default function Resolution({ alert }: { alert: AiAlert }) {
  const r = alert.resolution;
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Resolution</h4>
      </div>
      <div className="px-4 py-2">
        <Row label="Resolution status" value={r.status} />
        <Row label="Resolution summary" value={r.summary} />
        <Row label="Root cause" value={r.rootCause} />
        <Row label="Fix reference" value={r.fixReference} />
        <Row label="Verification result" value={r.verificationResult} />
        <Row label="UAT result" value={r.uatResult} />
        <Row label="Closed by team" value={r.closedByTeam} />
        <Row label="Closed time" value={r.closedAt} />
      </div>
      <p className="px-4 pb-3 text-[11px] font-label text-foreground-600">Demo resolution data only.</p>
    </section>
  );
}