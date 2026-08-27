import { Link } from 'react-router-dom';
import type { ToolConnection } from '@/pages/ai-operations/types';
import { DEPENDENCY_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

const RELATIONSHIP_LABELS: Record<string, string> = {
  depends_on: 'Depends on',
  required_by: 'Required by',
};

export default function Dependencies({ connection }: { connection: ToolConnection }) {
  const { dependencies } = connection;

  if (dependencies.length === 0) {
    return (
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Dependencies</h3>
        <p className="text-sm text-foreground-500">No upstream or downstream dependencies recorded.</p>
      </section>
    );
  }

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Dependencies</h3>
      <div className="space-y-2">
        {dependencies.map((d) => {
          const status = DEPENDENCY_STATUS[d.status];
          return (
            <div key={`${d.name}-${d.relationship}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-[11px] font-label text-foreground-500 whitespace-nowrap">{RELATIONSHIP_LABELS[d.relationship]}</span>
                <span className="text-sm font-medium text-foreground-200">{d.name}</span>
                <span className="text-[11px] font-label text-foreground-600">{d.note}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusPill tone={status.tone} label={status.label} />
                {d.connectionId && (
                  <Link
                    to={`/ai-operations/tools/${d.connectionId}`}
                    className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 cursor-pointer whitespace-nowrap"
                  >
                    Open
                    <i className="ri-arrow-right-line text-sm w-4 h-4 flex items-center justify-center"></i>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}