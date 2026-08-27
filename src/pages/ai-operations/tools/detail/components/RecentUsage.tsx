import { Link } from 'react-router-dom';
import type { ToolConnection } from '@/pages/ai-operations/types';
import { ACTIVITY_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function RecentUsage({ connection }: { connection: ToolConnection }) {
  const { usageEvents } = connection;

  if (usageEvents.length === 0) {
    return (
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Recent Usage</h3>
        <p className="text-sm text-foreground-500">No usage events recorded.</p>
      </section>
    );
  }

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Recent Usage</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-2 py-2 font-medium">Time</th>
              <th className="px-2 py-2 font-medium">Agent</th>
              <th className="px-2 py-2 font-medium">Site</th>
              <th className="px-2 py-2 font-medium">Operation</th>
              <th className="px-2 py-2 font-medium">Run</th>
              <th className="px-2 py-2 font-medium">Result</th>
              <th className="px-2 py-2 font-medium">Duration</th>
            </tr>
          </thead>
          <tbody>
            {usageEvents.map((e, i) => {
              const result = ACTIVITY_STATUS[e.result];
              return (
                <tr key={`${e.runId}-${i}`} className="border-t border-background-200/40">
                  <td className="px-2 py-2.5 text-foreground-500 whitespace-nowrap">{e.time}</td>
                  <td className="px-2 py-2.5 font-medium text-foreground-200 whitespace-nowrap">{e.agentName}</td>
                  <td className="px-2 py-2.5 text-foreground-500 whitespace-nowrap">{e.site}</td>
                  <td className="px-2 py-2.5 text-foreground-400 whitespace-nowrap">{e.operation}</td>
                  <td className="px-2 py-2.5 whitespace-nowrap">
                    {e.runId ? (
                      <Link to={`/ai-operations/runs/${e.runId}`} className="text-xs font-mono text-accent-400 hover:text-accent-300 cursor-pointer">{e.runId}</Link>
                    ) : (
                      <span className="text-foreground-600">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5"><StatusPill tone={result.tone} label={result.label} /></td>
                  <td className="px-2 py-2.5 text-foreground-500 whitespace-nowrap">{e.duration}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}