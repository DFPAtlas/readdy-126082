import type { SupportSummary } from '@/types/support-tickets';

export interface MetricDef {
  key: keyof SupportSummary;
  label: string;
  icon: string;
  accent: string;
  description: string;
}

export const METRICS: MetricDef[] = [
  { key: 'tickets_received', label: 'Tickets Received', icon: 'ri-mail-add-line', accent: 'text-primary-400', description: 'New tickets created in the selected period.' },
  { key: 'tickets_resolved', label: 'Tickets Resolved', icon: 'ri-check-double-line', accent: 'text-emerald-400', description: 'Tickets marked resolved in the selected period.' },
  { key: 'active_open', label: 'Active Open Tickets', icon: 'ri-inbox-line', accent: 'text-accent-400', description: 'Currently open — excludes resolved, closed and spam.' },
  { key: 'overdue_active', label: 'Overdue Active', icon: 'ri-alarm-warning-line', accent: 'text-orange-400', description: 'Active tickets past their due time.' },
  { key: 'unassigned_active', label: 'Unassigned Active', icon: 'ri-user-line', accent: 'text-foreground-400', description: 'Active tickets with no assigned staff.' },
  { key: 'customer_replies', label: 'Customer Replies', icon: 'ri-chat-3-line', accent: 'text-secondary-300', description: 'Customer messages in the selected period.' },
  { key: 'staff_replies', label: 'Public Staff Replies', icon: 'ri-reply-line', accent: 'text-primary-400', description: 'Public staff replies — internal notes excluded.' },
  { key: 'sla_breaches', label: 'SLA Breaches', icon: 'ri-timer-flash-line', accent: 'text-red-400', description: 'Tickets breaching first-response or resolution SLA.' },
];

interface MetricCardProps {
  metric: MetricDef;
  value: number | null;
  loading: boolean;
}

function MetricCard({ metric, value, loading }: MetricCardProps) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5 min-h-[120px] flex flex-col">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wider whitespace-nowrap">
          {metric.label}
        </span>
        <i className={`${metric.icon} ${metric.accent} text-base w-5 h-5 flex items-center justify-center`}></i>
      </div>

      {loading ? (
        <div
          className="mt-2.5 h-8 w-20 rounded-md bg-background-200/60 animate-pulse"
          aria-hidden="true"
        ></div>
      ) : (
        <p
          className="text-2xl font-heading font-bold text-foreground-50 mt-1.5"
          aria-label={`${metric.label}: ${value ?? 0}`}
        >
          {value ?? 0}
        </p>
      )}

      <p className="text-xs text-foreground-500 mt-1.5 leading-relaxed">
        {metric.description}
      </p>
    </div>
  );
}

interface SummaryMetricsGridProps {
  summary: SupportSummary | null;
  loading: boolean;
  error: string | null;
}

export default function SummaryMetricsGrid({ summary, loading, error }: SummaryMetricsGridProps) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
      role="group"
      aria-label="Support report summary"
    >
      {METRICS.map((metric) => (
        <MetricCard
          key={metric.key}
          metric={metric}
          loading={loading}
          value={summary ? summary[metric.key] : null}
        />
      ))}

      {error && !loading && (
        <div className="sm:col-span-2 lg:col-span-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex items-center gap-3">
          <i className="ri-error-warning-line text-red-400 text-base w-5 h-5 flex items-center justify-center"></i>
          <p className="text-sm text-red-400 flex-1">{error}</p>
        </div>
      )}
    </div>
  );
}