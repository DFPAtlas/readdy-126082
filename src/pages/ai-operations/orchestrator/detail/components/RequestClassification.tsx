import type { AiOrchestration } from '@/pages/ai-operations/types';
import {
  TASK_TYPE_LABELS,
  RUN_PRIORITY,
  RISK_LEVEL,
  ENVIRONMENT_LABELS,
  TRIGGER_SOURCE_LABELS,
} from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function RequestClassification({ orchestration }: { orchestration: AiOrchestration }) {
  const c = orchestration.classification;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Request Classification</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Request summary</p>
          <p className="text-sm text-foreground-100 mt-0.5">{c.requestSummary}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Trigger</p>
          <p className="text-sm text-foreground-300 mt-0.5">{TRIGGER_SOURCE_LABELS[c.trigger]}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Detected intent</p>
          <p className="text-sm text-foreground-300 mt-0.5">{c.detectedIntent}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Detected site</p>
          <p className="text-sm text-foreground-300 mt-0.5">{c.detectedSite}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Confidence</p>
          <p className="text-sm text-foreground-300 mt-0.5">{c.confidence}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Task type</p>
          <p className="text-sm text-foreground-300 mt-0.5">{TASK_TYPE_LABELS[c.taskType]}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Priority</p>
          <div className="mt-1"><StatusPill tone={RUN_PRIORITY[c.priority].tone} label={RUN_PRIORITY[c.priority].label} /></div>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Risk</p>
          <div className="mt-1"><StatusPill tone={RISK_LEVEL[c.risk].tone} label={RISK_LEVEL[c.risk].label} /></div>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Environment</p>
          <p className="text-sm text-foreground-300 mt-0.5">{ENVIRONMENT_LABELS[c.environment]}</p>
        </div>
      </div>
    </section>
  );
}