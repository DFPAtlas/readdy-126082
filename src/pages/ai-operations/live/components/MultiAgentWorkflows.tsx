import { Link } from 'react-router-dom';
import { getMultiAgentWorkflows } from '@/pages/ai-operations/live/selectors';
import { ACTIVITY_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function MultiAgentWorkflows() {
  const workflows = getMultiAgentWorkflows();

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Multi-Agent Workflows</h3>
      </div>

      <div className="divide-y divide-background-200/40">
        {workflows.map((wf) => {
          const status = ACTIVITY_STATUS[wf.status];
          return (
            <div key={wf.id} className="px-4 py-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground-200">{wf.title}</p>
                  <p className="text-[11px] font-label text-foreground-600 mt-0.5">{wf.site} · {wf.id}</p>
                </div>
                <StatusPill tone={status.tone} label={status.label} pulse={wf.status === 'running'} />
              </div>

              <div className="space-y-0">
                {wf.chain.map((node, i) => {
                  const active = node.status === 'running';
                  const done = node.status === 'success';
                  return (
                    <div key={`${node.agent}-${i}`}>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center self-stretch">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                              active
                                ? 'bg-accent-500/20 border-accent-500/40'
                                : done
                                  ? 'bg-emerald-500/15 border-emerald-500/30'
                                  : 'bg-background-200/40 border-background-300/40'
                            }`}
                          >
                            <i
                              className={`${
                                active
                                  ? 'ri-loader-4-line text-accent-400 animate-spin'
                                  : done
                                    ? 'ri-check-line text-emerald-400'
                                    : 'ri-more-line text-foreground-600'
                              } text-sm w-4 h-4 flex items-center justify-center`}
                            ></i>
                          </span>
                          {i < wf.chain.length - 1 && <span className="w-px flex-1 min-h-4 bg-background-300/40 my-0.5"></span>}
                        </div>
                        <div className={`flex-1 min-w-0 py-1.5 ${active ? 'bg-accent-500/5 rounded-md px-2 -mx-2' : ''}`}>
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm whitespace-nowrap ${active ? 'text-foreground-50 font-medium' : 'text-foreground-300'}`}>{node.agent}</p>
                            <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">{node.duration}</span>
                          </div>
                          <p className="text-[11px] text-foreground-500 mt-0.5 line-clamp-1">{node.outcome}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3">
                <Link
                  to={`/ai-operations/runs/${wf.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                >
                  Open Run
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}