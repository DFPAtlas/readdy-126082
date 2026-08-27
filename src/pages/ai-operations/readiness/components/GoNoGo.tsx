import { goNoGo } from '@/mocks/ai-operations-readiness-2';
import Section from '@/pages/ai-operations/readiness/components/Section';

export default function GoNoGo() {
  const passed = goNoGo.goRequirements.filter((r) => r.met).length;
  const total = goNoGo.goRequirements.length;

  return (
    <Section
      icon="ri-git-merge-line"
      title="Production Go / No-Go"
      subtitle="Default overall status is NO-GO until every required gate passes."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="flex flex-col items-center justify-center border border-red-500/30 bg-red-500/5 rounded-lg p-6">
          <i className="ri-close-circle-line text-red-400 text-3xl w-8 h-8 flex items-center justify-center mb-2"></i>
          <p className="text-xl font-heading font-bold text-red-400">NO-GO</p>
          <p className="text-sm text-foreground-500 mt-1 text-center">{goNoGo.summary}</p>
        </div>

        <div>
          <h3 className="text-xs font-label font-semibold uppercase tracking-wide text-foreground-500 mb-2">GO requirements</h3>
          <div className="space-y-1.5">
            {goNoGo.goRequirements.map((r) => (
              <div key={r.label} className="flex items-center gap-2.5 border border-background-200/50 rounded-lg px-3 py-2">
                {r.met ? (
                  <i className="ri-checkbox-circle-line text-emerald-400 text-sm w-4 h-4 flex items-center justify-center shrink-0"></i>
                ) : (
                  <i className="ri-indeterminate-circle-line text-red-400 text-sm w-4 h-4 flex items-center justify-center shrink-0"></i>
                )}
                <span className="text-sm text-foreground-100">{r.label}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-foreground-600 mt-2">{passed} of {total} requirements met.</p>
        </div>
      </div>
    </Section>
  );
}