import type { AiAuditEvent } from '@/pages/ai-operations/types';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-background-200/30 last:border-0">
      <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-foreground-100 text-right">{value || '—'}</span>
    </div>
  );
}

export default function UatEvidence({ event }: { event: AiAuditEvent }) {
  const u = event.uat;

  if (!u.required) {
    return (
      <section className="bg-background-100 border border-background-200/60 rounded-lg">
        <div className="px-4 py-3 border-b border-background-200/60">
          <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">UAT Evidence</h4>
        </div>
        <p className="px-4 py-6 text-sm text-foreground-500">UAT not required for this event.</p>
      </section>
    );
  }

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">UAT Evidence</h4>
      </div>
      <div className="px-4 py-2">
        <Row label="UAT reference" value={u.reference} />
        <Row label="Tests passed" value={String(u.testsPassed)} />
        <Row label="Tests failed" value={String(u.testsFailed)} />
        <div className="flex items-center justify-between gap-3 py-2.5 border-b border-background-200/30">
          <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Blocking failures</span>
          <span className={`text-sm font-medium ${u.blockingFailures ? 'text-red-400' : 'text-emerald-400'}`}>{u.blockingFailures ? 'Yes' : 'No'}</span>
        </div>
        <div className="flex items-center justify-between gap-3 py-2.5 border-b border-background-200/30">
          <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Final status</span>
          <span className={`text-sm font-medium ${u.finalStatus === 'Passed' ? 'text-emerald-400' : u.finalStatus === 'Failed' ? 'text-red-400' : 'text-foreground-100'}`}>{u.finalStatus}</span>
        </div>
      </div>
    </section>
  );
}