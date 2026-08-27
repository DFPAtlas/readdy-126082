import { Link } from 'react-router-dom';
import { getActiveRuns } from '@/pages/ai-operations/live/selectors';
import { RUN_STATUS, RUN_PRIORITY, RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function ActiveRuns() {
  const runs = getActiveRuns();

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Active Runs</h3>
        <span className="text-xs font-label text-foreground-600">{runs.length} in flight</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Run</th>
              <th className="px-4 py-2.5 font-medium">Site</th>
              <th className="px-4 py-2.5 font-medium">Agent</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Priority</th>
              <th className="px-4 py-2.5 font-medium">Step</th>
              <th className="px-4 py-2.5 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => {
              const status = RUN_STATUS[r.status];
              const priority = RUN_PRIORITY[r.priority];
              const risk = RISK_LEVEL[r.risk];
              return (
                <tr key={r.id} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <span className="font-label text-foreground-200 whitespace-nowrap">{r.id}</span>
                  </td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{r.siteName}</td>
                  <td className="px-4 py-3">
                    <span className="text-foreground-400 whitespace-nowrap">{r.agentName}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={status.tone} label={status.label} pulse={r.status === 'working'} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <StatusPill tone={priority.tone} label={priority.label} />
                      <StatusPill tone={risk.tone} label={risk.label} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">
                    {r.currentStep} / {r.totalSteps}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/ai-operations/runs/${r.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                    >
                      Open Run
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}