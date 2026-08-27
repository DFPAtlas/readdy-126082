import type { AiModel } from '@/pages/ai-operations/types';
import { CAPABILITY_SUPPORT } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function Capabilities({ model }: { model: AiModel }) {
  const caps = [
    { label: 'Text', value: model.capabilities.text },
    { label: 'Reasoning', value: model.capabilities.reasoning },
    { label: 'Coding', value: model.capabilities.coding },
    { label: 'Vision', value: model.capabilities.vision },
    { label: 'Tools / functions', value: model.capabilities.tools },
    { label: 'Structured output', value: model.capabilities.structuredOutput },
    { label: 'Embeddings', value: model.capabilities.embeddings },
    { label: 'Long context', value: model.capabilities.longContext },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Capabilities</h3>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {caps.map((c) => {
          const display = CAPABILITY_SUPPORT[c.value];
          return (
            <div key={c.label} className="bg-background-50 border border-background-200/40 rounded-lg p-3 flex flex-col gap-1.5">
              <span className="text-xs font-label text-foreground-500">{c.label}</span>
              <StatusPill tone={display.tone} label={display.label} />
            </div>
          );
        })}
      </div>
    </section>
  );
}