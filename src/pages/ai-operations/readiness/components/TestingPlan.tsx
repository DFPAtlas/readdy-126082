import { testingPhases } from '@/mocks/ai-operations-readiness-2';
import Section from '@/pages/ai-operations/readiness/components/Section';

const RISK_TONE: Record<string, string> = {
  Low: 'text-emerald-400 bg-emerald-500/10',
  Medium: 'text-amber-400 bg-amber-500/10',
  High: 'text-red-400 bg-red-500/10',
};

export default function TestingPlan() {
  return (
    <Section
      icon="ri-flask-line"
      title="Production Activation Test Phases"
      subtitle="Staged testing path from read-only to broader automation. RED actions remain human-governed."
    >
      <div className="space-y-2.5">
        {testingPhases.map((p) => (
          <div key={p.phase} className="flex items-start gap-3 border border-background-200/60 rounded-lg px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-primary-500/10 text-primary-400 flex items-center justify-center shrink-0">
              <span className="text-sm font-label font-bold">{p.phase}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-label font-semibold text-foreground-100">{p.name}</span>
                <span className={`text-[11px] font-label rounded-full px-2 py-0.5 ${RISK_TONE[p.risk]}`}>{p.risk} risk</span>
              </div>
              <p className="text-xs text-foreground-500 mt-1">{p.description}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}