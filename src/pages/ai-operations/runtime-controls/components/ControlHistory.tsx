import { useRuntimeControls } from '@/pages/ai-operations/runtime-controls/runtimeControlsStore';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export default function ControlHistory() {
  const { history } = useRuntimeControls();

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Control Change History</h3>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-foreground-600">
          <i className="ri-lock-2-line w-3.5 h-3.5 flex items-center justify-center"></i>
          Append-only · never overwritten
        </span>
      </div>

      {history.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <i className="ri-history-line text-foreground-600 text-2xl w-8 h-8 flex items-center justify-center mx-auto"></i>
          <p className="text-sm text-foreground-500 mt-3">No control changes recorded yet.</p>
          <p className="text-xs text-foreground-600 mt-1">The master kill switch was provisioned in its initial blocked state.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
                <th className="px-4 py-2.5 whitespace-nowrap">When</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Action</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Enabled</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Execution Allowed</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Actor</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Reason</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b border-background-200/40 last:border-0 hover:bg-background-50/60 transition-colors">
                  <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">{formatTime(h.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-foreground-300 whitespace-nowrap">{h.action ?? '—'}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    <Delta prev={h.previous_enabled} next={h.new_enabled} />
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    <Delta prev={h.previous_execution_allowed} next={h.new_execution_allowed} />
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">{h.actor_reference ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-foreground-500 max-w-[320px]">{h.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Delta({ prev, next }: { prev: boolean; next: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-label whitespace-nowrap">
      <span className={prev ? 'text-emerald-400' : 'text-foreground-600'}>{prev ? 'true' : 'false'}</span>
      <i className="ri-arrow-right-line text-foreground-600 w-3.5 h-3.5 flex items-center justify-center"></i>
      <span className={next ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>{next ? 'true' : 'false'}</span>
    </span>
  );
}