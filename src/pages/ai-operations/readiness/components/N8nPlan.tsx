import { n8nWorkflows } from '@/mocks/ai-operations-readiness';
import { READINESS_STATUS } from '@/pages/ai-operations/readiness/readinessStatus';
import Section from '@/pages/ai-operations/readiness/components/Section';

export default function N8nPlan() {
  return (
    <Section
      icon="ri-flow-chart"
      title="n8n Integration Plan"
      subtitle="Future workflow responsibilities. No workflow is created or executed."
    >
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="text-left text-[11px] font-label uppercase tracking-wide text-foreground-500 border-b border-background-200/60">
              <th className="py-2 pr-4 font-semibold">Workflow</th>
              <th className="py-2 pr-3 font-semibold">Trigger</th>
              <th className="py-2 pr-3 font-semibold">Input</th>
              <th className="py-2 pr-3 font-semibold">Output</th>
              <th className="py-2 pr-3 font-semibold">Risk</th>
              <th className="py-2 pr-3 font-semibold">Approval</th>
              <th className="py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {n8nWorkflows.map((w) => {
              const { tone, label } = READINESS_STATUS[w.implementationStatus];
              const tones: Record<string, string> = {
                emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
                amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
                red: 'bg-red-500/15 text-red-400 border-red-500/25',
                accent: 'bg-accent-500/15 text-accent-400 border-accent-500/25',
                secondary: 'bg-secondary-500/15 text-secondary-300 border-secondary-500/25',
              };
              const riskTone = w.risk === 'High' ? 'text-red-400' : w.risk === 'Medium' ? 'text-amber-400' : 'text-emerald-400';
              return (
                <tr key={w.id} className="border-b border-background-200/40 last:border-0 hover:bg-background-50/50 transition-colors">
                  <td className="py-2.5 pr-4 font-label font-medium text-foreground-100 whitespace-nowrap">{w.name}</td>
                  <td className="py-2.5 pr-3 text-foreground-300 text-xs">{w.trigger}</td>
                  <td className="py-2.5 pr-3 text-foreground-500 text-xs">{w.input}</td>
                  <td className="py-2.5 pr-3 text-foreground-500 text-xs">{w.output}</td>
                  <td className="py-2.5 pr-3 text-xs font-label"><span className={riskTone}>{w.risk}</span></td>
                  <td className="py-2.5 pr-3">
                    {w.approvalRequired ? (
                      <span className="text-amber-400 text-xs font-label">Required</span>
                    ) : (
                      <span className="text-foreground-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-label whitespace-nowrap border ${tones[tone]}`}>{label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}