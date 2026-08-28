import { useRuntimeHealth, checkRuntimeHealth } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { HEALTH_STATUS_META } from '@/lib/ai-operations/runtimeHealth';
import { computeAvailability } from '@/lib/ai-operations/runtimeMonitoring';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

interface RuntimeConnectivityProps {
  connectionKey: string;
  system: string | null;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Runtime-connectivity panel. Shows the latest verified runtime result (session)
 * alongside the latest persisted monitoring state for the mapped system. Never
 * auto-checks on mount — the "Check Health" action is manual.
 */
export default function RuntimeConnectivity({ connectionKey, system }: RuntimeConnectivityProps) {
  const health = useRuntimeHealth();
  const result = health.results[connectionKey];
  const checking = health.checkingKeys.includes(connectionKey);
  const meta = result ? HEALTH_STATUS_META[result.status] : null;

  const derived = system ? health.latestBySystem.get(system) : undefined;
  const systemChecks = system
    ? health.checks.filter((c) => c.system_slug === system)
    : [];
  const availability = system ? computeAvailability(systemChecks) : null;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Runtime Connectivity</h3>
        <span className="text-[10px] font-label text-foreground-600">server-side verified</span>
      </div>

      <div className="p-4">
        {meta ? (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={meta.tone} label={meta.label} pulse={result?.status === 'degraded'} />
              {result?.latencyMs != null && (
                <span className="text-xs font-label text-foreground-500 whitespace-nowrap">{result.latencyMs} ms</span>
              )}
              <span className="text-[11px] font-label text-foreground-600 whitespace-nowrap">
                checked {new Date(result!.checkedAt).toLocaleTimeString('en-US', { hour12: false })}
              </span>
            </div>
            <p className="text-xs text-foreground-500 leading-relaxed">{result!.safeMessage}</p>
          </div>
        ) : (
          <div className="text-[11px] font-label text-foreground-600">
            {derived
              ? 'Latest persisted monitoring state shown below (no live session check yet).'
              : 'Not Checked'}
          </div>
        )}

        {/* Persisted monitoring state (from ai_runtime_health_checks) */}
        {derived && (
          <div className="mt-3 pt-3 border-t border-background-200/40 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Last Checked" value={formatTime(derived.lastCheckedAt)} />
            <Stat label="Last Healthy" value={formatTime(derived.lastHealthyAt)} />
            <Stat label="Consecutive Failures" value={String(derived.consecutiveFailures)} tone={derived.consecutiveFailures > 0 ? 'red' : undefined} />
            <Stat label="24h Availability" value={availability != null ? `${availability}%` : 'Insufficient history'} />
          </div>
        )}

        {system && (
          <button
            onClick={() => void checkRuntimeHealth(system, connectionKey)}
            disabled={checking}
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={`ri-refresh-line text-sm w-3.5 h-3.5 flex items-center justify-center ${checking ? 'animate-spin' : ''}`}></i>
            {checking ? 'Checking…' : 'Check Health'}
          </button>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'red' }) {
  return (
    <div className="bg-background-50 border border-background-200/40 rounded-md px-2.5 py-2">
      <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-xs font-heading font-bold mt-0.5 ${tone === 'red' ? 'text-red-400' : 'text-foreground-100'}`}>{value}</p>
    </div>
  );
}