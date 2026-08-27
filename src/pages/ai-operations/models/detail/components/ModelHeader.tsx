import { Link } from 'react-router-dom';
import type { AiModel } from '@/pages/ai-operations/types';
import {
  MODEL_STATUS,
  CONNECTION_HEALTH,
  MODEL_PURPOSE_LABELS,
  ENVIRONMENT_LABELS,
  HOSTING_TYPE_LABELS,
  PROVIDER_TYPE_LABELS,
} from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function ModelHeader({ model, onEdit }: { model: AiModel; onEdit: () => void }) {
  const status = MODEL_STATUS[model.status];
  const health = CONNECTION_HEALTH[model.health];

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-2 text-xs font-label text-foreground-500 flex-wrap">
        <Link to="/ai-operations" className="hover:text-foreground-200 transition-colors cursor-pointer">AI Operations</Link>
        <span className="text-foreground-600">→</span>
        <Link to="/ai-operations/models" className="hover:text-foreground-200 transition-colors cursor-pointer">Models</Link>
        <span className="text-foreground-600">→</span>
        <span className="text-foreground-300 font-mono">{model.name}</span>
      </nav>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">{model.name}</h1>
            <StatusPill tone={status.tone} label={status.label} />
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <StatusPill tone={health.tone} label={`${health.label} health`} />
            <span className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5">
              <i className={`${model.hostingType === 'local' ? 'ri-server-line' : 'ri-cloud-line'} text-sm w-4 h-4 flex items-center justify-center`}></i>
              {HOSTING_TYPE_LABELS[model.hostingType]}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5">
              <i className="ri-global-line text-sm w-4 h-4 flex items-center justify-center"></i>
              {ENVIRONMENT_LABELS[model.environment]}
            </span>
          </div>
          <p className="text-xs font-label text-foreground-500 mt-2">
            {model.providerName} · {PROVIDER_TYPE_LABELS[model.providerType]} · {MODEL_PURPOSE_LABELS[model.purpose]} · <span className="font-mono">{model.id}</span>
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