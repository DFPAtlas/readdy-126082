import type { AiSchedule } from '@/pages/ai-operations/types';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-background-200/40 last:border-0">
      <span className="text-xs font-label text-foreground-500 whitespace-nowrap">{label}</span>
      <span className="text-sm text-foreground-100 text-right">{value || '—'}</span>
    </div>
  );
}

export default function RetryFailure({ schedule }: { schedule: AiSchedule }) {
  const r = schedule.retry;
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Retry &amp; Failure Policy</h3>
      </div>
      <div className="p-4">
        <Row label="Max retries" value={`${r.maxRetries}`} />
        <Row label="Retry delay" value={r.retryDelay} />
        <Row label="Backoff strategy" value={r.backoffStrategy} />
        <Row label="Failure escalation" value={r.failureEscalation} />
        <Row label="Fallback agent" value={r.fallbackAgent} />
        <Row label="Disable after repeated failure" value={r.disableAfterRepeatedFailure ? 'Yes' : 'No'} />
        <Row label="Create incident after threshold" value={r.createIncidentAfterThreshold ? 'Yes' : 'No'} />
        <Row label="Current failure count" value={`${schedule.failureCount}`} />
        <div className="pt-3">
          <p className="text-[11px] font-label text-foreground-600">
            Retry policy is metadata only — no retries actually execute in this demo.
          </p>
        </div>
      </div>
    </section>
  );
}