import { getCostByProvider } from '@/pages/ai-operations/costs/selectors';

export default function CostByProvider() {
  const rows = getCostByProvider();

  return (
    <section aria-label="Cost by provider" className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-label font-semibold text-foreground-100">Cost by Provider</h3>
        <span className="text-[11px] font-label text-foreground-500">No live provider billing</span>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] font-label uppercase tracking-wide text-foreground-500 border-b border-background-200/60">
              <th className="py-2 pr-4 font-medium">Provider</th>
              <th className="py-2 px-4 font-medium">Models</th>
              <th className="py-2 px-4 font-medium">Requests</th>
              <th className="py-2 px-4 font-medium">Failures</th>
              <th className="py-2 px-4 font-medium">Today</th>
              <th className="py-2 px-4 font-medium">Month</th>
              <th className="py-2 pl-4 font-medium">Forecast</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.providerId} className="border-b border-background-200/40 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                <td className="py-2.5 pr-4 text-foreground-100 font-label whitespace-nowrap">{r.providerName}</td>
                <td className="py-2.5 px-4 text-foreground-300">{r.models}</td>
                <td className="py-2.5 px-4 text-foreground-300">{r.requests}</td>
                <td className="py-2.5 px-4 text-foreground-300">{r.failures}</td>
                <td className="py-2.5 px-4 text-foreground-100">{r.today}</td>
                <td className="py-2.5 px-4 text-foreground-300">{r.month}</td>
                <td className="py-2.5 pl-4 text-foreground-300">{r.forecast}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {rows.map((r) => (
          <div key={r.providerId} className="border border-background-200/60 rounded-lg p-3">
            <p className="text-sm font-label font-semibold text-foreground-100 mb-2">{r.providerName}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-foreground-500">Models</span><span className="text-foreground-300 text-right">{r.models}</span>
              <span className="text-foreground-500">Requests</span><span className="text-foreground-300 text-right">{r.requests}</span>
              <span className="text-foreground-500">Failures</span><span className="text-foreground-300 text-right">{r.failures}</span>
              <span className="text-foreground-500">Today</span><span className="text-foreground-300 text-right">{r.today}</span>
              <span className="text-foreground-500">Month</span><span className="text-foreground-300 text-right">{r.month}</span>
              <span className="text-foreground-500">Forecast</span><span className="text-foreground-300 text-right">{r.forecast}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}