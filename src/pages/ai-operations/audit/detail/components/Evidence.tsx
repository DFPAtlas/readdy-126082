import type { AiAuditEvent } from '@/pages/ai-operations/types';
import { useAudit } from '@/pages/ai-operations/audit/AuditContext';
import { EVIDENCE_TYPE_LABELS, EVIDENCE_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function Evidence({ event }: { event: AiAuditEvent }) {
  const { getEvidenceForEvent } = useAudit();
  const evidence = getEvidenceForEvent(event);

  if (evidence.length === 0) {
    return (
      <section className="bg-background-100 border border-background-200/60 rounded-lg">
        <div className="px-4 py-3 border-b border-background-200/60">
          <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Evidence</h4>
        </div>
        <p className="px-4 py-6 text-sm text-foreground-500">No evidence attached to this event.</p>
      </section>
    );
  }

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Evidence</h4>
        <span className="text-[11px] font-label text-foreground-600">{evidence.length} items</span>
      </div>
      <div className="divide-y divide-background-200/40">
        {evidence.map((ev) => {
          const status = EVIDENCE_STATUS[ev.status];
          return (
            <div key={ev.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-500 bg-background-200/50 border border-background-300/40 rounded-full px-2 py-0.5 whitespace-nowrap">
                      {EVIDENCE_TYPE_LABELS[ev.type]}
                    </span>
                    <span className="font-mono text-xs text-accent-400">{ev.id}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground-100 mt-1.5">{ev.title}</p>
                  <p className="text-[11px] font-label text-foreground-600 mt-1">{ev.source} · {ev.timestamp}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <StatusPill tone={status.tone} label={status.label} />
                  {ev.required && <span className="text-[11px] font-label text-foreground-500 whitespace-nowrap">Required</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="px-4 pb-3 text-[11px] font-label text-foreground-600">Evidence file storage is not connected yet — metadata references only.</p>
    </section>
  );
}