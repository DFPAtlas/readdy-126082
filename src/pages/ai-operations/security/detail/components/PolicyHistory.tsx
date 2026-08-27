import type { AiSecurityPolicy } from '@/pages/ai-operations/types';

export default function PolicyHistory({ policy }: { policy: AiSecurityPolicy }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Policy History</h3>
        <span className="text-[11px] font-label text-foreground-600">{policy.history.length} events</span>
      </div>

      {policy.history.length === 0 ? (
        <p className="px-4 py-5 text-sm text-foreground-500">No history recorded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Timestamp</th>
                <th className="px-4 py-2.5 font-medium">Version</th>
                <th className="px-4 py-2.5 font-medium">Actor / Team</th>
                <th className="px-4 py-2.5 font-medium">Change</th>
                <th className="px-4 py-2.5 font-medium">Previous Status</th>
                <th className="px-4 py-2.5 font-medium">New Status</th>
              </tr>
            </thead>
            <tbody>
              {policy.history.map((h, i) => (
                <tr key={i} className="border-b border-background-200/30 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                  <td className="px-4 py-3 text-foreground-400 whitespace-nowrap">{h.timestamp}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground-300">{h.version}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{h.actor}</td>
                  <td className="px-4 py-3 text-foreground-400">{h.change}</td>
                  <td className="px-4 py-3 text-foreground-400 whitespace-nowrap">{h.previousStatus}</td>
                  <td className="px-4 py-3 text-foreground-200 whitespace-nowrap">{h.newStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}