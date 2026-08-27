import { Link } from 'react-router-dom';
import type { KnowledgeSource } from '@/pages/ai-operations/types';

export default function EmbeddingPreparation({ source }: { source: KnowledgeSource }) {
  const idx = source.index;

  const rows = [
    { label: 'Vector ready', value: idx.vectorReady ? 'Yes' : 'No' },
    { label: 'Indexed', value: idx.indexed ? 'Yes' : 'No' },
    { label: 'Index provider', value: idx.indexProvider },
    { label: 'Embedding model', value: idx.embeddingModel },
    { label: 'Last indexed', value: idx.lastIndexed },
    { label: 'Chunk count', value: idx.chunkCount },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Embedding Preparation</h3>
      <p className="text-[11px] font-label text-foreground-600 mt-1">Demo index metadata only — no embeddings are generated.</p>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-background-200/40 pb-2">
            <span className="text-xs font-label text-foreground-600 whitespace-nowrap">{r.label}</span>
            <span className="text-sm text-foreground-200 text-right">{r.value}</span>
          </div>
        ))}
      </div>

      {idx.embeddingModelId && (
        <div className="mt-4 flex items-center gap-2">
          <Link
            to={`/ai-operations/models/${idx.embeddingModelId}`}
            className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            Open Model
            <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
          </Link>
        </div>
      )}
    </section>
  );
}