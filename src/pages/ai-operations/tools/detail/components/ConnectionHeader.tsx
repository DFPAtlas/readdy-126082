import { Link } from 'react-router-dom';
import type { ToolConnection } from '@/pages/ai-operations/types';
import { TOOL_CONNECTION_STATUS, CONNECTION_HEALTH, TOOL_CATEGORY_LABELS, ENVIRONMENT_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

const CRITICALITY_LABELS: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

export default function ConnectionHeader({ connection, onEdit }: { connection: ToolConnection; onEdit: () => void }) {
  const status = TOOL_CONNECTION_STATUS[connection.status];
  const health = CONNECTION_HEALTH[connection.health.state];

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-2 text-xs font-label text-foreground-500 flex-wrap">
        <Link to="/ai-operations" className="hover:text-foreground-200 transition-colors cursor-pointer">AI Operations</Link>
        <span className="text-foreground-600">→</span>
        <Link to="/ai-operations/tools" className="hover:text-foreground-200 transition-colors cursor-pointer">Tools &amp; Connections</Link>
        <span className="text-foreground-600">→</span>
        <span className="text-foreground-300 font-mono">{connection.id}</span>
      </nav>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">{connection.name}</h1>
            <StatusPill tone={status.tone} label={status.label} />
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <StatusPill tone={health.tone} label={`${health.label} health`} />
            <span className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5">
              <i className="ri-shield-line text-sm w-4 h-4 flex items-center justify-center"></i>
              {CRITICALITY_LABELS[connection.criticality]} criticality
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5">
              <i className="ri-global-line text-sm w-4 h-4 flex items-center justify-center"></i>
              {ENVIRONMENT_LABELS[connection.environment]}
            </span>
          </div>
          <p className="text-xs font-label text-foreground-500 mt-2">
            {connection.provider} · {TOOL_CATEGORY_LABELS[connection.category]} · {connection.scope} · <span className="font-mono">{connection.id}</span>
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