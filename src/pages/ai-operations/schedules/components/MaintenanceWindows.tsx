import type { MaintenanceWindow } from '@/pages/ai-operations/types';

export default function MaintenanceWindows({ windows }: { windows: MaintenanceWindow[] }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Maintenance Windows</h3>
        <span className="text-[11px] font-label text-foreground-600">no scheduler behaviour occurs</span>
      </div>

      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Site / Scope</th>
              <th className="px-4 py-2.5 font-medium">Start</th>
              <th className="px-4 py-2.5 font-medium">End</th>
              <th className="px-4 py-2.5 font-medium">Recurrence</th>
              <th className="px-4 py-2.5 font-medium">Pause Automation</th>
              <th className="px-4 py-2.5 font-medium">Allow Critical</th>
              <th className="px-4 py-2.5 font-medium">Owner</th>
            </tr>
          </thead>
          <tbody>
            {windows.map((w) => (
              <tr key={w.id} className="border-b border-background-200/30 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                <td className="px-4 py-3 font-medium text-foreground-100">{w.name}</td>
                <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{w.siteName}</td>
                <td className="px-4 py-3 text-foreground-300 whitespace-nowrap font-mono text-xs">{w.start}</td>
                <td className="px-4 py-3 text-foreground-300 whitespace-nowrap font-mono text-xs">{w.end}</td>
                <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{w.recurrence}</td>
                <td className="px-4 py-3">{w.pauseAutomation ? <span className="text-amber-400 text-xs font-label">Yes</span> : <span className="text-foreground-600 text-xs">No</span>}</td>
                <td className="px-4 py-3">{w.allowCriticalAutomation ? <span className="text-emerald-400 text-xs font-label">Yes</span> : <span className="text-foreground-600 text-xs">No</span>}</td>
                <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{w.ownerTeam}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden divide-y divide-background-200/40">
        {windows.map((w) => (
          <div key={w.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground-100">{w.name}</p>
                <p className="text-[10px] font-label text-foreground-600 mt-0.5">{w.siteName} · {w.recurrence}</p>
              </div>
              <span className="text-[11px] font-label text-foreground-500 font-mono whitespace-nowrap">{w.start} → {w.end}</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] font-label text-foreground-500 flex-wrap">
              <span>Pause: {w.pauseAutomation ? 'Yes' : 'No'}</span>
              <span>·</span>
              <span>Critical: {w.allowCriticalAutomation ? 'Yes' : 'No'}</span>
              <span>·</span>
              <span>{w.ownerTeam}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}