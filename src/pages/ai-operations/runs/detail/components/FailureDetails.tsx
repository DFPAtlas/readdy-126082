import type { AiTaskRun } from '@/pages/ai-operations/types';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-background-200/40 last:border-0">
      <span className="text-xs text-foreground-600 shrink-0">{label}</span>
      <span className="text-xs text-foreground-300 text-right break-all">{value || '—'}</span>
    </div>
  );
}

export default function FailureDetails({ run }: { run: AiTaskRun }) {
  const failure = run.failure;
  const retry = run.retry;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <section className="space-y-4">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Retry Model</h3>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <Field label="Retry allowed" value={retry.retryAllowed ? 'Yes' : 'No'} />
          <Field label="Retry count" value={String(retry.retryCount)} />
          <Field label="Maximum attempts" value={String(retry.maxAttempts)} />
          <Field label="Next retry" value={retry.nextRetry} />
          <Field label="Retry reason" value={retry.retryReason} />
          <Field label="Backoff strategy" value={retry.backoffStrategy} />
          <Field label="Requires approval" value={retry.requiresApproval ? 'Yes' : 'No'} />
        </div>
      </section>

      {failure && (
        <section className="space-y-4">
          <h3 className="text-sm font-label font-semibold text-red-400 uppercase tracking-wide">Failure Details</h3>
          <div className="bg-background-100 border border-red-500/20 rounded-lg p-4">
            <Field label="Error type" value={failure.errorType} />
            <Field label="Error code" value={failure.errorCode} />
            <Field label="Summary" value={failure.summary} />
            <Field label="Failed step" value={failure.failedStep} />
            <Field label="Retryable" value={failure.retryable ? 'Yes' : 'No'} />
            <Field label="Retry count" value={String(failure.retryCount)} />
            <Field label="Recommended action" value={failure.recommendedAction} />
            <Field label="Escalation required" value={failure.escalationRequired ? 'Yes' : 'No'} />
          </div>
        </section>
      )}
    </div>
  );
}