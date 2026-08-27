import type { AiAlert } from '@/pages/ai-operations/types';
import { RECURRENCE_STATE } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-background-200/30 last:border-0">
      <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-foreground-100 text-right">{value}</span>
    </div>
  );
}

export default function Recurrence({ alert }: { alert: AiAlert }) {
  const r = alert.recurrence;
  const trend = RECURRENCE_STATE[r.trendState];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Repeated Incident Detection</h4>
      </div>
      <div className="px-4 py-2">
        <div className="flex items-center justify-between gap-3 py-2.5 border-b border-background-200/30">
          <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Trend state</span>
          <StatusPill tone={trend.tone} label={trend.label} />
        </div>
        <Row label="Recurrence count" value={r.recurrenceCount} />
        <Row label="First seen" value={r.firstSeen} />
        <Row label="Last seen" value={r.lastSeen} />
        <Row label="Known issue reference" value={r.knownIssueRef || '—'} />
        {r.relatedIncidentIds.length > 0 && (
          <div className="py-2.5 border-b border-background-200/30 last:border-0">
            <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Related incident IDs</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {r.relatedIncidentIds.map((id) => (
                <span key={id} className="text-xs font-mono text-foreground-300 bg-background-50 border border-background-200/60 rounded-md px-2 py-0.5">
                  {id}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}