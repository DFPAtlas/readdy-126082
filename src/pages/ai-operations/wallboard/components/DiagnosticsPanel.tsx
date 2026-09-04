import { useCallback, useState } from 'react';
import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { useBusinessData } from '@/pages/ai-operations/wallboard/businessStore';
import { useInfrastructureData } from '@/pages/ai-operations/wallboard/infrastructureStore';
import { usePowerData } from '@/pages/ai-operations/wallboard/powerStore';
import { useSecurityData } from '@/pages/ai-operations/wallboard/securityStore';
import { useBackupData } from '@/pages/ai-operations/wallboard/backupStore';
import { useSiteMonitorData } from '@/pages/ai-operations/wallboard/siteStore';
import { useWorkloadData } from '@/pages/ai-operations/wallboard/workloadStore';
import { useRuntimeHealth } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { fetchWallboardWeather } from '@/pages/ai-operations/wallboard/weather';
import {
  getDataSourceDiagnostics,
  getMetricTraces,
  getSnapshotDiagnostic,
  getDemoAudit,
  DIAGNOSTIC_STATUS_META,
  type DiagnosticSourceStatus,
} from '@/pages/ai-operations/wallboard/wallboardDiagnostics';

interface DiagnosticsPanelProps {
  open: boolean;
  staleMs: number;
  onRefresh: () => Promise<boolean>;
  onClose: () => void;
}

function formatTime(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatAgo(now: number, d: Date | null): string {
  if (!d) return '—';
  const s = Math.max(0, Math.floor((now - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

function StatusPill({ status }: { status: DiagnosticSourceStatus }) {
  const meta = DIAGNOSTIC_STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2 py-0.5 whitespace-nowrap ${meta.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}></span>
      {meta.label}
    </span>
  );
}

export default function DiagnosticsPanel({ open, staleMs, onRefresh, onClose }: DiagnosticsPanelProps) {
  // Subscribe to every wallboard store so the matrix re-derives live on refresh.
  useGroupLiveData();
  useBusinessData();
  useInfrastructureData();
  usePowerData();
  useSecurityData();
  useBackupData();
  useSiteMonitorData();
  useWorkloadData();
  useRuntimeHealth();

  const [refreshing, setRefreshing] = useState(false);
  const [lastRun, setLastRun] = useState<{ at: number; durationMs: number | null; note: string | null }>({
    at: Date.now(),
    durationMs: null,
    note: null,
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const start = performance.now();
    try {
      const ok = await onRefresh();
      // Weather is a separate (read-only, keyless) fetch — re-check it too.
      await fetchWallboardWeather();
      const durationMs = Math.round(performance.now() - start);
      setLastRun({ at: Date.now(), durationMs, note: ok ? null : 'Core registries failed to load' });
    } catch {
      const durationMs = Math.round(performance.now() - start);
      setLastRun({ at: Date.now(), durationMs, note: 'Refresh did not complete' });
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  if (!open) return null;

  const now = Date.now();
  const sources = getDataSourceDiagnostics(now, staleMs);
  const traces = getMetricTraces(now, staleMs);
  const snapshot = getSnapshotDiagnostic(staleMs, lastRun.durationMs);
  const demo = getDemoAudit();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-lg border border-background-200/60 bg-background-100 text-foreground-50">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-background-200/60 sticky top-0 bg-background-100 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-500 rounded-lg flex items-center justify-center shrink-0">
              <i className="ri-stethoscope-line text-background-950 text-lg w-5 h-5 flex items-center justify-center"></i>
            </div>
            <div>
              <h2 className="text-base font-heading font-bold text-foreground-50 leading-none whitespace-nowrap">
                Wallboard Diagnostics
              </h2>
              <p className="text-[11px] font-label text-foreground-600 mt-0.5 whitespace-nowrap">
                Administrator-only · read-only · no control actions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 text-xs font-label rounded-md px-4 py-1.5 border transition-colors duration-150 cursor-pointer whitespace-nowrap text-background-50 bg-primary-500 border-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className={`${refreshing ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} text-sm w-4 h-4 flex items-center justify-center`}></i>
              {refreshing ? 'Refreshing…' : 'Refresh diagnostics'}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-500 hover:text-foreground-100 hover:bg-background-200/60 transition-colors cursor-pointer"
              aria-label="Close diagnostics"
            >
              <i className="ri-close-line w-5 h-5 flex items-center justify-center"></i>
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-6">
          {/* Snapshot summary */}
          <section>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wider mb-3">
              Snapshot status
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
              <SummaryStat label="Healthy" value={snapshot.healthy} tone="emerald" />
              <SummaryStat label="Degraded" value={snapshot.degraded} tone="amber" />
              <SummaryStat label="Error" value={snapshot.error} tone="red" />
              <SummaryStat label="Stale" value={snapshot.stale} tone="amber" />
              <SummaryStat label="Not configured" value={snapshot.notConfigured} tone="muted" />
              <SummaryStat label="Unknown" value={snapshot.unknown} tone="muted" />
              <SummaryStat
                label="Demo sources"
                value={demo.count}
                tone={demo.count > 0 ? 'red' : 'emerald'}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-label text-foreground-600">
              <span>
                Generated {new Date(lastRun.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span>
                Snapshot duration {lastRun.durationMs != null ? `${lastRun.durationMs} ms` : '—'}
              </span>
              {lastRun.note && <span className="text-amber-400">{lastRun.note}</span>}
              {demo.count === 0 && <span className="text-emerald-400">Demo sources: 0</span>}
            </div>
          </section>

          {/* Data source matrix */}
          <section>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wider mb-3">
              Data source matrix
            </h3>
            <div className="rounded-md border border-background-200/60 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-background-200/40 text-[11px] font-label text-foreground-500 uppercase tracking-wider">
                    <th className="px-3 py-2 font-semibold">Source</th>
                    <th className="px-3 py-2 font-semibold hidden md:table-cell">Used by</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Last success</th>
                    <th className="px-3 py-2 font-semibold hidden sm:table-cell">Last error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-background-200/40">
                  {sources.map((s) => (
                    <tr key={s.key} className="hover:bg-background-200/30 transition-colors">
                      <td className="px-3 py-2.5 text-sm font-label text-foreground-100 whitespace-nowrap">
                        {s.label}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] font-label text-foreground-500 hidden md:table-cell whitespace-nowrap">
                        {s.usedBy}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={s.status} />
                      </td>
                      <td className="px-3 py-2.5 text-[11px] font-label text-foreground-500 whitespace-nowrap">
                        <span className="block">{formatTime(s.lastSuccessAt)}</span>
                        <span className="text-foreground-600">{formatAgo(now, s.lastSuccessAt)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] font-label text-foreground-500 hidden sm:table-cell max-w-[260px]">
                        {s.lastError ? (
                          <span className="text-red-400">{s.lastError}</span>
                        ) : (
                          <span className="text-foreground-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Metric traceability */}
          <section>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wider mb-3">
              Metric traceability
            </h3>
            <div className="rounded-md border border-background-200/60 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-background-200/40 text-[11px] font-label text-foreground-500 uppercase tracking-wider">
                    <th className="px-3 py-2 font-semibold">Metric</th>
                    <th className="px-3 py-2 font-semibold">Source</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Last refresh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-background-200/40">
                  {traces.map((t) => (
                    <tr key={t.metric} className="hover:bg-background-200/30 transition-colors">
                      <td className="px-3 py-2.5 text-sm font-label text-foreground-100 whitespace-nowrap">
                        {t.metric}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] font-label text-foreground-500 whitespace-nowrap">
                        {t.source}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={t.status} />
                      </td>
                      <td className="px-3 py-2.5 text-[11px] font-label text-foreground-500 whitespace-nowrap">
                        {formatAgo(now, t.lastRefresh)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Demo audit */}
          <section className="rounded-md border border-background-200/60 bg-background-200/30 px-4 py-3">
            <div className="flex items-start gap-3">
              <i className="ri-shield-check-line text-lg w-5 h-5 flex items-center justify-center text-emerald-400 shrink-0"></i>
              <div>
                <h4 className="text-sm font-label font-semibold text-foreground-100">
                  Demo / mock data audit
                </h4>
                <p className="text-[11px] font-label text-foreground-500 mt-0.5">
                  {demo.count === 0
                    ? 'No wallboard source is marked demo, mock or placeholder. All sources read live Supabase registries.'
                    : `Demo sources detected: ${demo.sources.join(', ')}`}
                </p>
              </div>
            </div>
          </section>

          {/* Read-only notice */}
          <p className="text-[11px] font-label text-foreground-600">
            Diagnostics is inspection-only. No service restarts, credential rotation, firewall changes,
            backup restores, payment changes or account changes are available here.
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'amber' | 'red' | 'muted' }) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-400'
      : tone === 'amber'
        ? 'text-amber-400'
        : tone === 'red'
          ? 'text-red-400'
          : 'text-foreground-400';
  return (
    <div className="rounded-md border border-background-200/60 bg-background-200/30 px-3 py-2">
      <p className={`text-xl font-heading font-semibold tabular-nums ${toneClass}`}>{value}</p>
      <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wider whitespace-nowrap">{label}</p>
    </div>
  );
}