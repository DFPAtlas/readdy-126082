import type { AiAlert } from '@/pages/ai-operations/types';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5 border-b border-background-200/30 last:border-0">
      <dt className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-foreground-100 mt-1">{value || '—'}</dd>
    </div>
  );
}

export default function IncidentSummary({ alert }: { alert: AiAlert }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Incident Summary</h4>
      </div>
      <div className="px-4 py-2">
        <Row label="Description" value={alert.description} />
        <Row label="Trigger / source" value={alert.triggerSource} />
        <Row label="Impact" value={alert.impact} />
        <Row label="Affected service" value={alert.affectedService} />
        <Row label="Assigned team" value={alert.assignedTeam} />
        <Row label="Escalation team" value={alert.escalationTeam} />
        <Row label="Current state" value={alert.status.replace(/_/g, ' ')} />
        <Row label="Suggested next action" value={alert.suggestedAction} />
      </div>
    </section>
  );
}