import type { AiAuditEvent } from '@/pages/ai-operations/types';
import { ENVIRONMENT_LABELS, ACTOR_TYPE_LABELS, RISK_CLASS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5 border-b border-background-200/30 last:border-0">
      <dt className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-foreground-100 mt-1">{value || '—'}</dd>
    </div>
  );
}

export default function EventSummary({ event }: { event: AiAuditEvent }) {
  const risk = RISK_CLASS[event.risk];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Event Summary</h4>
      </div>
      <div className="px-4 py-2">
        <Row label="Action" value={event.action} />
        <Row label="Trigger / source" value={event.triggerSource} />
        <div className="py-2.5 border-b border-background-200/30 flex items-center justify-between gap-3">
          <dt className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Risk</dt>
          <dd><StatusPill tone={risk.tone} label={risk.label} /></dd>
        </div>
        <Row label="Environment" value={ENVIRONMENT_LABELS[event.environment]} />
        <Row label="Actor" value={`${event.agentName || event.actorTeam} (${ACTOR_TYPE_LABELS[event.actorType]})`} />
        <Row label="Actor team" value={event.actorTeam} />
        <Row label="Correlation ID" value={event.correlationId} />
        <Row label="Decision summary" value={event.decisionReason} />
      </div>
      <p className="px-4 pb-3 text-[11px] font-label text-foreground-600">Sanitised summary — no raw payloads or secrets.</p>
    </section>
  );
}