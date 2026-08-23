import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SupportVolumePoint, VolumeGranularity } from '@/types/support-tickets';

interface SeriesDef {
  key: 'tickets_received' | 'tickets_resolved' | 'customer_replies' | 'staff_replies';
  name: string;
  color: string;
}

const SERIES: SeriesDef[] = [
  { key: 'tickets_received', name: 'Tickets received', color: 'oklch(var(--primary-400))' },
  { key: 'tickets_resolved', name: 'Tickets resolved', color: 'oklch(var(--accent-400))' },
  { key: 'customer_replies', name: 'Customer replies', color: 'oklch(var(--secondary-300))' },
  { key: 'staff_replies', name: 'Public staff replies', color: 'oklch(var(--foreground-300))' },
];

const GRANULARITY_LABEL: Record<VolumeGranularity, string> = {
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
};

interface VolumeTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ dataKey?: string; name?: string; value?: number; color?: string }>;
}

function VolumeTooltip({ active, label, payload }: VolumeTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-background-200/95 border border-background-300/60 rounded-lg px-3 py-2 text-xs shadow-none">
      <p className="text-foreground-300 font-medium mb-1.5">{label}</p>
      {payload.map((entry) => (
        <p
          key={entry.dataKey ?? entry.name}
          className="flex items-center gap-2 text-foreground-200 leading-relaxed"
        >
          <span
            className="w-2 h-2 rounded-full inline-block shrink-0"
            style={{ backgroundColor: entry.color }}
            aria-hidden="true"
          ></span>
          {entry.name}: <span className="font-semibold tabular-nums">{entry.value ?? 0}</span>
        </p>
      ))}
    </div>
  );
}

interface TicketVolumeChartProps {
  data: SupportVolumePoint[] | null;
  loading: boolean;
  error: string | null;
  granularity: VolumeGranularity;
  lastRefreshed: Date | null;
  onRetry: () => void;
}

export default function TicketVolumeChart({
  data,
  loading,
  error,
  granularity,
  lastRefreshed,
  onRetry,
}: TicketVolumeChartProps) {
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hasData = useMemo(() => {
    if (!data) return false;
    return data.some(
      (p) =>
        p.tickets_received > 0 ||
        p.tickets_resolved > 0 ||
        p.customer_replies > 0 ||
        p.staff_replies > 0,
    );
  }, [data]);

  const chartData = useMemo(() => data ?? [], [data]);

  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <div>
          <h2 className="text-base font-heading font-semibold text-foreground-100">
            Ticket volume
          </h2>
          <p className="text-xs text-foreground-500 mt-0.5">
            {GRANULARITY_LABEL[granularity]} grouping · tickets received and resolved, plus replies.
          </p>
        </div>
        {lastRefreshed && !loading && (
          <span className="text-xs text-foreground-500 whitespace-nowrap">
            Refreshed{' '}
            {lastRefreshed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>

      {loading ? (
        <div
          className="h-[300px] mt-3 rounded-md bg-background-200/40 animate-pulse"
          aria-hidden="true"
        ></div>
      ) : error ? (
        <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-6 flex flex-col items-center justify-center gap-3 min-h-[300px]">
          <i className="ri-error-warning-line text-red-400 text-2xl w-8 h-8 flex items-center justify-center"></i>
          <p className="text-sm text-red-400 text-center max-w-md">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 text-sm text-red-300 hover:text-red-200 px-3 py-2 rounded-lg border border-red-500/30 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line text-base w-4 h-4 flex items-center justify-center"></i>
            Retry
          </button>
        </div>
      ) : !hasData ? (
        <div className="mt-3 rounded-lg bg-background-200/30 border border-background-200/60 px-4 py-6 flex flex-col items-center justify-center gap-2 min-h-[300px]">
          <i className="ri-line-chart-line text-foreground-500 text-2xl w-8 h-8 flex items-center justify-center"></i>
          <p className="text-sm text-foreground-400">No ticket activity in this period.</p>
        </div>
      ) : (
        <div className="mt-3">
          <div className="w-full h-[300px]" role="img" aria-label="Ticket volume line chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                accessibilityLayer
              >
                <CartesianGrid
                  stroke="oklch(var(--background-400) / 0.35)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'oklch(var(--foreground-500))' }}
                  tickLine={false}
                  axisLine={{ stroke: 'oklch(var(--background-400) / 0.5)' }}
                  minTickGap={20}
                  interval="preserveStartEnd"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'oklch(var(--foreground-500))' }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip content={<VolumeTooltip />} cursor={{ stroke: 'oklch(var(--foreground-500) / 0.4)' }} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  iconType="plainline"
                />
                {SERIES.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={!reducedMotion}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Accessible table alternative */}
      {!loading && !error && hasData && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <caption className="sr-only">Ticket volume by period</caption>
            <thead>
              <tr className="text-left text-[11px] font-label uppercase tracking-wider text-foreground-500 border-b border-background-200/60">
                <th scope="col" className="py-2 pr-3 font-label font-medium">Period</th>
                {SERIES.map((s) => (
                  <th scope="col" key={s.key} className="py-2 px-3 font-label font-medium whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: s.color }}
                        aria-hidden="true"
                      ></span>
                      {s.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr
                  key={point.period}
                  className="border-b border-background-200/40 hover:bg-background-200/30 transition-colors"
                >
                  <th scope="row" className="py-2 pr-3 font-medium text-foreground-300 whitespace-nowrap">
                    {point.label}
                  </th>
                  {SERIES.map((s) => (
                    <td key={s.key} className="py-2 px-3 text-foreground-200 tabular-nums">
                      {point[s.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}