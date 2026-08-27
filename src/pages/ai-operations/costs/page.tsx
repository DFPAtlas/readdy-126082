import { useState } from 'react';
import { Link } from 'react-router-dom';
import CostKpis from '@/pages/ai-operations/costs/components/CostKpis';
import CostBySite from '@/pages/ai-operations/costs/components/CostBySite';
import CostByAgent from '@/pages/ai-operations/costs/components/CostByAgent';
import CostByModel from '@/pages/ai-operations/costs/components/CostByModel';
import CostByProvider from '@/pages/ai-operations/costs/components/CostByProvider';
import UsageMetrics from '@/pages/ai-operations/costs/components/UsageMetrics';
import BudgetAlerts from '@/pages/ai-operations/costs/components/BudgetAlerts';
import ForecastPanel from '@/pages/ai-operations/costs/components/ForecastPanel';
import EfficiencyPanel from '@/pages/ai-operations/costs/components/EfficiencyPanel';
import LocalVsCloud from '@/pages/ai-operations/costs/components/LocalVsCloud';
import RunCostTable from '@/pages/ai-operations/costs/components/RunCostTable';

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: 'month', label: 'This Month' },
];

export default function CostsPage() {
  const [range, setRange] = useState('month');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Cost, Usage &amp; Budgets</h1>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Group-wide visibility and budget governance for AI agents, models, workflows and services.
          </p>
          <p className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-label text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-full px-2.5 py-1">
            <i className="ri-information-line w-4 h-4 flex items-center justify-center"></i>
            Demo cost data — not production billing.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/ai-operations/costs/budgets"
            className="inline-flex items-center gap-1.5 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-wallet-3-line w-4 h-4 flex items-center justify-center"></i>
            Manage Budgets
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-background-100 border border-background-200/60 rounded-full p-1 w-fit">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-label whitespace-nowrap transition-colors duration-150 cursor-pointer ${
              range === r.key ? 'bg-accent-500 text-background-950' : 'text-foreground-400 hover:text-foreground-100'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <CostKpis />

      <CostBySite />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <CostByAgent />
        <CostByModel />
      </div>

      <CostByProvider />
      <UsageMetrics />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <ForecastPanel />
        <BudgetAlerts />
      </div>

      <RunCostTable />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <EfficiencyPanel />
        <LocalVsCloud />
      </div>

      <p className="text-[11px] font-label text-foreground-600">
        Date range filter is a local demo control only — no historical billing queries are connected. Figures are static demo metadata.
      </p>
    </div>
  );
}