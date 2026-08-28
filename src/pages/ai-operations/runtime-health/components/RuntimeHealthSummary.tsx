import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useRuntimeHealth } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import {
  effectivePathSummary,
  resolveEffectiveHealth,
} from '@/lib/ai-operations/runtimeHealthSource';

const LOCAL_SYSTEMS = ['n8n', 'ollama'];

/**
 * Compact, reusable runtime-health summary strip used by Live Operations and
 * the Wallboard. Never triggers a check — it only surfaces the latest persisted
 * monitoring state (ai_runtime_health_checks + bridge heartbeat). Shows the
 * deterministic effective runtime path for n8n / Ollama so a healthy local
 * bridge is never presented as a cloud connection.
 */
export default function RuntimeHealthSummary() {
  const health = useRuntimeHealth();
  const latest = health.latestBySystem;

  const summary = useMemo(() => {
    if (latest.size === 0) return null;
    let healthy = 0;
    let degraded = 0;
    let unavailable = 0;
    let notConfigured = 0;
    let notTestable = 0;
    for (const system of latest.keys()) {
      const v = resolveEffectiveHealth(latest, system, health.effectivePaths);
      if (!v) continue;
      if (v.currentStatus === 'healthy') healthy += 1;
      else if (v.currentStatus === 'degraded') degraded += 1;
      else if (v.currentStatus === 'unavailable') unavailable += 1;
      else if (v.currentStatus === 'not_configured') notConfigured += 1;
      else if (v.currentStatus === 'not_testable') notTestable += 1;
    }
    const parts: string[] = [];
    if (healthy) parts.push(`${healthy} healthy`);
    if (degraded) parts.push(`${degraded} degraded`);
    if (unavailable) parts.push(`${unavailable} unavailable`);
    if (notConfigured) parts.push(`${notConfigured} not configured`);
    if (notTestable) parts.push(`${notTestable} not testable`);
    return parts.length ? parts.join(' · ') : 'No results';
  }, [latest, health.effectivePaths]);

  const hasUnavailable = useMemo(
    () =>
      [...latest.keys()].some(
        (system) => resolveEffectiveHealth(latest, system, health.effectivePaths)?.currentStatus === 'unavailable',
      ),
    [latest, health.effectivePaths],
  );

  const localPaths = useMemo(() => {
    const lines: string[] = [];
    for (const system of LOCAL_SYSTEMS) {
      const path = health.effectivePaths[system];
      if (!path) continue;
      const sources = latest.get(system);
      lines.push(effectivePathSummary(system, path, sources?.local_bridge, sources?.cloud_edge));
    }
    return lines;
  }, [latest, health.effectivePaths]);

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-8 h-8 flex items-center justify-center rounded-md shrink-0 ${hasUnavailable ? 'bg-red-500/10' : 'bg-accent-500/10'}`}>
          <i className={`ri-radar-line text-base w-5 h-5 flex items-center justify-center ${hasUnavailable ? 'text-red-400' : 'text-accent-400'}`}></i>
        </span>
        <div className="min-w-0">
          <p className="text-xs font-label font-semibold text-foreground-200 uppercase tracking-wide">Runtime Connectivity</p>
          {summary ? (
            <p className="text-xs text-foreground-500 truncate">{summary}</p>
          ) : (
            <p className="text-xs text-foreground-600">Not Checked</p>
          )}
          {localPaths.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {localPaths.map((line) => (
                <span key={line} className="text-[11px] font-label text-accent-400 whitespace-nowrap">{line}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <Link
        to="/ai-operations/runtime-health"
        className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-3 py-1.5 hover:bg-accent-500/20 transition-colors cursor-pointer whitespace-nowrap"
      >
        <i className="ri-external-link-line w-3.5 h-3.5 flex items-center justify-center"></i>
        Runtime Health
      </Link>
    </section>
  );
}