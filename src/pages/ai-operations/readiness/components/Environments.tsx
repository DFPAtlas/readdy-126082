import { environments } from '@/mocks/ai-operations-readiness-2';
import Section from '@/pages/ai-operations/readiness/components/Section';

export default function Environments() {
  return (
    <Section
      icon="ri-stack-line"
      title="Environments"
      subtitle="Promotion path — agents and integrations must never jump directly from development to unrestricted production."
    >
      <div className="flex flex-col sm:flex-row items-stretch gap-2">
        {environments.map((env, i) => (
          <div key={env.id} className="flex-1">
            <div className="border border-background-200/60 rounded-lg p-3 h-full">
              <p className="text-sm font-label font-semibold text-foreground-100">{env.name}</p>
              <p className="text-xs text-foreground-500 mt-1">{env.purpose}</p>
              <p className="text-[11px] font-label text-accent-400 mt-2">{env.promotion}</p>
            </div>
            {i < environments.length - 1 && (
              <div className="flex sm:hidden justify-center py-1">
                <i className="ri-arrow-down-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center"></i>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-foreground-600 mt-3">Development → Sandbox → Staging → Production</p>
    </Section>
  );
}