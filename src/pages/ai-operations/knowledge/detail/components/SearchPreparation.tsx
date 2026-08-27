import type { KnowledgeSource } from '@/pages/ai-operations/types';

function Chip({ label, icon }: { label: string; icon: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-label px-2.5 py-1 rounded-full bg-background-50 border border-background-200/60 text-foreground-300">
      <i className={`${icon} text-xs w-3.5 h-3.5 flex items-center justify-center text-accent-400`}></i>
      {label}
    </span>
  );
}

export default function SearchPreparation({ source }: { source: KnowledgeSource }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Search Preparation</h3>
      <p className="text-[11px] font-label text-foreground-600 mt-1">
        Metadata prepared for future AI retrieval/search. No vector search is built yet.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Keywords</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {source.keywords.length ? source.keywords.map((k) => <Chip key={k} label={k} icon="ri-key-2-line" />) : <span className="text-xs text-foreground-600">—</span>}
          </div>
        </div>
        <div>
          <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Tags</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {source.tags.length ? source.tags.map((t) => <Chip key={t} label={t} icon="ri-price-tag-3-line" />) : <span className="text-xs text-foreground-600">—</span>}
          </div>
        </div>
        <div>
          <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Topics</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {source.topics.length ? source.topics.map((t) => <Chip key={t} label={t} icon="ri-folder-3-line" />) : <span className="text-xs text-foreground-600">—</span>}
          </div>
        </div>
      </div>
    </section>
  );
}