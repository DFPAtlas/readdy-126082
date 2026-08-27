import type { AiOrchestration } from '@/pages/ai-operations/types';
import { CAPACITY_STATE } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function CapacityFallback({ orchestration }: { orchestration: AiOrchestration }) {
  const c = orchestration.capacity;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Capacity &amp; Fallback</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Primary agent</p>
          <p className="text-sm text-foreground-100 mt-0.5">{c.primaryAgent}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Capacity</p>
          <div className="mt-1"><StatusPill tone={CAPACITY_STATE[c.capacity].tone} label={CAPACITY_STATE[c.capacity].label} /></div>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Availability</p>
          <p className="text-sm text-foreground-300 mt-0.5">{c.availability}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Active tasks</p>
          <p className="text-sm text-foreground-300 mt-0.5">{c.activeTasks}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Queue</p>
          <p className="text-sm text-foreground-300 mt-0.5">{c.queue}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Estimated wait</p>
          <p className="text-sm text-foreground-300 mt-0.5">{c.estimatedWait}</p>
        </div>
      </div>

      <div className="mt-4 bg-background-50 border border-background-200/40 rounded-lg p-3">
        <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Fallback agent</p>
        <p className="text-sm text-foreground-100 mt-0.5">{c.fallbackAgent || '—'}</p>
        {c.fallbackReason && c.fallbackReason !== '—' && (
          <p className="text-xs text-foreground-500 mt-1">Reason: {c.fallbackReason}</p>
        )}
      </div>
    </section>
  );
}