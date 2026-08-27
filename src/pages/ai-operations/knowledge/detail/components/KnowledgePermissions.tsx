import type { KnowledgeSource } from '@/pages/ai-operations/types';
import { PERMISSION_STATE } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function KnowledgePermissions({ source }: { source: KnowledgeSource }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Knowledge Permissions</h3>
      </div>
      <div className="divide-y divide-background-200/40">
        {source.permissions.map((p) => {
          const state = PERMISSION_STATE[p.state];
          return (
            <div key={p.permission} className="px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground-200">{p.permission}</p>
                <p className="text-[11px] font-label text-foreground-600 mt-0.5">{p.note}</p>
              </div>
              <StatusPill tone={state.tone} label={state.label} />
            </div>
          );
        })}
      </div>
    </section>
  );
}