import { useEffect } from 'react';
import type { LocalModelMeta } from '@/pages/ai-operations/types';
import {
  useOllamaCatalogue,
  refreshOllamaCatalogue,
} from '@/pages/ai-operations/models/ollamaCatalogueStore';
import {
  cataloguePresenceForModel,
  CATALOGUE_MATCH_META,
  describeCatalogueFreshness,
} from '@/lib/ai-operations/runtimeOllama';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function LocalModel({ meta }: { meta: LocalModelMeta }) {
  const catalogue = useOllamaCatalogue();

  useEffect(() => {
    void refreshOllamaCatalogue();
  }, []);

  const presence = cataloguePresenceForModel(catalogue.comparison, meta.modelName);
  const presenceMeta = presence ? CATALOGUE_MATCH_META[presence] : null;
  const freshness = describeCatalogueFreshness(catalogue.comparison);

  const rows = [
    { label: 'Host reference', value: meta.hostRef },
    { label: 'Runtime', value: meta.runtime },
    { label: 'Model name', value: meta.modelName },
    { label: 'Capacity', value: meta.capacity },
    { label: 'Queue', value: meta.queue },
    { label: 'Estimated memory', value: meta.estimatedMemory },
    { label: 'Availability', value: meta.availability },
  ];

  return (
    <section className="bg-background-100 border border-accent-500/20 rounded-lg p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <i className="ri-server-line text-accent-400 w-4 h-4 flex items-center justify-center"></i>
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Local Model Preparation</h3>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-label px-2 py-0.5 rounded-full border ${meta.loaded ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-secondary-500/10 text-secondary-300 border-secondary-500/25'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${meta.loaded ? 'bg-emerald-400' : 'bg-secondary-400'}`}></span>
          {meta.loaded ? 'Loaded' : 'Not loaded'}
        </span>
      </div>

      {/* Catalogue presence (relayed via HAL bridge — no direct Ollama contact) */}
      <div className="mt-4 bg-background-50 border border-background-200/40 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Catalogue Presence</span>
          {presenceMeta ? (
            <StatusPill tone={presenceMeta.tone} label={presenceMeta.label} />
          ) : (
            <span className="text-[11px] font-label text-foreground-600">Not in relayed catalogue</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Last Catalogue Verification</span>
          <StatusPill tone={freshness.tone} label={freshness.label} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Inference</span>
          <span className="text-[11px] font-label font-semibold text-foreground-300 whitespace-nowrap">Disabled / Not Tested</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-background-200/40 pb-2 sm:flex-col sm:items-start sm:border-0 sm:pb-0 sm:bg-background-50 sm:border sm:border-background-200/40 sm:rounded-lg sm:p-3">
            <span className="text-xs font-label text-foreground-600 whitespace-nowrap">{r.label}</span>
            <span className="text-sm text-foreground-200 text-right sm:text-left sm:mt-1">{r.value}</span>
          </div>
        ))}
      </div>

      <p className="text-[11px] font-label text-foreground-600 mt-3">
        Catalogue presence is relayed from the HAL runtime bridge (source local_bridge) — the browser never contacts Ollama and inference remains disabled.
      </p>
    </section>
  );
}