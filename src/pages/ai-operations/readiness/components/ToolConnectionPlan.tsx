import { toolConnections } from '@/mocks/ai-operations-readiness-2';
import { READINESS_STATUS } from '@/pages/ai-operations/readiness/readinessStatus';
import Section from '@/pages/ai-operations/readiness/components/Section';

function Flag({ value }: { value: boolean }) {
  return value ? (
    <i className="ri-check-line text-emerald-400 text-sm w-4 h-4 flex items-center justify-center"></i>
  ) : (
    <i className="ri-close-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center"></i>
  );
}

export default function ToolConnectionPlan() {
  return (
    <Section
      icon="ri-plug-2-line"
      title="Tool Connection Plan"
      subtitle="Connection audit for external tools. No credentials present — references only."
    >
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm min-w-[880px]">
          <thead>
            <tr className="text-left text-[11px] font-label uppercase tracking-wide text-foreground-500 border-b border-background-200/60">
              <th className="py-2 pr-4 font-semibold">Tool</th>
              <th className="py-2 pr-3 font-semibold">State</th>
              <th className="py-2 pr-3 font-semibold">Auth Type</th>
              <th className="py-2 pr-3 font-semibold">Credential Ref</th>
              <th className="py-2 pr-3 font-semibold">Approval</th>
              <th className="py-2 pr-3 font-semibold">Test</th>
              <th className="py-2 pr-3 font-semibold">Readiness</th>
            </tr>
          </thead>
          <tbody>
            {toolConnections.map((t) => {
              const { tone, label } = READINESS_STATUS[t.productionReadiness];
              const tones: Record<string, string> = {
                emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
                amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
                red: 'bg-red-500/15 text-red-400 border-red-500/25',
                accent: 'bg-accent-500/15 text-accent-400 border-accent-500/25',
                secondary: 'bg-secondary-500/15 text-secondary-300 border-secondary-500/25',
              };
              return (
                <tr key={t.tool} className="border-b border-background-200/40 last:border-0 hover:bg-background-50/50 transition-colors">
                  <td className="py-2.5 pr-4 font-label font-medium text-foreground-100 whitespace-nowrap">{t.tool}</td>
                  <td className="py-2.5 pr-3 text-xs text-foreground-300 whitespace-nowrap">{t.connectionState}</td>
                  <td className="py-2.5 pr-3 text-xs text-foreground-500">{t.authenticationType}</td>
                  <td className="py-2.5 pr-3 text-xs text-foreground-500">{t.credentialReference}</td>
                  <td className="py-2.5 pr-3"><Flag value={t.approvalRequired} /></td>
                  <td className="py-2.5 pr-3"><Flag value={t.testRequired} /></td>
                  <td className="py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-label whitespace-nowrap border ${tones[tone]}`}>{label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 space-y-1.5">
        {toolConnections.map((t) => (
          <div key={t.tool} className="text-xs text-foreground-500">
            <span className="font-label font-semibold text-foreground-300">{t.tool}:</span>{' '}
            allowed — {t.allowedOperations}; restricted — {t.restrictedOperations}
          </div>
        ))}
      </div>
    </Section>
  );
}