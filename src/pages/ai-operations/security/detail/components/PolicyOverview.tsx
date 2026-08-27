import type { AiSecurityPolicy } from '@/pages/ai-operations/types';
import { ENFORCEMENT_STAGE_LABELS } from '@/pages/ai-operations/constants';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-background-200/40 last:border-0">
      <span className="text-xs text-foreground-600 shrink-0 whitespace-nowrap">{label}</span>
      <span className="text-sm text-foreground-200 text-right">{value}</span>
    </div>
  );
}

export default function PolicyOverview({ policy }: { policy: AiSecurityPolicy }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Policy Overview</h3>

      <p className="text-sm text-foreground-300 mt-3 leading-relaxed">{policy.description}</p>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
        <Field label="Owner / team" value={policy.ownerTeam} />
        <Field label="Scope" value={policy.siteName} />
        <Field label="Effective date" value={policy.effectiveDate} />
        <Field label="Review date" value={policy.reviewDate} />
        <Field label="Audit requirement" value={policy.auditRequired ? 'Required' : 'Not required'} />
        <Field label="Exception policy" value={policy.exceptionAllowed ? 'Allowed (governed)' : 'Not allowed'} />
        <Field label="Enforcement stage" value={ENFORCEMENT_STAGE_LABELS[policy.enforcementStage]} />
      </div>

      {policy.notes && (
        <p className="text-xs text-foreground-500 mt-3 leading-relaxed">{policy.notes}</p>
      )}
    </section>
  );
}