import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useRuntimeHealth } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { useOllamaCatalogue, refreshOllamaCatalogue } from '@/pages/ai-operations/models/ollamaCatalogueStore';
import { HEALTH_STATUS_META } from '@/lib/ai-operations/runtimeHealth';
import { computeAvailability } from '@/lib/ai-operations/runtimeMonitoring';
import { resolveEffectiveHealth } from '@/lib/ai-operations/runtimeHealthSource';
import { describeCatalogueFreshness } from '@/lib/ai-operations/runtimeOllama';
import type { AiProvider } from '@/pages/ai-operations/types';
import { MODEL_STATUS, PROVIDER_TYPE_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

function providerSystemSlug(p: AiProvider): string | null {
  if (p.type === 'local') return 'ollama';
  const name = p.name.toLowerCase();
  if (name.includes('openai')) return 'openai';
  if (name.includes('anthropic') || name.includes('claude')) return 'anthropic';
  return null;
}

/** Distinct Ollama provider states — never collapsed into one ambiguous status. */
function OllamaStateRow({ label, tone, value }: { label: string; tone: 'emerald' | 'amber' | 'red' | 'accent' | 'secondary'; value: string }) {
  const color =
    tone === 'emerald' ? 'text-emerald-400'
      : tone === 'amber' ? 'text-amber-400'
        : tone === 'red' ? 'text-red-400'
          : tone === 'accent' ? 'text-accent-400'
            : 'text-foreground-300';
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</span>
      <span className={`text-[11px] font-label font-semibold ${color} whitespace-nowrap`}>{value}</span>
    </div>
  );
}

export default function ProviderStatus({ providers }: { providers: AiProvider[] }) {
  const health = useRuntimeHealth();
  const catalogue = useOllamaCatalogue();

  useEffect(() => {
    void refreshOllamaCatalogue();
  }, []);

  const ollamaLocal = useMemo(() => {
    const local = health.latestBySystem.get('ollama')?.local_bridge;
    return resolveEffectiveHealth(health.latestBySystem, 'ollama', health.effectivePaths) && local
      ? local
      : undefined;
  }, [health.latestBySystem, health.effectivePaths]);

  const catalogueFreshness = describeCatalogueFreshness(catalogue.comparison);

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Provider Status</h3>
        <span className="text-[10px] font-label text-foreground-600">Registry metadata · API connectivity when monitored</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-background-200/40">
        {providers.map((p) => {
          const status = MODEL_STATUS[p.status];
          const system = providerSystemSlug(p);
          const isLocalOllama = p.type === 'local';
          const derived = system ? resolveEffectiveHealth(health.latestBySystem, system, health.effectivePaths) : undefined;
          const availability = system
            ? computeAvailability(health.checks.filter((c) => c.system_slug === system))
            : null;
          const runtimeMeta = derived ? HEALTH_STATUS_META[derived.currentStatus] : null;

          return (
            <div key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground-100">{p.name}</p>
                  <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide mt-0.5">{PROVIDER_TYPE_LABELS[p.type]}</p>
                </div>
                <StatusPill tone={status.tone} label={status.label} pulse={p.status === 'degraded'} />
              </div>

              {/* Local Ollama — distinct, non-collapsed states */}
              {isLocalOllama ? (
                <div className="mt-3 space-y-1.5 border-t border-background-200/40 pt-3">
                  <OllamaStateRow label="Registry" tone="emerald" value="Configured" />
                  <OllamaStateRow label="Cloud Edge" tone="secondary" value="Unavailable / N/A" />
                  <OllamaStateRow
                    label="Local Runtime Bridge"
                    tone={runtimeMeta?.currentStatus === 'healthy' ? 'emerald' : runtimeMeta?.currentStatus === 'degraded' ? 'amber' : 'secondary'}
                    value={runtimeMeta ? runtimeMeta.label : 'Not Reported'}
                  />
                  <OllamaStateRow label="Catalogue" tone={catalogueFreshness.tone} value={catalogueFreshness.label} />
                  <OllamaStateRow label="Inference" tone="secondary" value="Not Started" />
                </div>
              ) : (
                <>
                  {/* Provider API connectivity (persisted monitoring state) */}
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <span className="text-[9px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">API Connectivity</span>
                    {runtimeMeta ? (
                      <StatusPill tone={runtimeMeta.tone} label={runtimeMeta.label} pulse={derived?.currentStatus === 'degraded'} />
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-label text-foreground-600 whitespace-nowrap">
                        <i className="ri-time-line w-3 h-3 flex items-center justify-center"></i>
                        Not Checked
                      </span>
                    )}
                  </div>

                  {derived && (
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] font-label text-foreground-600">
                      <span>last {derived.lastCheckedAt ? new Date(derived.lastCheckedAt).toLocaleTimeString('en-US', { hour12: false }) : '—'}</span>
                      <span>{availability != null ? `${availability}% avail` : 'no history'}</span>
                    </div>
                  )}
                </>
              )}

              <p className="text-xs text-foreground-500 mt-3 line-clamp-2 leading-relaxed">{p.description}</p>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-sm font-heading font-bold text-foreground-100">{p.availableModels}</p>
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Models</p>
                </div>
                <div>
                  <p className={`text-sm font-heading font-bold ${p.failures > 0 ? 'text-red-400' : 'text-foreground-100'}`}>{p.failures}</p>
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Failures</p>
                </div>
                <div>
                  <p className="text-sm font-heading font-bold text-foreground-100">{p.estimatedCostToday}</p>
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Cost</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[10px] font-label text-foreground-600">Active {p.activeRequests} · Resp {p.avgResponseTime}</p>
                {p.connectionId ? (
                  <Link
                    to={`/ai-operations/tools/${p.connectionId}`}
                    className="inline-flex items-center gap-1 text-[11px] font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Connection
                    <i className="ri-arrow-right-line w-3 h-3 flex items-center justify-center"></i>
                  </Link>
                ) : (
                  <span className="text-[10px] font-label text-foreground-600">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}