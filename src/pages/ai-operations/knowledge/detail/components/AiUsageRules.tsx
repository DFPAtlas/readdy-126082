import type { KnowledgeSource } from '@/pages/ai-operations/types';

export default function AiUsageRules({ source }: { source: KnowledgeSource }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">AI Usage Rules</h3>
      <ul className="mt-3 space-y-2">
        {source.aiUsageRules.map((rule) => (
          <li key={rule} className="flex items-start gap-2 text-sm text-foreground-300">
            <i className="ri-checkbox-circle-line text-accent-400 text-sm w-4 h-4 flex items-center justify-center mt-0.5 shrink-0"></i>
            {rule}
          </li>
        ))}
      </ul>
      {!source.aiUsageAllowed && (
        <div className="mt-3 bg-amber-500/10 border border-amber-500/25 rounded-md p-3">
          <p className="text-[11px] font-label text-amber-300">AI usage is not currently allowed for this source.</p>
        </div>
      )}
    </section>
  );
}