import type { AiAuditEvent } from '@/pages/ai-operations/types';

export default function BeforeAfter({ event }: { event: AiAuditEvent }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Before / After</h4>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
        <div className="bg-background-50 border border-background-200/60 rounded-md p-4">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-2">
            <i className="ri-arrow-go-back-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Before
          </span>
          <p className="text-sm text-foreground-200">{event.beforeState}</p>
        </div>
        <div className="bg-background-50 border border-background-200/60 rounded-md p-4">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-2">
            <i className="ri-arrow-go-forward-line text-sm w-4 h-4 flex items-center justify-center"></i>
            After
          </span>
          <p className="text-sm text-foreground-200">{event.afterState}</p>
        </div>
      </div>
      <p className="px-4 pb-3 text-[11px] font-label text-foreground-600">Structured state summaries — no raw database records exposed.</p>
    </section>
  );
}