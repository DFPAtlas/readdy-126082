import { Link } from 'react-router-dom';
import { getCostByModel } from '@/pages/ai-operations/costs/selectors';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import { MODEL_STATUS } from '@/pages/ai-operations/constants';

export default function CostByModel() {
  const rows = getCostByModel();

  return (
    <section aria-label="Cost by model" className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-label font-semibold text-foreground-100">Cost by Model</h3>
        <span className="text-[11px] font-label text-foreground-500">Today</span>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] font-label uppercase tracking-wide text-foreground-500 border-b border-background-200/60">
              <th className="py-2 pr-4 font-medium">Model</th>
              <th className="py-2 px-4 font-medium">Provider</th>
              <th className="py-2 px-4 font-medium">Jobs</th>
              <th className="py-2 px-4 font-medium">Input</th>
              <th className="py-2 px-4 font-medium">Output</th>
              <th className="py-2 px-4 font-medium">Est. Cost</th>
              <th className="py-2 px-4 font-medium">Avg / Run</th>
              <th className="py-2 pl-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.modelId} className="border-b border-background-200/40 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                <td className="py-2.5 pr-4">
                  <Link to={`/ai-operations/models/${r.modelId}`} className="text-foreground-100 font-label hover:text-accent-400 transition-colors duration-150 whitespace-nowrap cursor-pointer">
                    {r.modelName}
                  </Link>
                </td>
                <td className="py-2.5 px-4 text-foreground-300 whitespace-nowrap">{r.provider}</td>
                <td className="py-2.5 px-4 text-foreground-300">{r.jobs}</td>
                <td className="py-2.5 px-4 text-foreground-300 whitespace-nowrap">{r.inputUsage}</td>
                <td className="py-2.5 px-4 text-foreground-300 whitespace-nowrap">{r.outputUsage}</td>
                <td className="py-2.5 px-4 text-foreground-100">{r.estimatedCost}</td>
                <td className="py-2.5 px-4 text-foreground-300">{r.avgCostPerRun}</td>
                <td className="py-2.5 pl-4">
                  <StatusPill tone={MODEL_STATUS[r.status].tone} label={MODEL_STATUS[r.status].label} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {rows.map((r) => (
          <div key={r.modelId} className="border border-background-200/60 rounded-lg p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <Link to={`/ai-operations/models/${r.modelId}`} className="text-sm font-label font-semibold text-foreground-100 hover:text-accent-400 cursor-pointer">
                {r.modelName}
              </Link>
              <StatusPill tone={MODEL_STATUS[r.status].tone} label={MODEL_STATUS[r.status].label} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-foreground-500">Provider</span><span className="text-foreground-300 text-right">{r.provider}</span>
              <span className="text-foreground-500">Jobs</span><span className="text-foreground-300 text-right">{r.jobs}</span>
              <span className="text-foreground-500">Input</span><span className="text-foreground-300 text-right">{r.inputUsage}</span>
              <span className="text-foreground-500">Output</span><span className="text-foreground-300 text-right">{r.outputUsage}</span>
              <span className="text-foreground-500">Est. cost</span><span className="text-foreground-300 text-right">{r.estimatedCost}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}