import { Link } from 'react-router-dom';
import type { AgentModelConfiguration } from '@/pages/ai-operations/types';
import { resolveModelId } from '@/pages/ai-operations/models/modelRefs';

export default function ModelConfiguration({ model }: { model: AgentModelConfiguration }) {
  const primaryModelId = resolveModelId(model.primaryModel);
  const fallbackModelId = resolveModelId(model.fallbackModel);

  const rows = [
    { label: 'Primary provider', value: model.primaryProvider, modelId: null },
    { label: 'Primary model', value: model.primaryModel, modelId: primaryModelId },
    { label: 'Fallback provider', value: model.fallbackProvider, modelId: null },
    { label: 'Fallback model', value: model.fallbackModel, modelId: fallbackModelId },
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
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-background-200/40 pb-2">
              <span className="text-xs font-label text-foreground-600 whitespace-nowrap">{r.label}</span>
              <span className="text-sm text-foreground-200 text-right flex items-center gap-2">
                {r.value}
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
          ))}
        </div>
        <p className="text-[11px] font-label text-foreground-600 mt-4">
          Safe metadata only — no API keys, tokens or endpoint credentials are stored or displayed.
        </p>
      </div>
    </section>
  );
}