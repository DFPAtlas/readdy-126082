import { Link } from 'react-router-dom';
import type { AiSecurityPolicy } from '@/pages/ai-operations/types';
import { POLICY_EFFECT, POLICY_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function PolicyLinkList({ policies, emptyMessage }: { policies: AiSecurityPolicy[]; emptyMessage: string }) {
  if (policies.length === 0) {
    return <p className="text-sm text-foreground-500">{emptyMessage}</p>;
  }

  return (
    <div className="divide-y divide-background-200/40">
      {policies.map((p) => {
        const effect = POLICY_EFFECT[p.effect];
        const status = POLICY_STATUS[p.status];
        return (
          <div key={p.id} className="py-2.5 flex items-center justify-between gap-3 hover:bg-background-200/30 rounded-md px-2 -mx-2 transition-colors duration-150">
            <div className="min-w-0">
              <Link to={`/ai-operations/security/policies/${p.id}`} className="text-sm font-medium text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer">
                {p.name}
              </Link>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatusPill tone={effect.tone} label={effect.label} />
                <StatusPill tone={status.tone} label={status.label} />
              </div>
            </div>
            <Link
              to={`/ai-operations/security/policies/${p.id}`}
              className="inline-flex items-center gap-1 text-[11px] font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Open
              <i className="ri-arrow-right-line w-3 h-3 flex items-center justify-center"></i>
            </Link>
          </div>
        );
      })}
    </div>
  );
}