import { Link } from 'react-router-dom';
import type { AgentRunSummary } from '@/pages/ai-operations/types';
import { ACTIVITY_STATUS, RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function RecentRuns({ runs }: { runs: AgentRunSummary[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Recent Runs</h3>
        <span className="text-xs font-label text-foreground-600">{runs.length} runs</span>
      </div>

      {runs.length === 0 ? (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
          <p className="text-sm text-foreground-500">No runs recorded yet.</p>
        </div>
      ) : (
        <div className="bg-background-100 border border-background-200/60 rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Run ID</th>
                  <th className="px-4 py-3 font-medium">Started</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Risk</th>
                  <th className="px-4 py-3 font-medium">Est. Cost</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const status = ACTIVITY_STATUS[run.status];
                  const risk = RISK_LEVEL[run.risk];
                  return (
                    <tr key={run.id} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                      <td className="px-4 py-3 font-mono text-xs text-accent-400 whitespace-nowrap">{run.id}</td>
                      <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{run.started}</td>
                      <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{run.duration}</td>
                      <td className="px-4 py-3 text-foreground-400 max-w-[200px] truncate" title={run.task}>{run.task}</td>
                      <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} /></td>
                      <td className="px-4 py-3"><StatusPill tone={risk.tone} label={risk.label} /></td>
                      <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{run.estimatedCost}</td>
                      <td className="px-4 py-3 text-foreground-400 max-w-[180px] truncate" title={run.resultSummary}>{run.resultSummary}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/ai-operations/runs/${run.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-200 bg-background-200/50 border border-background-300/40 rounded-md px-2.5 py-1.5 hover:text-foreground-50 transition-colors duration-150 cursor-pointer whitespace-nowrap"
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
        </div>
      )}
    </section>
  );
}