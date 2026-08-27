import { Link } from 'react-router-dom';
import type { AiSchedule } from '@/pages/ai-operations/types';
import { ACTIVITY_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function RunHistory({ schedule }: { schedule: AiSchedule }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Run History</h3>
          <span className="inline-flex items-center gap-1 text-[10px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-flask-line text-xs w-3 h-3 flex items-center justify-center"></i>
            Demo Supporting Metadata
          </span>
        </div>
        <Link
          to="/ai-operations/runs"
          className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
        >
          Tasks &amp; Runs
          <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
        </Link>
      </div>

      {schedule.runHistory.length === 0 ? (
        <p className="px-4 py-6 text-sm text-foreground-500">No prior executions recorded.</p>
      ) : (
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Run ID</th>
                <th className="px-4 py-2.5 font-medium">Started</th>
                <th className="px-4 py-2.5 font-medium">Duration</th>
                <th className="px-4 py-2.5 font-medium">Result</th>
                <th className="px-4 py-2.5 font-medium">Cost</th>
                <th className="px-4 py-2.5 font-medium">Verification</th>
                <th className="px-4 py-2.5 font-medium text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {schedule.runHistory.map((r) => {
                const result = ACTIVITY_STATUS[r.result];
                return (
                  <tr key={r.runId} className="border-b border-background-200/30 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                    <td className="px-4 py-3 font-mono text-xs text-foreground-100">{r.runId}</td>
                    <td className="px-4 py-3 text-foreground-300 whitespace-nowrap font-mono text-xs">{r.started}</td>
                    <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{r.duration}</td>
                    <td className="px-4 py-3"><StatusPill tone={result.tone} label={result.label} /></td>
                    <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{r.cost}</td>
                    <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{r.verification}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/ai-operations/runs/${r.runId}`}
                        className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Open
                        <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {schedule.runHistory.length > 0 && (
        <div className="lg:hidden divide-y divide-background-200/40">
          {schedule.runHistory.map((r) => {
            const result = ACTIVITY_STATUS[r.result];
            return (
              <div key={r.runId} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-mono text-foreground-100">{r.runId}</p>
                  <p className="text-[10px] font-label text-foreground-500 mt-0.5">{r.started} · {r.duration} · {r.cost}</p>
                </div>
                <StatusPill tone={result.tone} label={result.label} />
              </div>
            );
          })}
        </div>
      )}

      <div className="px-4 py-3 border-t border-background-200/60 flex items-center gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Avg run cost</p>
          <p className="text-sm font-medium text-foreground-100">{schedule.avgRunCost}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Est. monthly executions</p>
          <p className="text-sm font-medium text-foreground-100">{schedule.estimatedMonthlyExecutions.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Est. monthly cost</p>
          <p className="text-sm font-medium text-foreground-100">{schedule.estimatedMonthlyCost}</p>
        </div>
        <span className="text-[10px] font-label text-foreground-600">demo estimate only</span>
      </div>
    </section>
  );
}