import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { CategoryTrend } from '@/types/support-tickets';

export function formatDuration(seconds: number | null): string {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m === 0 ? `${h}h` : `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function formatPct(value: number | null): string {
  return value == null ? '—' : `${value}%`;
}

const TREND_META: Record<CategoryTrend, { icon: string; cls: string; label: string }> = {
  increasing: { icon: 'ri-arrow-up-line', cls: 'text-red-400', label: 'Increasing' },
  decreasing: { icon: 'ri-arrow-down-line', cls: 'text-emerald-400', label: 'Decreasing' },
  stable: { icon: 'ri-subtract-line', cls: 'text-foreground-500', label: 'Stable' },
};

export function TrendBadge({ trend }: { trend: CategoryTrend }) {
  const m = TREND_META[trend] ?? TREND_META.stable;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${m.cls} whitespace-nowrap`}>
      <i className={`${m.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
      {m.label}
    </span>
  );
}

export function SectionCard({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-heading font-semibold text-foreground-100">{title}</h2>
          {subtitle && <p className="text-xs text-foreground-500 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  accent = 'text-foreground-400',
  description,
  to,
  loading,
}: {
  label: string;
  value: string | number;
  icon: string;
  accent?: string;
  description?: string;
  to?: string;
  loading?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wider whitespace-nowrap">
          {label}
        </span>
        <i className={`${icon} ${accent} text-base w-5 h-5 flex items-center justify-center`}></i>
      </div>
      {loading ? (
        <div className="mt-2 h-7 w-14 rounded-md bg-background-200/60 animate-pulse" aria-hidden="true"></div>
      ) : (
        <p className="text-xl font-heading font-bold text-foreground-50 mt-1 tabular-nums">{value}</p>
      )}
      {description && <p className="text-[11px] text-foreground-500 mt-1 leading-snug">{description}</p>}
    </>
  );

  const cls =
    'bg-background-50 border border-background-200/60 rounded-lg p-3 md:p-4 min-h-[96px] flex flex-col';

  if (to) {
    return (
      <Link to={to} className={`${cls} transition-colors hover:border-foreground-400/40 group`}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
      role="group"
      aria-label="Analytics metrics"
    >
      {children}
    </div>
  );
}

export function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="rounded-lg bg-background-200/30 border border-background-200/60 px-4 py-8 flex flex-col items-center justify-center gap-2">
      <i className={`${icon} text-foreground-500 text-2xl w-8 h-8 flex items-center justify-center`}></i>
      <p className="text-sm text-foreground-400 text-center max-w-md">{message}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-6 flex flex-col items-center justify-center gap-3">
      <i className="ri-error-warning-line text-red-400 text-2xl w-8 h-8 flex items-center justify-center"></i>
      <p className="text-sm text-red-400 text-center max-w-md">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 text-sm text-red-300 hover:text-red-200 px-3 py-2 rounded-lg border border-red-500/30 transition-colors cursor-pointer whitespace-nowrap"
      >
        <i className="ri-refresh-line text-base w-4 h-4 flex items-center justify-center"></i>
        Retry
      </button>
    </div>
  );
}