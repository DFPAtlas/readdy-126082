import { Link } from 'react-router-dom';
import { useAudit } from '@/pages/ai-operations/audit/AuditContext';
import { EVIDENCE_TYPE_LABELS, EVIDENCE_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function EvidenceRegistry() {
  const { evidence, getEvent } = useAudit();

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Evidence Registry</h3>
        <span className="text-[11px] font-label text-foreground-600">{evidence.length} items</span>
      </div>

      <p className="px-4 pt-3 text-[11px] font-label text-foreground-600">Evidence file storage is not connected yet — metadata references only.</p>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Evidence ID</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Related Record</th>
              <th className="px-4 py-2.5 font-medium">Site</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Integrity</th>
              <th className="px-4 py-2.5 font-medium">Required</th>
              <th className="px-4 py-2.5 font-medium text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {evidence.map((ev) => {
              const status = EVIDENCE_STATUS[ev.status];
              const relatedEvent = ev.relatedRecordId ? getEvent(ev.relatedRecordId) : undefined;
              const siteName = relatedEvent?.siteName ?? '—';
              return (
                <tr key={ev.id} className="border-b border-background-200/30 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                  <td className="px-4 py-3 font-mono text-xs text-foreground-300 whitespace-nowrap">{ev.id}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{EVIDENCE_TYPE_LABELS[ev.type]}</td>
                  <td className="px-4 py-3">
                    {ev.relatedRecordId ? (
                      <Link to={`/ai-operations/audit/${ev.relatedRecordId}`} className="font-mono text-xs text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap">
                        {ev.relatedRecordId}
                      </Link>
                    ) : (
                      <span className="text-foreground-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{siteName}</td>
                  <td className="px-4 py-3 text-foreground-400 whitespace-nowrap">{ev.timestamp}</td>
                  <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} /></td>
                  <td className="px-4 py-3">
                    {ev.integrityState === 'pass' ? (
                      <StatusPill tone="emerald" label="Pass" />
                    ) : ev.integrityState === 'warning' ? (
                      <StatusPill tone="amber" label="Warning" />
                    ) : (
                      <StatusPill tone="secondary" label={ev.integrityState} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{ev.required ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={ev.relatedRecordId ? `/ai-operations/audit/${ev.relatedRecordId}` : '/ai-operations/audit'}
                      className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Open
                      <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden divide-y divide-background-200/40">
        {evidence.map((ev) => {
          const status = EVIDENCE_STATUS[ev.status];
          return (
            <div key={ev.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-foreground-100">{ev.title}</p>
                  <p className="text-[10px] font-label text-foreground-600 mt-0.5">{EVIDENCE_TYPE_LABELS[ev.type]} · {ev.timestamp}</p>
                </div>
                <StatusPill tone={status.tone} label={status.label} />
              </div>
              <div className="mt-2 flex items-center gap-3 text-[11px] font-label text-foreground-500 flex-wrap">
                <span className="font-mono">{ev.id}</span>
                <span>{ev.integrityState === 'pass' ? 'Integrity: Pass' : `Integrity: ${ev.integrityState}`}</span>
                <span>{ev.required ? 'Required' : 'Optional'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}