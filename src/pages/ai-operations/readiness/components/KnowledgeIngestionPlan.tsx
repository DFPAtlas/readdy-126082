import { knowledgeIngestionSteps } from '@/mocks/ai-operations-readiness-2';
import Section from '@/pages/ai-operations/readiness/components/Section';

export default function KnowledgeIngestionPlan() {
  return (
    <Section
      icon="ri-book-2-line"
      title="Knowledge Ingestion Plan"
      subtitle="Staged ingestion pipeline. No ingestion occurs."
    >
      <ol className="space-y-2">
        {knowledgeIngestionSteps.map((s) => (
          <li key={s.step} className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-secondary-500/10 text-secondary-300 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-label font-semibold">{s.step}</span>
            </div>
            <div className="flex-1 border border-background-200/50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-label font-semibold text-foreground-100">{s.name}</span>
                <span className="text-[11px] font-label uppercase tracking-wide text-foreground-600 capitalize">{s.status.replace('_', ' ')}</span>
              </div>
              <p className="text-xs text-foreground-500 mt-0.5">{s.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}