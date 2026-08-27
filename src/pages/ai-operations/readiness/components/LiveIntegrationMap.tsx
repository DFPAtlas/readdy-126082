import { integrationPlan } from '@/mocks/ai-operations-readiness';
import { READINESS_STATUS } from '@/pages/ai-operations/readiness/readinessStatus';
import Section from '@/pages/ai-operations/readiness/components/Section';

const LAYERS = ['DFP COMMAND', 'AI OPERATIONS', 'SUPABASE CONTROL PLANE', 'MASTER ORCHESTRATOR', 'N8N / AGENT RUNTIME', 'TOOLS / MODELS / KNOWLEDGE', 'SITE SYSTEMS'];

export default function LiveIntegrationMap() {
  return (
    <Section
      icon="ri-node-tree"
      title="Live Integration Map"
      subtitle="Architecture and required integrations for the staged production connection. No integration is activated."
    >
      {/* Architecture stack */}
      <div className="mb-5">
        <div className="flex flex-col items-center gap-1.5">
          {LAYERS.map((layer, i) => (
            <div key={layer} className="flex flex-col items-center w-full">
              <div className="w-full max-w-sm bg-background-50 border border-background-300/60 rounded-lg px-4 py-2.5 text-center">
                <span className="text-sm font-label font-semibold text-foreground-100">{layer}</span>
              </div>
              {i < LAYERS.length - 1 && (
                <i className="ri-arrow-down-line text-foreground-600 text-base w-4 h-4 flex items-center justify-center my-0.5"></i>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Integration requirements */}
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-[11px] font-label uppercase tracking-wide text-foreground-500 border-b border-background-200/60">
              <th className="py-2 pr-4 font-semibold">Integration</th>
              <th className="py-2 pr-3 font-semibold">Layer</th>
              <th className="py-2 pr-3 font-semibold">Requirement</th>
              <th className="py-2 pr-3 font-semibold">Credential Location</th>
              <th className="py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {integrationPlan.map((i) => {
              const { tone, label } = READINESS_STATUS[i.status];
              const tones: Record<string, string> = {
                emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
                amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
                red: 'bg-red-500/15 text-red-400 border-red-500/25',
                accent: 'bg-accent-500/15 text-accent-400 border-accent-500/25',
                secondary: 'bg-secondary-500/15 text-secondary-300 border-secondary-500/25',
              };
              return (
                <tr key={i.id} className="border-b border-background-200/40 last:border-0 hover:bg-background-50/50 transition-colors">
                  <td className="py-2.5 pr-4 font-label font-medium text-foreground-100 whitespace-nowrap">{i.name}</td>
                  <td className="py-2.5 pr-3 text-foreground-500 text-xs whitespace-nowrap">{i.layer}</td>
                  <td className="py-2.5 pr-3 text-foreground-300 text-xs">{i.requirement}</td>
                  <td className="py-2.5 pr-3 text-xs text-foreground-500">{i.credentialLocation}</td>
                  <td className="py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-label whitespace-nowrap border ${tones[tone]}`}>{label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-foreground-600 mt-3">Credential locations are references only — no credential values are displayed.</p>
    </Section>
  );
}