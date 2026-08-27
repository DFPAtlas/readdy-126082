import { implementationPhases } from '@/mocks/ai-operations-readiness-2';
import Section from '@/pages/ai-operations/readiness/components/Section';

export default function ImplementationPhases() {
  return (
    <Section
      icon="ri-map-2-line"
      title="Implementation Roadmap"
      subtitle="Staged phases from Supabase persistence to controlled production rollout. No phase is implemented."
    >
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-background-300/60 hidden sm:block"></div>
        <div className="space-y-3">
          {implementationPhases.map((p) => (
            <div key={p.id} className="relative flex gap-4">
              <div className="hidden sm:flex w-8 h-8 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 items-center justify-center shrink-0 relative z-10">
                <i className="ri-flag-2-line text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
              <div className="flex-1 border border-background-200/60 rounded-lg p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-label font-semibold text-foreground-100">{p.name}</span>
                  <span className="text-[11px] font-label uppercase tracking-wide text-foreground-600 capitalize">{p.status.replace('_', ' ')}</span>
                </div>
                <p className="text-xs text-foreground-500 mt-1">{p.summary}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {p.deliverables.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1 text-[11px] font-label text-foreground-500 bg-background-50 border border-background-300/60 rounded-full px-2 py-0.5">
                      <i className="ri-checkbox-blank-circle-line text-foreground-600 text-xs w-3 h-3 flex items-center justify-center"></i>
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}