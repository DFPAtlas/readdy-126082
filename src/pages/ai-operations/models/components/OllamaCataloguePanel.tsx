import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  useOllamaCatalogue,
  refreshOllamaCatalogue,
} from '@/pages/ai-operations/models/ollamaCatalogueStore';
import {
  CATALOGUE_MATCH_META,
  describeCatalogueFreshness,
  type CatalogueMatchState,
} from '@/lib/ai-operations/runtimeOllama';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

const STATE_TONE: Record<CatalogueMatchState, string> = {
  registered_present: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  registered_missing: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  present_not_registered: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  remote_cloud: 'text-accent-400 bg-accent-500/10 border-accent-500/25',
  registry_disabled: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
  needs_review: 'text-red-400 bg-red-500/10 border-red-500/25',
};

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
 * Local Ollama catalogue panel — relayed (sanitised) model list compared
 * deterministically against the live model registry. Observation only: no
 * inference, no pull/delete, no registry mutation.
 */
export default function OllamaCataloguePanel() {
  const { catalogue, comparison, loading } = useOllamaCatalogue();

  useEffect(() => {
    void refreshOllamaCatalogue();
  }, []);

  const freshness = describeCatalogueFreshness(comparison);

  if (loading && !comparison) {
    return (
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-foreground-500">Loading local Ollama catalogue…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Local Ollama Catalogue</h3>
            <StatusPill tone={freshness.tone} label={freshness.label} />
          </div>
          <p className="text-xs text-foreground-500 mt-0.5 max-w-3xl">
            Relayed from the HAL runtime bridge (source <span className="text-foreground-300">local_bridge</span>) — the cloud never reaches Ollama directly. Compared deterministically against the registry; nothing is auto-registered or pulled.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-foreground-600 bg-background-50 border border-background-200/50 rounded-full px-2.5 py-0.5 whitespace-nowrap">
          <i className="ri-server-line w-3.5 h-3.5 flex items-center justify-center"></i>
          {comparison ? `${comparison.totalCatalogueModels} model(s)` : 'No catalogue relayed yet'}
        </span>
      </div>

      {!comparison && (
        <div className="px-4 py-8 text-center">
          <i className="ri-database-2-line text-3xl text-foreground-600 w-8 h-8 flex items-center justify-center mx-auto"></i>
          <p className="text-sm text-foreground-500 mt-3">No relayed Ollama catalogue available yet.</p>
          <p className="text-xs text-foreground-600 mt-1">
            The HAL bridge relays the sanitised <code className="text-foreground-300">/api/tags</code> catalogue on its heartbeat/catalogue interval.
          </p>
        </div>
      )}

      {comparison && (
        <>
          {/* Summary counts */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-background-200/40 border-b border-background-200/60">
            <CountCell label="Registered + Present" value={comparison.registeredPresent} tone="emerald" />
            <CountCell label="Registered + Missing" value={comparison.registeredMissing} tone="amber" />
            <CountCell label="Not Registered" value={comparison.presentNotRegistered} tone="amber" />
            <CountCell label="Remote/Cloud" value={comparison.remoteCloud} tone="accent" />
            <CountCell label="Needs Review" value={comparison.needsReview} tone="red" />
            <CountCell label="Registry Disabled" value={comparison.registryDisabled} tone="secondary" />
          </div>

          {/* Comparison rows */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
                  <th className="px-4 py-2.5 whitespace-nowrap">Model</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">Registry State</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">Classification</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">Family</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">Parameters</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">Quantisation</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">Detail</th>
                </tr>
              </thead>
              <tbody>
                {comparison.entries.map((e) => {
                  const meta = CATALOGUE_MATCH_META[e.state];
                  return (
                    <tr key={`${e.key}-${e.state}`} className="border-b border-background-200/40 last:border-0 hover:bg-background-50/60 transition-colors">
                      <td className="px-4 py-2.5">
                        {e.modelKey ? (
                          <Link
                            to={`/ai-operations/models/${e.modelKey}`}
                            className="text-sm font-medium text-foreground-100 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            {e.name}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium text-foreground-100 whitespace-nowrap">{e.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-label rounded-full px-2 py-0.5 border whitespace-nowrap ${STATE_TONE[e.state]}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-foreground-500 whitespace-nowrap">
                        {e.classification === 'remote' ? 'Remote/Cloud' : 'Local'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-foreground-500 whitespace-nowrap">{e.family ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-foreground-500 whitespace-nowrap">{e.parameterSize ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-foreground-500 whitespace-nowrap">{e.quantization ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-foreground-500">{e.detail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2.5 border-t border-background-200/60 flex items-center gap-2 flex-wrap">
            <i className="ri-information-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center shrink-0"></i>
            <p className="text-[11px] text-foreground-600 leading-relaxed">
              Last catalogue verification {formatTime(comparison.catalogueAt)}. Inference is <strong className="text-foreground-300">Disabled / Not Tested</strong> — no prompt, embedding, pull or delete is ever issued.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

function CountCell({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'amber' | 'red' | 'accent' | 'secondary' }) {
  const color =
    tone === 'emerald' ? 'text-emerald-400'
      : tone === 'amber' ? 'text-amber-400'
        : tone === 'red' ? 'text-red-400'
          : tone === 'accent' ? 'text-accent-400'
            : 'text-foreground-300';
  return (
    <div className="bg-background-100 px-4 py-3">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-lg font-heading font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}