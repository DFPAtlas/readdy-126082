import type { AiTaskRun } from '@/pages/ai-operations/types';
import { TRIGGER_SOURCE_LABELS, TASK_TYPE_LABELS } from '@/pages/ai-operations/constants';

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-background-200/40 last:border-0">
      <span className="text-xs text-foreground-600 shrink-0">{label}</span>
      <span className="text-xs text-foreground-300 text-right font-mono break-all">{value}</span>
    </div>
  );
}

export default function RunOverview({ run }: { run: AiTaskRun }) {
  const progress = run.totalSteps > 0 ? Math.round((run.currentStep / run.totalSteps) * 100) : run.status === 'completed' ? 100 : 0;

  const cards = [
    { label: 'Status', value: run.status.replace(/_/g, ' '), tone: run.status === 'completed' ? 'text-emerald-400' : run.status === 'failed' || run.status === 'blocked' ? 'text-red-400' : run.status === 'working' ? 'text-accent-400' : 'text-foreground-200' },
    { label: 'Progress', value: `${progress}%`, tone: 'text-foreground-200' },
    { label: 'Duration', value: run.duration, tone: 'text-foreground-200' },
    { label: 'Attempts', value: `${run.attempts} / ${run.maxAttempts}`, tone: 'text-foreground-200' },
    { label: 'Retry Count', value: String(run.retryCount), tone: 'text-foreground-200' },
    { label: 'Estimated Cost', value: run.estimatedCost, tone: 'text-foreground-200' },
    { label: 'Approval State', value: run.approval.approvalState, tone: run.approval.approvalState === 'Pending' ? 'text-amber-400' : 'text-foreground-200' },
    { label: 'UAT State', value: run.uat.uatStatus, tone: run.uat.uatStatus === 'Failing' ? 'text-red-400' : 'text-foreground-200' },
  ];

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Overview</h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-background-100 border border-background-200/60 rounded-lg p-3.5">
            <p className={`text-lg font-heading font-bold ${c.tone} capitalize`}>{c.value}</p>
            <p className="text-[11px] font-label text-foreground-600 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <h4 className="text-xs font-label font-semibold text-foreground-300 uppercase tracking-wide mb-2">Run Details</h4>
          <MetaRow label="Requested by" value={run.requestedBy} />
          <MetaRow label="Trigger source" value={TRIGGER_SOURCE_LABELS[run.triggerSource]} />
          <MetaRow label="Agent" value={run.agentName} />
          <MetaRow label="Site" value={run.siteName} />
          <MetaRow label="Task type" value={TASK_TYPE_LABELS[run.taskType]} />
          <MetaRow label="Created" value={run.createdTime} />
          <MetaRow label="Started" value={run.startedTime} />
          <MetaRow label="Finished" value={run.completedTime} />
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <h4 className="text-xs font-label font-semibold text-foreground-300 uppercase tracking-wide mb-2">Correlation &amp; Lineage</h4>
          <MetaRow label="Correlation ID" value={run.correlationId} />
          <MetaRow label="Parent task" value={run.parentTaskId ?? '—'} />
          <MetaRow label="Parent run" value={run.parentRunId ?? '—'} />
          <MetaRow label="Root run" value={run.rootRunId ?? '—'} />
          <MetaRow label="Autonomy" value={run.autonomy.replace(/_/g, ' ')} />
          <MetaRow label="Current step" value={`${run.currentStep} of ${run.totalSteps}`} />
          <MetaRow label="Verification" value={run.verificationRequired ? 'Required' : 'Not required'} />
          <MetaRow label="Audit" value={run.auditRequired ? 'Required' : 'Not required'} />
        </div>
      </div>
    </section>
  );
}