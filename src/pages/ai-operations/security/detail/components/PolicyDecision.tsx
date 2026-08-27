import type { AiSecurityPolicy } from '@/pages/ai-operations/types';
import { EVALUATION_RESULT } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function PolicyDecision({ policy }: { policy: AiSecurityPolicy }) {
  const result = EVALUATION_RESULT[policy.decision.result];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Policy Decision</h3>
        <StatusPill tone={result.tone} label={result.label} />
      </div>

      <p className="text-sm text-foreground-300 mt-3 leading-relaxed">{policy.decision.explanation}</p>
    </section>
  );
}