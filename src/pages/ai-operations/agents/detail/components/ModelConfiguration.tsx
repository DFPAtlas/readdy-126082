import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { AgentModelConfiguration } from '@/pages/ai-operations/types';
import { resolveModelId } from '@/pages/ai-operations/models/modelRefs';
import {
  useOllamaCatalogue,
  refreshOllamaCatalogue,
} from '@/pages/ai-operations/models/ollamaCatalogueStore';
import {
  cataloguePresenceForModel,
  CATALOGUE_MATCH_META,
} from '@/lib/ai-operations/runtimeOllama';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

const OLLAMA_HINTS = ['llama', 'mistral', 'codestral', 'qwen', 'nemotron', 'ollama'];

function looksOllama(name: string): boolean {
  const n = name.toLowerCase();
  return OLLAMA_HINTS.some((h) => n.includes(h));
}

export default function ModelConfiguration({ model }: { model: AgentModelConfiguration }) {
  const catalogue = useOllamaCatalogue();

  useEffect(() => {
    void refreshOllamaCatalogue();
  }, []);

  const primaryModelId = resolveModelId(model.primaryModel);
  const fallbackModelId = resolveModelId(model.fallbackModel);

  const primaryIsOllama = looksOllama(model.primaryModel);
  const fallbackIsOllama = looksOllama(model.fallbackModel);

  const primaryPresence = primaryIsOllama
    ? cataloguePresenceForModel(catalogue.comparison, model.primaryModel)
    : null;
  const fallbackPresence = fallbackIsOllama
    ? cataloguePresenceForModel(catalogue.comparison, model.fallbackModel)
    : null;

  const rows = [
    { label: 'Primary provider', value: model.primaryProvider, modelId: null },
    { label: 'Primary model', value: model.primaryModel, modelId: primaryModelId, ollama: primaryIsOllama, presence: primaryPresence },
    { label: 'Fallback provider', value: model.fallbackProvider, modelId: null },
    { label: 'Fallback model', value: model.fallbackModel, modelId: fallbackModelId, ollama: fallbackIsOllama, presence: fallbackPresence },
    { label: 'Model purpose', value: model.purpose, modelId: null },
    { label: 'Configuration status', value: model.configStatus, modelId: null },
    { label: 'Prompt / version reference', value: model.promptRef, modelId: null },
    { label: 'Last configuration update', value: model.lastConfigUpdate, modelId: null },
  ];

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Model Configuration</h3>
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {rows.map((r) => {
            const presenceMeta = r.presence ? CATALOGUE_MATCH_META[r.presence] : null;
            return (
              <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-background-200/40 pb-2">
                <span className="text-xs font-label text-foreground-600 whitespace-nowrap">{r.label}</span>
                <span className="text-sm text-foreground-200 text-right flex items-center gap-2 flex-wrap justify-end">
                  {r.value}
                  {r.ollama && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-full px-2 py-0.5 whitespace-nowrap">
                      <i className="ri-server-line w-3 h-3 flex items-center justify-center"></i>
                      Local Bridge
                    </span>
                  )}
                  {r.presence && presenceMeta && (
                    <StatusPill tone={presenceMeta.tone} label={presenceMeta.label} />
                  )}
                  {r.modelId && (
                    <Link
                      to={`/ai-operations/models/${r.modelId}`}
                      className="inline-flex items-center gap-1 text-[11px] font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                      title="Open Model"
                    >
                      Open Model
                      <i className="ri-arrow-right-line w-3 h-3 flex items-center justify-center"></i>
                    </Link>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {(primaryIsOllama || fallbackIsOllama) && (
          <div className="mt-4 bg-background-50 border border-background-200/40 rounded-lg px-3 py-2.5 flex items-center gap-2">
            <i className="ri-information-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center shrink-0"></i>
            <p className="text-[11px] text-foreground-600">
              This agent has an Ollama model assignment via the Local Bridge. Runtime inference is{' '}
              <strong className="text-foreground-300">disabled</strong> — catalogue presence is observation only; the agent cannot execute.
            </p>
          </div>
        )}

        <p className="text-[11px] font-label text-foreground-600 mt-4">
          Safe metadata only — no API keys, tokens or endpoint credentials are stored or displayed.
        </p>
      </div>
    </section>
  );
}