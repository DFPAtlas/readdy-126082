import type { RecurringCost, CostItem } from '@/pages/project-budget/types';
import type { ProjectIntegration } from '../infrastructureTypes';
import type { SectionKey } from '../types';
import {
  computeRecurringCostReview,
  buildDependencyReview,
  DEPENDENCY_STATE_STYLES,
  HEALTH_TREND_LABELS,
  HEALTH_TREND_STYLES,
  SECURITY_REVIEW_STYLES,
  type HealthTrend,
  type SecurityReviewState,
} from '../operationsTypes';

interface OperationsChecksPanelProps {
  recurringCosts: RecurringCost[];
  costItems: CostItem[];
  integration: ProjectIntegration | null;
  securityState: SecurityReviewState;
  healthTrend: HealthTrend;
  budgetStatusLabel: string;
  onNavigate: (key: SectionKey) => void;
}

const SECURITY_STATE_LABELS: Record<SecurityReviewState, string> = {
  CLEAR: 'Clear',
  FINDINGS_OPEN: 'Findings Open',
  REVIEW_REQUIRED: 'Review Required',
  UNKNOWN: 'Unknown',
};

export default function OperationsChecksPanel({
  recurringCosts,
  costItems,
  integration,
  securityState,
  healthTrend,
  budgetStatusLabel,
  onNavigate,
}: OperationsChecksPanelProps) {
  const costReview = computeRecurringCostReview(recurringCosts, costItems);
  const dependencies = buildDependencyReview(integration);

  return (
    <div className="space-y-6">
      {/* ── Health trend ─────────────────────────────────────────────────── */}
      <section>
        <h4 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">
          <i className="ri-line-chart-line w-4 h-4 flex items-center justify-center text-foreground-400"></i>
          Project Health Trend
        </h4>
        <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-foreground-300">Operational trend (30 days)</span>
          <span className={`text-[10px] font-label px-2 py-1 rounded-full whitespace-nowrap ${HEALTH_TREND_STYLES[healthTrend]}`}>
            {HEALTH_TREND_LABELS[healthTrend]}
          </span>
        </div>
        <p className="text-[10px] text-foreground-600 mt-1.5">Trend is inferred from real incident/alert history only — no invented numeric score.</p>
      </section>

      {/* ── Recurring cost review ────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h4 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            <i className="ri-repeat-line w-4 h-4 flex items-center justify-center text-foreground-400"></i>
            Recurring Cost Review
          </h4>
          <button
            type="button"
            onClick={() => onNavigate('budget')}
            className="text-sm text-accent-400 hover:text-accent-300 whitespace-nowrap cursor-pointer"
          >
            Open Budget
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <MetricCell label="Active Services" value={String(costReview.active.length)} />
          <MetricCell label="Upcoming Renewals" value={String(costReview.upcomingRenewals.length)} tone={costReview.upcomingRenewals.length > 0 ? 'text-amber-400' : 'text-emerald-400'} />
          <MetricCell label="Overdue Costs" value={String(costReview.overdue.length)} tone={costReview.overdue.length > 0 ? 'text-red-400' : 'text-emerald-400'} />
          <MetricCell label="Review Needed" value={String(costReview.needsReview.length)} tone={costReview.needsReview.length > 0 ? 'text-sky-400' : 'text-emerald-400'} />
        </div>

        <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-3">
          <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-0.5">Budget Position</p>
          <p className="text-sm text-foreground-200">{budgetStatusLabel || 'Unknown'}</p>
          <p className="text-[10px] text-foreground-600 mt-1.5">Read-only — no service is cancelled automatically.</p>
        </div>
      </section>

      {/* ── Dependency review ────────────────────────────────────────────── */}
      <section>
        <h4 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">
          <i className="ri-git-branch-line w-4 h-4 flex items-center justify-center text-foreground-400"></i>
          Dependency Review
        </h4>
        <div className="bg-background-50 border border-background-200/60 rounded-lg divide-y divide-background-200/60">
          {dependencies.map((d) => (
            <div key={d.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-sm text-foreground-200">{d.label}</span>
              <span className={`text-[10px] font-label px-2 py-0.5 rounded whitespace-nowrap ${DEPENDENCY_STATE_STYLES[d.state]}`}>
                {d.state === 'CONFIGURED' ? 'Configured' : d.state === 'NEEDS_REVIEW' ? 'Needs Review' : 'Unknown'}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-foreground-600 mt-1.5">No package vulnerability scanning is invented — only known configuration is shown.</p>
      </section>

      {/* ── Security review ──────────────────────────────────────────────── */}
      <section>
        <h4 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">
          <i className="ri-shield-check-line w-4 h-4 flex items-center justify-center text-foreground-400"></i>
          Security Review
        </h4>
        <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-foreground-300">Security findings</span>
          <span className={`text-[10px] font-label px-2 py-1 rounded-full whitespace-nowrap ${SECURITY_REVIEW_STYLES[securityState]}`}>
            {SECURITY_STATE_LABELS[securityState]}
          </span>
        </div>
        <p className="text-[10px] text-foreground-600 mt-1.5">An audit is never claimed unless real security findings exist.</p>
      </section>
    </div>
  );
}

function MetricCell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-3">
      <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap mb-1.5">{label}</p>
      <p className={`text-lg font-heading font-bold ${tone ?? 'text-foreground-100'}`}>{value}</p>
    </div>
  );
}