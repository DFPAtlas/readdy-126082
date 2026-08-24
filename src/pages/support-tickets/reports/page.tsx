import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ReportRangeKey } from '@/types/support-tickets';
import { useAuth } from '@/components/feature/AuthGuard';
import {
  useSupportSummary,
  useSupportVolume,
  useSupportSitePerformance,
  useSupportSlaSummary,
  useSupportSlaBreaches,
  useSupportStaffWorkload,
  useSupportUnassignedSummary,
} from './hooks';
import SummaryMetricsGrid from './components/SummaryMetricsGrid';
import TicketVolumeChart from './components/TicketVolumeChart';
import SitePerformanceTable from './components/SitePerformanceTable';
import SlaPerformanceSection from './components/SlaPerformanceSection';
import StaffWorkloadSection from './components/StaffWorkloadSection';
import { useAnalyticsSites } from './analytics-hooks';
import AnalyticsOverview from './components/AnalyticsOverview';
import CategoryAnalytics from './components/CategoryAnalytics';
import DiagnosticRepairAnalytics from './components/DiagnosticRepairAnalytics';
import SessionKnowledgeAnalytics from './components/SessionKnowledgeAnalytics';
import AiQualityAnalytics from './components/AiQualityAnalytics';
import RoutingEscalationAnalytics from './components/RoutingEscalationAnalytics';

const RANGE_OPTIONS: { value: ReportRangeKey; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom' },
];

const MAX_RANGE_DAYS = 366;

interface RangeResult {
  start: string;
  end: string;
  label: string;
  valid: boolean;
  error?: string;
}

function isoDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeRange(params: URLSearchParams): RangeResult {
  const key = (params.get('range') ?? '7d') as ReportRangeKey;
  if (!RANGE_OPTIONS.some((o) => o.value === key)) {
    return { start: '', end: '', label: '', valid: false, error: 'Invalid range' };
  }

  const now = new Date();

  if (key === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start: start.toISOString(), end: now.toISOString(), label: 'Today', valid: true };
  }

  if (key === '7d') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: now.toISOString(), label: 'Last 7 days', valid: true };
  }

  if (key === '30d') {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: now.toISOString(), label: 'Last 30 days', valid: true };
  }

  if (key === '90d') {
    const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: now.toISOString(), label: 'Last 90 days', valid: true };
  }

  // Custom range
  const fromRaw = params.get('from');
  const toRaw = params.get('to');
  if (!fromRaw || !toRaw) {
    return { start: '', end: '', label: 'Custom', valid: false, error: 'Select a start and end date' };
  }
  const fromDate = new Date(`${fromRaw}T00:00:00`);
  const toDate = new Date(`${toRaw}T23:59:59.999`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return { start: '', end: '', label: 'Custom', valid: false, error: 'Invalid date' };
  }
  if (fromDate.getTime() > toDate.getTime()) {
    return { start: '', end: '', label: 'Custom', valid: false, error: 'Start date must be before end date' };
  }
  const diffDays = (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000);
  if (diffDays > MAX_RANGE_DAYS) {
    return { start: '', end: '', label: 'Custom', valid: false, error: 'Range is too large' };
  }
  return {
    start: fromDate.toISOString(),
    end: toDate.toISOString(),
    label: `${isoDateOnly(fromDate)} — ${isoDateOnly(toDate)}`,
    valid: true,
  };
}

export default function SupportReports() {
  const [searchParams, setSearchParams] = useSearchParams();

  const rangeKey = (searchParams.get('range') ?? '7d') as ReportRangeKey;
  const safeRangeKey: ReportRangeKey = RANGE_OPTIONS.some((o) => o.value === rangeKey)
    ? rangeKey
    : '7d';

  const range = useMemo(() => computeRange(searchParams), [searchParams]);
  const { summary, loading, error, lastRefreshed, refresh: refreshSummary } = useSupportSummary(
    range.valid ? range.start : '',
    range.valid ? range.end : '',
  );
  const {
    volume,
    loading: volumeLoading,
    error: volumeError,
    lastRefreshed: volumeLastRefreshed,
    refresh: refreshVolume,
    granularity,
  } = useSupportVolume(
    range.valid ? range.start : '',
    range.valid ? range.end : '',
  );
  const {
    rows: siteRows,
    loading: siteLoading,
    error: siteError,
    lastRefreshed: siteLastRefreshed,
    refresh: refreshSites,
  } = useSupportSitePerformance(
    range.valid ? range.start : '',
    range.valid ? range.end : '',
  );

  const selectedSiteId = searchParams.get('site') ?? 'all';
  const siteFilter = selectedSiteId === 'all' ? null : selectedSiteId;

  const {
    summary: slaSummary,
    loading: slaSummaryLoading,
    error: slaSummaryError,
    refresh: refreshSlaSummary,
  } = useSupportSlaSummary(
    range.valid ? range.start : '',
    range.valid ? range.end : '',
    siteFilter,
  );
  const {
    rows: slaBreaches,
    loading: slaBreachesLoading,
    error: slaBreachesError,
    lastRefreshed: slaBreachesLastRefreshed,
    refresh: refreshSlaBreaches,
  } = useSupportSlaBreaches(
    range.valid ? range.start : '',
    range.valid ? range.end : '',
    siteFilter,
  );

  const auth = useAuth();
  const { sites: analyticsSites } = useAnalyticsSites();
  const canViewStaff = auth.role === 'owner' || auth.role === 'admin' || auth.role === 'support_manager';

  const {
    summary: unassignedSummary,
    loading: unassignedLoading,
    error: unassignedError,
    refresh: refreshUnassigned,
  } = useSupportUnassignedSummary(
    range.valid ? range.start : '',
    range.valid ? range.end : '',
    siteFilter,
    canViewStaff,
  );
  const {
    rows: staffRows,
    loading: staffLoading,
    error: staffError,
    lastRefreshed: staffLastRefreshed,
    refresh: refreshStaff,
  } = useSupportStaffWorkload(
    range.valid ? range.start : '',
    range.valid ? range.end : '',
    siteFilter,
    canViewStaff,
  );

  const handleRefresh = () => {
    refreshSummary();
    refreshVolume();
    refreshSites();
    refreshSlaSummary();
    refreshSlaBreaches();
    refreshUnassigned();
    refreshStaff();
  };

  const setSelectedSite = (id: string) => {
    const params = new URLSearchParams(searchParams);
    if (id === 'all') params.delete('site');
    else params.set('site', id);
    setSearchParams(params, { replace: false });
  };

  const setRangeKey = (key: ReportRangeKey) => {
    const params = new URLSearchParams(searchParams);
    params.set('range', key);
    if (key !== 'custom') {
      params.delete('from');
      params.delete('to');
    }
    setSearchParams(params, { replace: false });
  };

  const setCustomDate = (field: 'from' | 'to', value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('range', 'custom');
    if (value) params.set(field, value);
    else params.delete(field);
    setSearchParams(params, { replace: false });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Support Analytics</h1>
          <p className="text-sm text-foreground-500 mt-1">
            Operational analytics across tickets, SLA, teams, sites, diagnostics, repairs and AI quality.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-foreground-500 whitespace-nowrap">
            {lastRefreshed
              ? `Refreshed ${lastRefreshed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
              : ''}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={!range.valid}
            className="inline-flex items-center gap-1.5 text-sm text-foreground-400 hover:text-foreground-200 transition-colors px-3 py-2 rounded-lg border border-background-200/60 cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i className="ri-refresh-line text-base w-4 h-4 flex items-center justify-center"></i>
            Refresh
          </button>
          <Link
            to="/support-tickets"
            className="inline-flex items-center gap-1.5 text-sm text-foreground-400 hover:text-foreground-200 transition-colors px-3 py-2 rounded-lg border border-background-200/60 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-left-line text-base w-4 h-4 flex items-center justify-center"></i>
            Back to Support Tickets
          </Link>
        </div>
      </div>

      {/* Date range controls */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <div className="flex flex-col gap-3">
          <div
            className="inline-flex items-center gap-1 p-1 rounded-full bg-background-200/50 self-start flex-wrap"
            role="group"
            aria-label="Reporting period"
          >
            {RANGE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setRangeKey(o.value)}
                aria-pressed={safeRangeKey === o.value}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer whitespace-nowrap ${
                  safeRangeKey === o.value
                    ? 'bg-accent-500 text-background-950 font-semibold'
                    : 'text-foreground-400 hover:text-foreground-200'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-foreground-500">
              <span className="whitespace-nowrap">Product / site</span>
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSite(e.target.value)}
                aria-label="Filter by site"
                className="bg-background-50 border border-background-300/60 rounded-lg px-2.5 py-1.5 text-sm text-foreground-100 outline-none cursor-pointer hover:border-foreground-400/40"
              >
                <option value="all">All sites</option>
                {(analyticsSites ?? []).map((s) => (
                  <option key={s.site_id} value={s.site_id}>
                    {s.site_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {safeRangeKey === 'custom' && (
            <div className="flex items-end gap-3 flex-wrap">
              <label className="flex flex-col gap-1 text-xs text-foreground-500">
                Start date
                <input
                  type="date"
                  value={searchParams.get('from') ?? ''}
                  onChange={(e) => setCustomDate('from', e.target.value)}
                  className="bg-background-200/50 border border-background-300/60 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none focus:border-accent-500"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-foreground-500">
                End date
                <input
                  type="date"
                  value={searchParams.get('to') ?? ''}
                  onChange={(e) => setCustomDate('to', e.target.value)}
                  className="bg-background-200/50 border border-background-300/60 rounded-lg px-3 py-2 text-sm text-foreground-100 outline-none focus:border-accent-500"
                />
              </label>
              {range.valid && (
                <span className="text-xs text-foreground-500 pb-2 whitespace-nowrap">
                  Showing <span className="text-foreground-200 font-medium">{range.label}</span>
                </span>
              )}
            </div>
          )}

          {!range.valid && range.error && (
            <p className="text-sm text-amber-400 flex items-center gap-1.5">
              <i className="ri-error-warning-line text-base w-4 h-4 flex items-center justify-center"></i>
              {range.error}
            </p>
          )}

          <p className="text-xs text-foreground-500">
            Selected period: <span className="text-foreground-300 font-medium">{range.label || '—'}</span>
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div aria-live="polite">
        <SummaryMetricsGrid summary={summary} loading={loading} error={error} />
      </div>

      {/* Ticket volume chart */}
      <div aria-live="polite">
        <TicketVolumeChart
          data={volume}
          loading={volumeLoading}
          error={volumeError}
          granularity={granularity}
          lastRefreshed={volumeLastRefreshed}
          onRetry={refreshVolume}
        />
      </div>

      {/* Website performance table */}
      <div aria-live="polite">
        <SitePerformanceTable
          data={siteRows}
          loading={siteLoading}
          error={siteError}
          lastRefreshed={siteLastRefreshed}
          onRetry={refreshSites}
          selectedSiteId={selectedSiteId}
          onSelectSite={setSelectedSite}
        />
      </div>

      {/* SLA performance */}
      <div aria-live="polite">
        <SlaPerformanceSection
          summary={slaSummary}
          summaryLoading={slaSummaryLoading}
          summaryError={slaSummaryError}
          rows={slaBreaches}
          loading={slaBreachesLoading}
          error={slaBreachesError}
          lastRefreshed={slaBreachesLastRefreshed}
          onRetry={refreshSlaBreaches}
        />
      </div>

      {/* Staff workload */}
      <div aria-live="polite">
        <StaffWorkloadSection
          summary={unassignedSummary}
          summaryLoading={unassignedLoading}
          summaryError={unassignedError}
          rows={staffRows}
          loading={staffLoading}
          error={staffError}
          lastRefreshed={staffLastRefreshed}
          onRetry={refreshStaff}
          siteId={siteFilter}
          canView={canViewStaff}
        />
      </div>

      {/* Extended analytics (Prompt 18) */}
      <div aria-live="polite">
        <AnalyticsOverview siteId={siteFilter} />
      </div>

      <div aria-live="polite">
        <CategoryAnalytics
          start={range.valid ? range.start : ''}
          end={range.valid ? range.end : ''}
          siteId={siteFilter}
        />
      </div>

      <div aria-live="polite">
        <DiagnosticRepairAnalytics
          start={range.valid ? range.start : ''}
          end={range.valid ? range.end : ''}
          siteId={siteFilter}
        />
      </div>

      <div aria-live="polite">
        <SessionKnowledgeAnalytics
          start={range.valid ? range.start : ''}
          end={range.valid ? range.end : ''}
          siteId={siteFilter}
        />
      </div>

      <div aria-live="polite">
        <AiQualityAnalytics
          start={range.valid ? range.start : ''}
          end={range.valid ? range.end : ''}
          siteId={siteFilter}
        />
      </div>

      <div aria-live="polite">
        <RoutingEscalationAnalytics
          start={range.valid ? range.start : ''}
          end={range.valid ? range.end : ''}
          siteId={siteFilter}
        />
      </div>
    </div>
  );
}