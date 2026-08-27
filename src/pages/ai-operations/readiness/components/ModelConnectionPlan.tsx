import { modelConnections } from '@/mocks/ai-operations-readiness-2';
import { READINESS_STATUS } from '@/pages/ai-operations/readiness/readinessStatus';
import Section from '@/pages/ai-operations/readiness/components/Section';

function Flag({ value }: { value: boolean }) {
  return value ? (
    <i className="ri-check-line text-emerald-400 text-sm w-4 h-4 flex items-center justify-center"></i>
  ) : (
    <i className="ri-close-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center"></i>
  );
}

export default function ModelConnectionPlan() {
  return (
    <Section
      icon="ri-cpu-line"
      title="Model Connection Plan"
      subtitle="Provider readiness. Credential locations are references only — no credential values are displayed."
    >
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="text-left text-[11px] font-label uppercase tracking-wide text-foreground-500 border-b border-background-200/60">
              <th className="py-2 pr-4 font-semibold">Provider</th>
              <th className="py-2 pr-3 font-semibold">Connection</th>
              <th className="py-2 pr-3 font-semibold">Credential Location</th>
              <th className="py-2 pr-3 font-semibold">Registry Mapping</th>
              <th className="py-2 pr-3 font-semibold">Fallback</th>
              <th className="py-2 pr-3 font-semibold">Security / Data</th>
              <th className="py-2 pr-3 font-semibold">Cost</th>
              <th className="py-2 pr-3 font-semibold">Health</th>
              <th className="py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {modelConnections.map((m) => {
              const { tone, label } = READINESS_STATUS[m.status];
              const tones: Record<string, string> = {
                emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
                amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
                red: 'bg-red-500/15 text-red-400 border-red-500/25',
                accent: 'bg-accent-500/15 text-accent-400 border-accent-500/25',
                secondary: 'bg-secondary-500/15 text-secondary-300 border-secondary-500/25',
              };
              return (
                <tr key={m.provider} className="border-b border-background-200/40 last:border-0 hover:bg-background-50/50 transition-colors">
                  <td className="py-2.5 pr-4 font-label font-medium text-foreground-100 whitespace-nowrap">{m.provider}</td>
                  <td className="py-2.5 pr-3"><Flag value={m.connectionRequired} /></td>
                  <td className="py-2.5 pr-3 text-xs text-foreground-500">{m.credentialLocation}</td>
                  <td className="py-2.5 pr-3 text-xs text-foreground-500">{m.modelRegistryMapping}</td>
                  <td className="py-2.5 pr-3"><Flag value={m.fallbackConfigured} /></td>
                  <td className="py-2.5 pr-3 text-xs text-foreground-500">{m.securityPolicy}</td>
                  <td className="py-2.5 pr-3"><Flag value={m.costTracking} /></td>
                  <td className="py-2.5 pr-3"><Flag value={m.healthMonitoring} /></td>
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