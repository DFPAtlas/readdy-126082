import { Link } from 'react-router-dom';
import type { AiSecurityPolicy } from '@/pages/ai-operations/types';
import {
  POLICY_STATUS,
  POLICY_EFFECT,
  POLICY_CATEGORY_LABELS,
  RISK_LEVEL,
} from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function PolicyHeader({ policy, onEdit }: { policy: AiSecurityPolicy; onEdit: () => void }) {
  const status = POLICY_STATUS[policy.status];
  const effect = POLICY_EFFECT[policy.effect];
  const priority = RISK_LEVEL[policy.priority];

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-2 text-xs font-label text-foreground-500 flex-wrap">
        <Link to="/ai-operations" className="hover:text-foreground-200 transition-colors cursor-pointer">AI Operations</Link>
        <span className="text-foreground-600">→</span>
        <Link to="/ai-operations/security" className="hover:text-foreground-200 transition-colors cursor-pointer">Security</Link>
        <span className="text-foreground-600">→</span>
        <span className="text-foreground-300 font-mono">{policy.name}</span>
      </nav>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">{policy.name}</h1>
            <StatusPill tone={status.tone} label={status.label} />
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <StatusPill tone={effect.tone} label={effect.label} />
            <StatusPill tone={priority.tone} label={`${priority.label} priority`} />
          </div>
          <p className="text-xs font-label text-foreground-500 mt-2">
            {POLICY_CATEGORY_LABELS[policy.category]} · {policy.siteName} · v{policy.version} · <span className="font-mono">{policy.id}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:text-foreground-100 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-edit-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}