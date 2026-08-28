import { useMemo, useState } from 'react';
import { useRuntimeHealth } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { HEALTH_STATUS_META } from '@/lib/ai-operations/runtimeHealth';
import type { RuntimeHealthStatus } from '@/lib/ai-operations/runtimeHealth';
import type { AiRuntimeHealthCheckRow } from '@/lib/ai-operations/runtimeMonitoring';
import {
  EFFECTIVE_PATH_META,
  describeLocalRuntime,
} from '@/lib/ai-operations/runtimeHealthSource';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import SystemHealthDetail from '@/pages/ai-operations/runtime-health/components/SystemHealthDetail';

export const SYSTEM_LABELS: Record<string, string> = {
  supabase: 'Supabase',
  n8n: 'n8n',
  ollama: 'Ollama',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  resend: 'Email (Resend)',
  stripe: 'Stripe',
  github: 'GitHub',
  readdy: 'Readdy',
  monitoring: 'Monitoring',
  notifications: 'Notifications',
  site_api: 'Site API',
};

const TIME_RANGES = [
  { key: 'all', label: 'All time' },
  { key: '24h', label: 'Last 24h', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', label: 'Last 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
];

const SOURCE_OPTIONS = [
  { key: 'all', label: 'All Sources' },
  { key: 'cloud_edge', label: 'Cloud Edge' },
  { key: 'local_bridge', label: 'Local Bridge' },
];

const LOCAL_BRIDGE_SYSTEMS = ['n8n', 'ollama'];

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

export default function HealthHistory() {
  const { checks, sweeps, rules, historyLoading, latestBySystem, effectivePaths } = useRuntimeHealth();
  const [system, setSystem] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [trigger, setTrigger] = useState<string>('all');
  const [range, setRange] = useState<string>('all');
  const [source, setSource] = useState<string>('all');
  const [selected, setSelected] = useState<string | null>(null);

  const systems = useMemo(() => {
    const set = new Set<string>();
    for (const c of checks) set.add(c.system_slug);
    for (const r of rules) set.add(r.system_slug);
    return [...set].sort();
  }, [checks, rules]);

  const filtered = useMemo(() => {
    const rangeMs = TIME_RANGES.find((r) => r.key === range)?.ms ?? null;
    return checks.filter((c) => {
      if (system !== 'all' && c.system_slug !== system) return false;
      if (status !== 'all' && c.status !== status) return false;
      if (trigger !== 'all' && c.trigger_type !== trigger) return false;
      if (rangeMs && new Date(c.checked_at).getTime() < Date.now() - rangeMs) return false;
      return true;
    });
  }, [checks, system, status, trigger, range]);

  const selectedSystem = selected ?? null;
  const isLocalBridge = source === 'local_bridge';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-3 flex flex-wrap items-center gap-2.5">
        <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap mr-1">Filter</span>

        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="bg-background-50 border border-background-300/60 rounded-md px-2.5 py-1.5 text-sm text-foreground-100 outline-none cursor-pointer"
        >
          {SOURCE_OPTIONS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>

        <select
          value={system}
          onChange={(e) => setSystem(e.target.value)}
          className="bg-background-50 border border-background-300/60 rounded-md px-2.5 py-1.5 text-sm text-foreground-100 outline-none cursor-pointer"
        >
          <option value="all">All systems</option>
          {systems.map((s) => (
            <option key={s} value={s}>{SYSTEM_LABELS[s] ?? s}</option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-background-50 border border-background-300/60 rounded-md px-2.5 py-1.5 text-sm text-foreground-100 outline-none cursor-pointer"
        >
          <option value="all">All statuses</option>
          {(Object.keys(HEALTH_STATUS_META) as RuntimeHealthStatus[]).map((s) => (
            <option key={s} value={s}>{HEALTH_STATUS_META[s].label}</option>
          ))}
        </select>

        <select
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          className="bg-background-50 border border-background-300/60 rounded-md px-2.5 py-1.5 text-sm text-foreground-100 outline-none cursor-pointer"
        >
          <option value="all">Manual + scheduled</option>
          <option value="manual">Manual only</option>
          <option value="scheduled">Scheduled only</option>
        </select>

        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="bg-background-50 border border-background-300/60 rounded-md px-2.5 py-1.5 text-sm text-foreground-100 outline-none cursor-pointer"
        >
          {TIME_RANGES.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>

        <span className="ml-auto text-[11px] font-label text-foreground-600 whitespace-nowrap">
          {filtered.length} of {checks.length} checks · {sweeps.length} sweeps recorded
        </span>
      </div>

      {isLocalBridge ? (
        <LocalBridgePanel latestBySystem={latestBySystem} effectivePaths={effectivePaths} />
      ) : (
        /* History table */
        <section className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-background-200/60">
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Health History</h3>
          </div>

          {historyLoading && filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-foreground-500">
              Loading health history…
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <i className="ri-history-line text-2xl text-foreground-600 w-6 h-6 flex items-center justify-center mx-auto"></i>
              <p className="text-sm text-foreground-500 mt-2">No health checks recorded yet.</p>
              <p className="text-xs text-foreground-600 mt-1">Run a health sweep or wait for the next scheduled monitoring cycle.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
                    <th className="px-4 py-2.5 whitespace-nowrap">Checked At</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">System</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">Source</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">Status</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">Latency</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">Trigger</th>
                    <th className="px-4 py-2.5 whitespace-nowrap">Safe Result</th>
                    <th className="px-4 py-2.5 whitespace-nowrap text-right">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c: AiRuntimeHealthCheckRow) => {
                    const meta = HEALTH_STATUS_META[c.status as RuntimeHealthStatus];
                    return (
                      <tr key={c.check_key} className="border-b border-background-200/40 last:border-0 hover:bg-background-50/60 transition-colors">
                        <td className="px-4 py-2.5 text-xs text-foreground-500 whitespace-nowrap">{formatDateTime(c.checked_at)}</td>
                        <td className="px-4 py-2.5 text-sm text-foreground-100 whitespace-nowrap">{SYSTEM_LABELS[c.system_slug] ?? c.system_slug}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-foreground-600 bg-background-50 border border-background-200/50 rounded-full px-2 py-0.5 whitespace-nowrap">
                            <i className="ri-cloud-line w-3 h-3 flex items-center justify-center"></i>
                            Cloud Edge
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusPill tone={meta.tone} label={meta.label} pulse={c.status === 'degraded'} />
                        </td>
                        <td className="px-4 py-2.5 text-xs text-foreground-500 whitespace-nowrap">
                          {c.latency_ms != null ? `${c.latency_ms} ms` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-foreground-500 whitespace-nowrap capitalize">{c.trigger_type}</td>
                        <td className="px-4 py-2.5 text-xs text-foreground-500 max-w-[280px]">
                          <span className="line-clamp-2 leading-relaxed" title={c.safe_message ?? undefined}>{c.safe_message ?? '—'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSelected(c.system_slug)}
                            className="inline-flex items-center gap-1 text-[11px] font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-line-chart-line w-3.5 h-3.5 flex items-center justify-center"></i>
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {selectedSystem && (
        <SystemHealthDetail system={selectedSystem} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function LocalBridgePanel({
  latestBySystem,
  effectivePaths,
}: {
  latestBySystem: ReturnType<typeof useRuntimeHealth>['latestBySystem'];
  effectivePaths: ReturnType<typeof useRuntimeHealth>['effectivePaths'];
}) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Local Bridge Health</h3>
      </div>

      <div className="divide-y divide-background-200/40">
        {LOCAL_BRIDGE_SYSTEMS.map((system) => {
          const sources = latestBySystem.get(system);
          const local = sources?.local_bridge;
          const view = describeLocalRuntime(local);
          const path = effectivePaths[system];
          const pathMeta = path ? EFFECTIVE_PATH_META[path] : null;
          return (
            <div key={system} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground-100 whitespace-nowrap">{SYSTEM_LABELS[system] ?? system}</p>
                <p className="text-[10px] font-label text-foreground-600 mt-0.5 whitespace-nowrap">
                  {local ? `reported ${formatDateTime(local.lastCheckedAt)}` : 'No local heartbeat reported'}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {pathMeta && (
                  <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">{pathMeta.label}</span>
                )}
                <StatusPill tone={view.tone} label={view.label} pulse={local?.currentStatus === 'degraded'} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2.5 border-t border-background-200/60 flex items-center gap-2">
        <i className="ri-information-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-[11px] text-foreground-600 leading-relaxed">
          Local Bridge health is relayed via the outbound HAL runtime bridge heartbeat — it is a separate source from Cloud Edge checks and is never merged into one ambiguous status.
        </p>
      </div>
    </section>
  );
}