import { useMemo } from 'react';
import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import {
  useRuntimeHealth,
  recheckConfigAndHealth,
} from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import {
  resolveConnectionSystem,
  resolveProviderSystem,
  buildRuntimeHealthRows,
  HEALTH_STATUS_META,
  type HealthTarget,
  type RuntimeHealthStatus,
} from '@/lib/ai-operations/runtimeHealth';
import {
  CONFIG_SYSTEM_LABELS,
  CONFIG_READINESS_META,
  deriveReadiness,
  type ConfigReadinessState,
  type ConfigHealthInput,
} from '@/lib/ai-operations/runtimeConfig';
import { resolveEffectiveHealth } from '@/lib/ai-operations/runtimeHealthSource';

const TONE_STYLES: Record<'emerald' | 'amber' | 'red' | 'secondary', string> = {
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  red: 'bg-red-500/15 text-red-400 border-red-500/25',
  secondary: 'bg-secondary-500/15 text-secondary-300 border-secondary-500/25',
};

function healthForSystem(
  system: string,
  results: ReturnType<typeof useRuntimeHealth>['results'],
  latestBySystem: ReturnType<typeof useRuntimeHealth>['latestBySystem'],
  effectivePaths: ReturnType<typeof useRuntimeHealth>['effectivePaths'],
): ConfigHealthInput | null {
  const session = Object.values(results).find((r) => r.system === system);
  if (session) {
    return {
      status: session.status,
      authenticated: session.authenticated,
      reachable: session.reachable,
    };
  }
  const persisted = resolveEffectiveHealth(latestBySystem, system, effectivePaths);
  if (persisted) {
    return {
      status: persisted.currentStatus,
      authenticated: null,
      reachable: persisted.currentStatus === 'healthy',
    };
  }
  return null;
}

export default function ConfigurationReadiness() {
  const data = useGroupLiveData();
  const health = useRuntimeHealth();

  const targets: HealthTarget[] = useMemo(() => {
    const rows = buildRuntimeHealthRows(data.tools, data.providers, {});
    return rows
      .filter((r) => r.system !== null)
      .map((r) => ({ system: r.system as string, connectionKey: r.key }));
  }, [data.tools, data.providers]);

  const registryFor = (system: string): string => {
    const connNames = data.tools
      .filter((t) => resolveConnectionSystem(t) === system)
      .map((t) => t.name);
    const provNames = data.providers
      .filter((p) => resolveProviderSystem(p) === system)
      .map((p) => p.name);
    return [...connNames, ...provNames].join(', ') || '—';
  };

  const rechecking = health.configLoading || health.sweeping;

  const handleRecheck = () => {
    if (rechecking) return;
    void recheckConfigAndHealth(targets);
  };

  return (
    <div className="space-y-4">
      {/* Header + recheck action */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <i className="ri-key-2-line text-accent-400 text-sm w-4 h-4 flex items-center justify-center"></i>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Configuration Readiness</h3>
          </div>
          <p className="text-xs text-foreground-500 mt-1">
            Server-side secret-presence verification only. Values are <strong className="text-foreground-300">never</strong> returned to the browser — only <code className="text-foreground-300">configured</code> / <code className="text-foreground-300">missing</code>. Secrets are managed in <strong className="text-foreground-300">Supabase Edge Function Secrets</strong>, not here.
          </p>
        </div>
        <button
          onClick={handleRecheck}
          disabled={rechecking}
          className="inline-flex items-center gap-2 text-xs font-label font-semibold bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
        >
          <i className={`ri-refresh-line text-sm w-4 h-4 flex items-center justify-center ${rechecking ? 'animate-spin' : ''}`}></i>
          {rechecking ? 'Checking…' : 'Recheck Configuration & Health'}
        </button>
      </div>

      {/* Error banner */}
      {health.configError && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-3 flex items-start gap-3">
          <i className="ri-alert-line text-red-400 text-lg w-5 h-5 flex items-center justify-center shrink-0"></i>
          <div className="min-w-0">
            <p className="text-sm font-medium text-red-300">Configuration check failed</p>
            <p className="text-xs text-red-400/80 mt-0.5">{health.configError}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
                <th className="px-4 py-2.5 whitespace-nowrap">System</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Registry</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Required Configuration</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Config State</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Runtime Connectivity</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Authentication</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Safe Test</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Current Blocker</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Readiness</th>
              </tr>
            </thead>
            <tbody>
              {health.configLoading && health.config.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-foreground-500">
                    Loading configuration readiness…
                  </td>
                </tr>
              ) : health.config.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <i className="ri-key-2-line text-2xl text-foreground-600 w-6 h-6 flex items-center justify-center mx-auto"></i>
                    <p className="text-sm text-foreground-500 mt-2">No configuration inventory loaded.</p>
                    <p className="text-xs text-foreground-600 mt-1">Run “Recheck Configuration &amp; Health” to verify server-side secret presence.</p>
                  </td>
                </tr>
              ) : (
                health.config.map((cfg) => {
                  const healthInput = healthForSystem(cfg.systemSlug, health.results, health.latestBySystem, health.effectivePaths);
                  const readiness: ConfigReadinessState = deriveReadiness(cfg, healthInput);
                  const meta = CONFIG_READINESS_META[readiness];

                  const connectivityLabel = healthInput
                    ? (HEALTH_STATUS_META[healthInput.status as RuntimeHealthStatus]?.label ?? healthInput.status)
                    : 'Not Checked';

                  const authLabel =
                    healthInput?.authenticated === true
                      ? 'Verified'
                      : healthInput?.authenticated === false
                        ? 'Failed'
                        : '—';

                  const blocker = cfg.blocker ??
                    (!cfg.configured ? `Missing: ${cfg.missingConfig.join(', ')}` : null);

                  return (
                    <tr key={cfg.systemSlug} className="border-b border-background-200/40 last:border-0 hover:bg-background-50/60 transition-colors">
                      <td className="px-4 py-3 text-sm text-foreground-100 whitespace-nowrap">
                        {CONFIG_SYSTEM_LABELS[cfg.systemSlug] ?? cfg.systemSlug}
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground-500 max-w-[140px]">
                        <span className="line-clamp-1" title={registryFor(cfg.systemSlug)}>{registryFor(cfg.systemSlug)}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">
                        {cfg.requiredConfig.length ? cfg.requiredConfig.join(', ') : 'None'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-label rounded-full px-2 py-0.5 border whitespace-nowrap ${cfg.configured ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : 'text-amber-400 bg-amber-500/10 border-amber-500/25'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.configured ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                          {cfg.configured ? 'Configured' : 'Missing'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">{connectivityLabel}</td>
                      <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">{authLabel}</td>
                      <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">
                        {cfg.safeTestSupported ? 'Supported' : 'Not supported'}
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground-500 max-w-[220px]">
                        <span className="line-clamp-2 leading-relaxed" title={blocker ?? undefined}>{blocker ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-label whitespace-nowrap border ${TONE_STYLES[meta.tone]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.tone === 'emerald' ? 'bg-emerald-400' : meta.tone === 'amber' ? 'bg-amber-400' : meta.tone === 'red' ? 'bg-red-400' : 'bg-secondary-400'}`}></span>
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Distinction explainer */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-3 flex items-start gap-3">
        <i className="ri-information-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
        <p className="text-xs text-foreground-500 leading-relaxed">
          Three distinct layers are shown: <strong className="text-foreground-300">Registry Configuration</strong> (metadata persisted in the control plane), <strong className="text-foreground-300">Server Configuration</strong> (required server-side secrets present), and <strong className="text-foreground-300">Runtime Verification</strong> (a safe health check has actually passed). A system is <strong className="text-foreground-300">Ready</strong> only when all three align — registry metadata alone is never sufficient.
        </p>
      </div>
    </div>
  );
}