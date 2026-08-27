import { Link } from 'react-router-dom';
import type { AiModel } from '@/pages/ai-operations/types';
import { AGENT_STATUS, AGENT_CATEGORY_LABELS, MODEL_ROLE_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import { getModelAssignments } from '@/pages/ai-operations/models/selectors';

export default function AgentAssignments({ model }: { model: AiModel }) {
  const assignments = getModelAssignments(model);

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Agent Assignments</h3>
        <span className="text-[11px] font-label text-foreground-600">{assignments.length} agents</span>
      </div>

      {assignments.length === 0 ? (
        <p className="px-4 py-6 text-sm text-foreground-500">No agents currently assigned to this model.</p>
      ) : (
        <div className="divide-y divide-background-200/40 max-h-96 overflow-y-auto">
          {assignments.map((a) => {
            const status = AGENT_STATUS[a.status];
            return (
              <div key={a.agentId} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-background-200/30 transition-colors duration-150">
                <div className="min-w-0">
                  <Link to={`/ai-operations/agents/${a.agentId}`} className="text-sm font-medium text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer">
                    {a.agentName}
                  </Link>
                  <p className="text-[10px] font-label text-foreground-600 mt-0.5">
                    {a.site} · {AGENT_CATEGORY_LABELS[a.category as keyof typeof AGENT_CATEGORY_LABELS]}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center text-[10px] font-label px-2 py-0.5 rounded-full bg-background-50 border border-background-200/60 text-foreground-300 whitespace-nowrap">
                    {MODEL_ROLE_LABELS[a.role]}
                  </span>
                  <StatusPill tone={status.tone} label={status.label} />
                  <Link
                    to={`/ai-operations/agents/${a.agentId}`}
                    className="inline-flex items-center gap-1 text-[11px] font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Open
                    <i className="ri-arrow-right-line w-3 h-3 flex items-center justify-center"></i>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}