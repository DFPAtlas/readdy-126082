import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCosts } from '@/pages/ai-operations/costs/CostsContext';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';
import { parseCurrency, formatCurrency } from '@/pages/ai-operations/costs/costMapper';
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

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className="text-xl font-heading font-bold text-foreground-100 mt-1 truncate">{value}</p>
      {note && <p className="text-[11px] font-label text-foreground-600 mt-0.5">{note}</p>}
    </div>
  );
}

export default function CostsPage() {
  const [range, setRange] = useState('month');
  const { budgets, usageCosts, budgetEvents, mode, loading, error, refresh, loadDemo } = useCosts();

  const totalBudget = budgets.reduce((sum, b) => sum + parseCurrency(b.monthlyLimit), 0);
  const activeCount = budgets.filter((b) => b.status !== 'disabled').length;
  const warningCount = budgets.filter(
    (b) => b.status === 'warning' || b.status === 'critical' || b.status === 'exceeded',
  ).length;
  const totalUsage = usageCosts.reduce((sum, u) => sum + (u.estimated_cost ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">Cost, Usage &amp; Budgets</h1>
            <DataSourceBadge mode={mode} />
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
            Group-wide visibility and budget governance for AI agents, models, workflows and services.
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-label text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2.5 py-1">
              <i className="ri-database-2-line w-4 h-4 flex items-center justify-center"></i>
              Persisted AI Operations Cost Data
            </p>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-label text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-full px-2.5 py-1">
              <i className="ri-plug-line w-4 h-4 flex items-center justify-center"></i>
              Live Provider Billing — not connected
            </p>
          </div>
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

      {mode === 'error' ? (
        <section className="bg-background-100 border border-background-200/60 rounded-lg p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-10 h-10 rounded-md bg-red-500/10 text-red-400 flex items-center justify-center">
              <i className="ri-error-warning-line text-lg w-5 h-5 flex items-center justify-center"></i>
            </div>
            <div>
              <p className="text-sm font-label font-semibold text-foreground-100">Unable to load persisted cost data</p>
              <p className="text-xs text-foreground-500 mt-1 max-w-md">{error}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void refresh()}
                className="inline-flex items-center gap-1.5 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                <i className="ri-refresh-line w-4 h-4 flex items-center justify-center"></i>
                Retry
              </button>
              <button
                onClick={loadDemo}
                className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-50 border border-background-300/60 rounded-md px-3 py-2 hover:text-foreground-100 transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                Use Demo Data
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section aria-label="Persisted budgets and usage" className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Budgets" value={String(budgets.length)} note={`${activeCount} active`} />
            <StatCard label="Warning / Critical" value={String(warningCount)} />
            <StatCard label="Total Budget" value={formatCurrency(totalBudget)} />
            <StatCard label="Usage Baseline" value={formatCurrency(totalUsage)} note="Estimated / migrated baseline" />
            <StatCard label="Budget Events" value={String(budgetEvents.length)} />
          </section>

          {loading && (
            <p className="text-[11px] font-label text-foreground-600">Refreshing persisted cost data…</p>
          )}

          <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
            <p className="text-xs font-label text-foreground-500 leading-relaxed">
              <span className="text-foreground-100 font-semibold">Provider usage ingestion is not connected.</span>{' '}
              Current usage is derived from persisted baseline records only (clearly marked as estimated / migrated baseline),
              never from live provider billing. Budget values are reporting metadata — no spend limit is enforced and no
              agent is stopped. Forecast figures are deterministic projections, not provider-side billing accuracy.
            </p>
          </div>
        </>
      )}

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
        Date range filter is a local demo control only — no historical billing queries are connected. Per-dimension
        cost breakdowns are demo / migrated baseline; live provider billing is not connected.
      </p>
    </div>
  );
}