import type { AiOrchestration } from '@/pages/ai-operations/types';

export default function FailureStrategy({ orchestration }: { orchestration: AiOrchestration }) {
  const f = orchestration.failureStrategy;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Failure Strategy</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Policy</p>
          <p className="text-sm text-foreground-100 mt-0.5">{f.policy}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Failed step</p>
          <p className="text-sm text-foreground-300 mt-0.5">{f.failedStep || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Retry count</p>
          <p className="text-sm text-foreground-300 mt-0.5">{f.retryCount}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Fallback</p>
          <p className="text-sm text-foreground-300 mt-0.5">{f.fallback || '—'}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Next action</p>
          <p className="text-sm text-foreground-300 mt-0.5">{f.nextAction}</p>
        </div>
      </div>

      <p className="text-[11px] font-label text-foreground-600 mt-3">No retry or fallback action executes — demo policy only.</p>
    </section>
  );
}