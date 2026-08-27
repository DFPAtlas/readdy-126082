import type { AiApproval } from '@/pages/ai-operations/types';
import { REQUEST_TYPE_LABELS } from '@/pages/ai-operations/constants';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-background-200/40 last:border-0">
      <span className="text-xs text-foreground-600 shrink-0">{label}</span>
      <span className="text-xs text-foreground-300 text-right break-all">{value || '—'}</span>
    </div>
  );
}

export default function RequestedAction({ approval }: { approval: AiApproval }) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Requested Action</h3>
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
          <div>
            <Field label="Requested action" value={approval.requestedAction} />
            <Field label="Action category" value={approval.actionCategory} />
            <Field label="Request type" value={REQUEST_TYPE_LABELS[approval.requestType]} />
            <Field label="Requested by" value={approval.requestedBy} />
            <Field label="Request time" value={approval.requestedAt} />
          </div>
          <div>
            <Field label="Agent" value={approval.agentName} />
            <Field label="Site" value={approval.siteName} />
            <Field label="Run" value={approval.runId ?? '—'} />
            <Field label="Trigger / source" value="Approval workflow" />
            <Field label="Current state" value={approval.status.replace(/_/g, ' ')} />
          </div>
        </div>
        <div className="pt-4 mt-2 border-t border-background-200/40">
          <p className="text-xs font-label text-foreground-600 mb-1">Business justification</p>
          <p className="text-sm text-foreground-300">{approval.businessJustification || '—'}</p>
        </div>
      </div>
    </section>
  );
}