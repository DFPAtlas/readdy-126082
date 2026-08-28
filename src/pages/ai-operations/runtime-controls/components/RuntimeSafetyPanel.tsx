import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useRuntimeControls, refreshControls, findMasterSwitch, findSiteGates, findAgentGates } from '@/pages/ai-operations/runtime-controls/runtimeControlsStore';
import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';

export default function RuntimeSafetyPanel() {
  const { controls } = useRuntimeControls();
  const data = useGroupLiveData();

  useEffect(() => {
    void refreshControls();
  }, []);

  const master = findMasterSwitch(controls);
  const sitesAllowed = findSiteGates(controls).filter((g) => g.enabled && g.execution_allowed).length;
  const agentsAllowed = findAgentGates(controls).filter((g) => g.enabled && g.execution_allowed).length;

  const rows = [
    { label: 'Master Kill Switch', value: master?.enabled ? 'ON' : 'OFF', tone: 'red' as const },
    { label: 'Production Enabled', value: '0', tone: 'red' as const },
    { label: 'Sites Allowed', value: String(sitesAllowed), tone: 'red' as const },
    { label: 'Agents Allowed', value: String(agentsAllowed), tone: 'red' as const },
    { label: 'Runtime Health Gate', value: 'Blocked', tone: 'red' as const },
    { label: 'Scheduler Gate', value: 'Unverified', tone: 'red' as const },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-red-500/10 text-red-400 flex items-center justify-center shrink-0">
            <i className="ri-shield-cross-line text-sm w-4 h-4 flex items-center justify-center"></i>
          </div>
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Runtime Safety</h3>
        </div>
        <Link
          to="/ai-operations/runtime-controls"
          className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-external-link-line w-3.5 h-3.5 flex items-center justify-center"></i>
          Controls
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-background-200/40">
        {rows.map((row) => (
          <div key={row.label} className="bg-background-100 px-4 py-3">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{row.label}</p>
            <p className={`text-base font-heading font-bold mt-1 ${row.tone === 'red' ? 'text-red-400' : 'text-foreground-100'}`}>{row.value}</p>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-background-200/60 flex items-center gap-2.5">
        <span className="w-2 h-2 rounded-full bg-red-400 shrink-0"></span>
        <p className="text-xs text-foreground-500">
          Runtime execution is <strong className="text-red-400">BLOCKED</strong> — the master kill switch is ON and production is disabled. {data.sites.length} sites and {data.agents.length} agents registered, none allowed to execute.
        </p>
      </div>
    </section>
  );
}