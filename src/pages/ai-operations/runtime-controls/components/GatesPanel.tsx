import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { useRuntimeControls } from '@/pages/ai-operations/runtime-controls/runtimeControlsStore';
import { findSiteGates, findAgentGates, findRiskGate } from '@/pages/ai-operations/runtime-controls/runtimeControlsStore';
import type { AiRuntimeControlRow } from '@/lib/ai-operations/runtimeControls';

export default function GatesPanel() {
  const { controls } = useRuntimeControls();
  const data = useGroupLiveData();

  const siteGates = findSiteGates(controls);
  const agentGates = findAgentGates(controls);
  const riskGate = findRiskGate(controls);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Risk gate */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-secondary-500/10 text-secondary-300 flex items-center justify-center shrink-0">
            <i className="ri-speed-up-line w-4 h-4 flex items-center justify-center"></i>
          </div>
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Risk Ceiling Gate</h3>
        </div>
        <p className="text-sm text-foreground-500 mb-4">
          Runtime risk ceiling. Actions at or below the ceiling are eligible; AMBER/RED actions are blocked regardless of other gates.
        </p>
        <div className="flex items-center gap-3">
          <CeilingBadge value={riskGate?.risk_ceiling ?? 'green'} />
          <span className="text-xs text-foreground-500">Current production ceiling (still blocked by the master kill switch).</span>
        </div>
      </section>

      {/* Site + agent gates summary */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-secondary-500/10 text-secondary-300 flex items-center justify-center shrink-0">
            <i className="ri-git-repository-private-line w-4 h-4 flex items-center justify-center"></i>
          </div>
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Site &amp; Agent Gates</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-background-50 border border-background-200/60 rounded-lg p-3">
            <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide">Sites Allowed</p>
            <p className="text-2xl font-heading font-bold text-red-400 mt-1">{siteGates.filter((g) => g.execution_allowed && g.enabled).length}</p>
            <p className="text-[11px] text-foreground-600 mt-1">{data.sites.length} registered · default deny</p>
          </div>
          <div className="bg-background-50 border border-background-200/60 rounded-lg p-3">
            <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide">Agents Allowed</p>
            <p className="text-2xl font-heading font-bold text-red-400 mt-1">{agentGates.filter((g) => g.execution_allowed && g.enabled).length}</p>
            <p className="text-[11px] text-foreground-600 mt-1">{data.agents.length} registered · default deny</p>
          </div>
        </div>
        <p className="text-xs text-foreground-500 mt-3">
          No explicit allow = blocked. No site or agent has been granted runtime execution.
        </p>
      </section>

      {/* Site gate detail */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg lg:col-span-2 overflow-hidden">
        <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Site Execution Gates</h3>
          <span className="text-[10px] font-label text-foreground-600">default deny</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
                <th className="px-4 py-2.5 whitespace-nowrap">Site</th>
                <th className="px-4 py-2.5 whitespace-nowrap">State</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Reason</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Last Changed</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Actor</th>
              </tr>
            </thead>
            <tbody>
              {data.sites.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-foreground-500">
                    No sites registered in the live registry.
                  </td>
                </tr>
              ) : (
                data.sites.map((site) => {
                  const gate = siteGates.find((g) => g.site_id === site.id);
                  return (
                    <GateRow
                      key={site.id}
                      label={site.name}
                      gate={gate}
                      defaultReason="No site execution gate — default deny."
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Agent gate detail */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg lg:col-span-2 overflow-hidden">
        <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Agent Execution Gates</h3>
          <span className="text-[10px] font-label text-foreground-600">default deny</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
                <th className="px-4 py-2.5 whitespace-nowrap">Agent</th>
                <th className="px-4 py-2.5 whitespace-nowrap">State</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Reason</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Last Changed</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Actor</th>
              </tr>
            </thead>
            <tbody>
              {data.agents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-foreground-500">
                    No agents registered in the live registry.
                  </td>
                </tr>
              ) : (
                data.agents.map((agent) => {
                  const gate = agentGates.find((g) => g.agent_id === agent.id);
                  return (
                    <GateRow
                      key={agent.id}
                      label={agent.name}
                      gate={gate}
                      defaultReason="No agent execution gate — default deny."
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CeilingBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    red: 'bg-red-500/15 text-red-400 border-red-500/25',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-label font-semibold uppercase border ${map[value] ?? map.green}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {value}
    </span>
  );
}

function GateRow({ label, gate, defaultReason }: { label: string; gate: AiRuntimeControlRow | undefined; defaultReason: string }) {
  const allowed = gate?.enabled && gate?.execution_allowed;
  const changed = gate?.changed_at ? new Date(gate.changed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
  return (
    <tr className="border-b border-background-200/40 last:border-0 hover:bg-background-50/60 transition-colors">
      <td className="px-4 py-3 text-sm text-foreground-100 whitespace-nowrap">{label}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-label rounded-full px-2 py-0.5 border whitespace-nowrap ${allowed ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : 'text-red-400 bg-red-500/10 border-red-500/25'}`}>
          <i className={`${allowed ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'} w-3.5 h-3.5 flex items-center justify-center`}></i>
          {allowed ? 'Allowed' : 'Blocked'}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-foreground-500 max-w-[280px]">{gate?.reason ?? defaultReason}</td>
      <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">{changed}</td>
      <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">{gate?.changed_by ?? '—'}</td>
    </tr>
  );
}