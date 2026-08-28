import { useMemo } from 'react';
import { useRuntimeHealth } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { computeAvailability } from '@/lib/ai-operations/runtimeMonitoring';
import { resolveEffectiveHealth } from '@/lib/ai-operations/runtimeHealthSource';
import { HEALTH_STATUS_META } from '@/lib/ai-operations/runtimeHealth';
import type { RuntimeHealthStatus } from '@/lib/ai-operations/runtimeHealth';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import { SYSTEM_LABELS } from '@/pages/ai-operations/runtime-health/components/HealthHistory';

interface SystemHealthDetailProps {
  system: string;
  onClose: () => void;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export default function SystemHealthDetail({ system, onClose }: SystemHealthDetailProps) {
  const { checks, latestBySystem, effectivePaths } = useRuntimeHealth();

  const systemChecks = useMemo(
    () => checks.filter((c) => c.system_slug === system),
    [checks, system],
  );

  const derived = resolveEffectiveHealth(latestBySystem, system, effectivePaths);

  const availability = useMemo(() => computeAvailability(systemChecks), [systemChecks]);

  const lastFailure = useMemo(
    () => systemChecks.find((c) => c.status === 'degraded' || c.status === 'unavailable'),
    [systemChecks],
  );

  const lastRecovery = useMemo(() => {
    let seenFailure = false;
    for (const c of systemChecks) {
      if (c.status === 'degraded' || c.status === 'unavailable') seenFailure = true;
      else if (seenFailure && c.status === 'healthy') return c;
    }
    return undefined;
  }, [systemChecks]);

  const latencies = useMemo(
    () =>
      systemChecks
        .map((c) => c.latency_ms)
        .filter((v): v is number => v != null && v >= 0)
        .slice(0, 20)
        .reverse(),
    [systemChecks],
  );

  const currentStatus = derived?.currentStatus ?? 'unknown';
  const meta = HEALTH_STATUS_META[currentStatus];

  const configState = systemChecks[0]?.configuration_state ?? 'unknown';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative bg-background-100 border border-background-200/60 rounded-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-background-100 border-b border-background-200/60 px-5 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-heading font-semibold text-foreground-50">{SYSTEM_LABELS[system] ?? system}</h3>
              <StatusPill tone={meta.tone} label={meta.label} pulse={currentStatus === 'degraded'} />
            </div>
            <p className="text-xs text-foreground-500 mt-1">Runtime health history · connectivity only (no inference / no workflow execution).</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-500 hover:text-foreground-100 hover:bg-background-50 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <i className="ri-close-line text-lg w-5 h-5 flex items-center justify-center"></i>
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Metric label="Current Status">
              <span className="text-sm font-heading font-bold text-foreground-50">{meta.label}</span>
            </Metric>
            <Metric label="Last Checked">
              <span className="text-sm font-heading font-bold text-foreground-50">{formatDateTime(derived?.lastCheckedAt ?? null)}</span>
            </Metric>
            <Metric label="Last Healthy">
              <span className="text-sm font-heading font-bold text-foreground-50">{formatDateTime(derived?.lastHealthyAt ?? null)}</span>
            </Metric>
            <Metric label="Consecutive Failures">
              <span className={`text-sm font-heading font-bold ${(derived?.consecutiveFailures ?? 0) > 0 ? 'text-red-400' : 'text-foreground-50'}`}>
                {derived?.consecutiveFailures ?? 0}
              </span>
            </Metric>
            <Metric label="Consecutive Successes">
              <span className="text-sm font-heading font-bold text-emerald-400">{derived?.consecutiveSuccesses ?? 0}</span>
            </Metric>
            <Metric label="Avg Latency">
              <span className="text-sm font-heading font-bold text-foreground-50">
                {derived?.averageLatencyMs != null ? `${derived.averageLatencyMs} ms` : '—'}
              </span>
            </Metric>
            <Metric label="24h Availability">
              <span className="text-sm font-heading font-bold text-foreground-50">
                {availability != null ? `${availability}%` : 'Insufficient history'}
              </span>
            </Metric>
            <Metric label="Configuration State">
              <span className="text-sm font-heading font-bold text-foreground-50 capitalize">{configState}</span>
            </Metric>
            <Metric label="Total Checks">
              <span className="text-sm font-heading font-bold text-foreground-50">{systemChecks.length}</span>
            </Metric>
          </div>

          {/* Last failure / recovery */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-background-50 border border-background-200/40 rounded-md px-3 py-2.5">
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Last Failure</p>
              <p className="text-sm text-foreground-100 mt-1">
                {lastFailure ? `${formatDateTime(lastFailure.checked_at)} · ${lastFailure.safe_message ?? ''}` : 'No failure recorded'}
              </p>
            </div>
            <div className="bg-background-50 border border-background-200/40 rounded-md px-3 py-2.5">
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Last Recovery</p>
              <p className="text-sm text-foreground-100 mt-1">
                {lastRecovery ? formatDateTime(lastRecovery.checked_at) : 'No recovery recorded'}
              </p>
            </div>
          </div>

          {/* Latency trend (simple sparkline bars) */}
          {latencies.length > 1 && (
            <div>
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide mb-2">Latency trend (recent)</p>
              <div className="flex items-end gap-1 h-16">
                {latencies.map((l, i) => {
                  const max = Math.max(...latencies, 1);
                  const h = Math.max(8, Math.round((l / max) * 64));
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] font-label text-foreground-600">{l}ms</span>
                      <div className="w-full bg-accent-500/60 rounded-sm" style={{ height: `${h}px` }}></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent checks */}
          <div>
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide mb-2">Recent checks</p>
            <div className="divide-y divide-background-200/40 border border-background-200/40 rounded-md overflow-hidden">
              {systemChecks.slice(0, 10).map((c) => {
                const m = HEALTH_STATUS_META[c.status as RuntimeHealthStatus];
                return (
                  <div key={c.check_key} className="px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-foreground-100 truncate" title={c.safe_message ?? undefined}>
                        {c.safe_message ?? '—'}
                      </p>
                      <p className="text-[10px] font-label text-foreground-600">{formatDateTime(c.checked_at)} · {c.trigger_type}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-[10px] font-label text-foreground-600">{c.latency_ms != null ? `${c.latency_ms}ms` : ''}</span>
                      <StatusPill tone={m.tone} label={m.label} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-background-50 border border-background-200/40 rounded-md px-3 py-2.5">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}