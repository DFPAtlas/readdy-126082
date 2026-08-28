import { useEffect, useMemo } from 'react';
import { useRuntimeHealth } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { useOllamaCatalogue, refreshOllamaCatalogue } from '@/pages/ai-operations/models/ollamaCatalogueStore';
import { HEALTH_STATUS_META } from '@/lib/ai-operations/runtimeHealth';
import {
  EFFECTIVE_PATH_META,
  describeLocalRuntime,
  type EffectivePath,
} from '@/lib/ai-operations/runtimeHealthSource';
import { describeCatalogueFreshness } from '@/lib/ai-operations/runtimeOllama';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

const LOCAL_SYSTEMS = ['n8n', 'ollama'];

const SYSTEM_DISPLAY: Record<string, string> = { n8n: 'n8n', ollama: 'Ollama' };

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

function pathPillTone(tone: 'emerald' | 'amber' | 'red' | 'secondary'): string {
  if (tone === 'emerald') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
  if (tone === 'amber') return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
  if (tone === 'red') return 'text-red-400 bg-red-500/10 border-red-500/25';
  return 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25';
}

function dotTone(tone: 'emerald' | 'amber' | 'red' | 'secondary'): string {
  if (tone === 'emerald') return 'bg-emerald-400';
  if (tone === 'amber') return 'bg-amber-400';
  if (tone === 'red') return 'bg-red-400';
  return 'bg-secondary-400';
}

/**
 * Source-aware runtime path panel. Keeps Cloud Edge connectivity (Supabase Edge
 * Function checks) strictly separate from Local Runtime connectivity (HAL
 * runtime bridge heartbeats), and shows the deterministic effective path.
 */
export default function EffectiveRuntimePanel() {
  const health = useRuntimeHealth();
  const catalogue = useOllamaCatalogue();

  useEffect(() => {
    void refreshOllamaCatalogue();
  }, []);

  const catalogueFreshness = describeCatalogueFreshness(catalogue.comparison);

  const rows = useMemo(() => {
    return LOCAL_SYSTEMS.map((system) => {
      const sources = health.latestBySystem.get(system);
      const cloud = sources?.cloud_edge;
      const local = sources?.local_bridge;
      const path: EffectivePath = health.effectivePaths[system] ?? 'unknown';
      return { system, cloud, local, path };
    });
  }, [health.latestBySystem, health.effectivePaths]);

  const node = health.bridgeNode;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Source-Aware Runtime Path
          </h3>
          <p className="text-xs text-foreground-500 mt-0.5">
            Cloud Edge checks (Supabase Edge) are kept separate from the HAL local runtime bridge — a healthy local bridge never masks an unconfigured cloud edge.
          </p>
        </div>
        {node && (
          <span className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-label text-foreground-600 bg-background-50 border border-background-200/50 rounded-full px-2.5 py-0.5 whitespace-nowrap">
            <i className="ri-server-line w-3.5 h-3.5 flex items-center justify-center"></i>
            {node.node_key}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-2.5 whitespace-nowrap">System</th>
              <th className="px-4 py-2.5 whitespace-nowrap">Cloud Edge Connectivity</th>
              <th className="px-4 py-2.5 whitespace-nowrap">Local Runtime Connectivity</th>
              <th className="px-4 py-2.5 whitespace-nowrap">Effective Runtime Path</th>
              <th className="px-4 py-2.5 whitespace-nowrap">Catalogue</th>
              <th className="px-4 py-2.5 whitespace-nowrap">Last Checked</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const cloudMeta = row.cloud ? HEALTH_STATUS_META[row.cloud.currentStatus] : null;
              const localView = describeLocalRuntime(row.local);
              const pathMeta = EFFECTIVE_PATH_META[row.path];
              const lastChecked =
                row.path === 'local_bridge'
                  ? row.local?.lastCheckedAt ?? null
                  : row.cloud?.lastCheckedAt ?? row.local?.lastCheckedAt ?? null;
              return (
                <tr key={row.system} className="border-b border-background-200/40 last:border-0 hover:bg-background-50/60 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-foreground-100 whitespace-nowrap">
                    {SYSTEM_DISPLAY[row.system] ?? row.system}
                  </td>
                  <td className="px-4 py-3">
                    {cloudMeta ? (
                      <div className="flex items-center gap-2">
                        <StatusPill tone={cloudMeta.tone} label={cloudMeta.label} />
                        <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">
                          {formatTime(row.cloud?.lastCheckedAt ?? null)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] font-label text-foreground-600">Not Checked</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusPill tone={localView.tone} label={localView.label} pulse={row.local?.currentStatus === 'degraded'} />
                      <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">
                        {formatTime(row.local?.lastCheckedAt ?? null)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-label rounded-full px-2 py-0.5 border whitespace-nowrap ${pathPillTone(pathMeta.tone)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dotTone(pathMeta.tone)}`}></span>
                      {pathMeta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {row.system === 'ollama' ? (
                      <div className="flex items-center gap-2">
                        <StatusPill tone={catalogueFreshness.tone} label={catalogueFreshness.label} />
                        {catalogue.comparison && (
                          <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">
                            {catalogue.comparison.totalCatalogueModels} model(s)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] font-label text-foreground-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">{formatTime(lastChecked)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 border-t border-background-200/60 flex items-center gap-2">
        <i className="ri-information-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center shrink-0"></i>
        <p className="text-[11px] text-foreground-600 leading-relaxed">
          Cloud Edge health for n8n / Ollama reflects Supabase Edge Function configuration only — local services are reached exclusively through the outbound HAL runtime bridge. A stale heartbeat is shown as <strong className="text-foreground-300">Stale</strong>, never as healthy.
        </p>
      </div>
    </section>
  );
}