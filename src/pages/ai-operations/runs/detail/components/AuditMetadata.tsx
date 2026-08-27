import type { RunAuditMetadata } from '@/pages/ai-operations/types';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-background-200/40 last:border-0">
      <span className="text-xs text-foreground-600 shrink-0">{label}</span>
      <span className="text-xs text-foreground-300 text-right break-all">{value || '—'}</span>
    </div>
  );
}

export default function AuditMetadata({ audit }: { audit: RunAuditMetadata }) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Audit</h3>
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <Field label="Audit required" value={audit.auditRequired ? 'Yes' : 'No'} />
        <Field label="Audit status" value={audit.auditStatus} />
        <Field label="Created by" value={audit.createdBy} />
        <Field label="Created at" value={audit.createdAt} />
        <Field label="Last modified by" value={audit.lastModifiedBy} />
        <Field label="Last modified at" value={audit.lastModifiedAt} />
        <Field label="Completion evidence" value={audit.completionEvidence ? 'Available' : 'Not available'} />
        <Field label="Verification evidence" value={audit.verificationEvidence ? 'Available' : 'Not available'} />
      </div>
    </section>
  );
}