import type { AiAlert } from '@/pages/ai-operations/types';
import { ESCALATION_LEVEL_LABELS } from '@/pages/ai-operations/constants';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5 border-b border-background-200/30 last:border-0">
      <dt className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-foreground-100 mt-1">{value || '—'}</dd>
    </div>
  );
}

export default function Escalation({ alert }: { alert: AiAlert }) {
  const e = alert.escalation;
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Escalation</h4>
      </div>
      <div className="px-4 py-2">
        <Row label="Current level" value={ESCALATION_LEVEL_LABELS[e.level]} />
        <Row label="Assigned team" value={e.assignedTeam} />
        <Row label="Escalation reason" value={e.reason} />
        <Row label="Escalated time" value={e.escalatedAt} />
        <Row label="Next escalation" value={e.nextEscalation} />
      </div>
      <p className="px-4 pb-3 text-[11px] font-label text-foreground-600">No messages are sent by escalation updates.</p>
    </section>
  );
}