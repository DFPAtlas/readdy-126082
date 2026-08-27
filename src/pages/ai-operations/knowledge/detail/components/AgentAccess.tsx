import { Link } from 'react-router-dom';
import type { KnowledgeSource } from '@/pages/ai-operations/types';
import { PERMISSION_STATE } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function AgentAccess({ source }: { source: KnowledgeSource }) {
  const { agentAccess } = source;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Agent Access</h3>
        <span className="text-[11px] font-label text-foreground-600">{agentAccess.length} agents</span>
      </div>

      {agentAccess.length === 0 ? (
        <p className="px-4 py-6 text-sm text-foreground-500">No agents are currently permitted to use this source.</p>
      ) : (
        <div className="divide-y divide-background-200/40 max-h-96 overflow-y-auto">
          {agentAccess.map((a) => {
            const access = PERMISSION_STATE[a.accessState];
            return (
              <div key={a.agentId} className="px-4 py-3 hover:bg-background-200/30 transition-colors duration-150">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/ai-operations/agents/${a.agentId}`} className="text-sm font-medium text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer">
                      {a.agentName}
                    </Link>
                    <p className="text-[10px] font-label text-foreground-600 mt-0.5">{a.site} · {a.purpose}</p>
                  </div>
                  <StatusPill tone={access.tone} label={access.label} />
                </div>
                <div className="mt-2 flex items-center gap-4 text-[11px] font-label text-foreground-500 flex-wrap">
                  <span className={a.retrievalAllowed ? 'text-foreground-300' : 'text-foreground-600 line-through'}>Retrieve</span>
                  <span className={a.summarisationAllowed ? 'text-foreground-300' : 'text-foreground-600 line-through'}>Summarise</span>
                  <span className={a.modificationAllowed ? 'text-foreground-300' : 'text-foreground-600 line-through'}>Modify</span>
                  {a.approvalRequired && <span className="text-amber-400">Approval required</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}