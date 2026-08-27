import type { AiAuditEvent, AuditIntegrityState, AuditIntegrityCheck } from '@/pages/ai-operations/types';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

function toneFor(state: AuditIntegrityState): 'emerald' | 'amber' | 'red' | 'secondary' {
  if (state === 'pass') return 'emerald';
  if (state === 'warning') return 'amber';
  if (state === 'fail') return 'red';
  return 'secondary';
}

export default function Integrity({ event }: { event: AiAuditEvent }) {
  // Demo integrity metadata — deterministic, no cryptographic signing.
  const checks: AuditIntegrityCheck[] = [
    { name: 'Event recorded', state: 'pass', note: 'Event present in registry.' },
    { name: 'Timestamp present', state: event.timestamp ? 'pass' : 'fail', note: event.timestamp ? 'Timestamp recorded.' : 'Timestamp missing.' },
    { name: 'Correlation ID present', state: event.correlationId ? 'pass' : 'fail', note: event.correlationId ? 'Correlation ID recorded.' : 'Correlation ID missing.' },
    { name: 'Related IDs valid', state: event.runId || event.approvalId || event.orchestrationId || event.alertId ? 'pass' : 'unknown', note: 'Referenced central IDs resolve.' },
    { name: 'Evidence linked', state: event.evidenceIds.length ? 'pass' : 'warning', note: event.evidenceIds.length ? `${event.evidenceIds.length} evidence item(s) linked.` : 'No evidence linked.' },
    { name: 'Approval reference valid', state: event.approvalId ? 'pass' : 'unknown', note: event.approvalId ? 'Approval reference recorded.' : 'No approval reference required.' },
    { name: 'Policy reference valid', state: event.policyId ? 'pass' : 'unknown', note: event.policyId ? 'Policy reference recorded.' : 'No policy reference required.' },
    { name: 'Record complete', state: event.integrityState, note: event.integrityState === 'pass' ? 'All required fields present.' : 'Review flagged fields.' },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Audit Integrity</h4>
      </div>
      <div className="divide-y divide-background-200/40">
        {checks.map((c) => (
          <div key={c.name} className="px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-foreground-100">{c.name}</p>
              <p className="text-[11px] font-label text-foreground-600 mt-0.5">{c.note}</p>
            </div>
            <StatusPill tone={toneFor(c.state)} label={c.state.toUpperCase()} />
          </div>
        ))}
      </div>
      <p className="px-4 pb-3 text-[11px] font-label text-foreground-600">Demo metadata only — no cryptographic signing yet.</p>
    </section>
  );
}