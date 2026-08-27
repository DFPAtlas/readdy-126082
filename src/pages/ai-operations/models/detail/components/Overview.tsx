import { Link } from 'react-router-dom';
import type { AiModel } from '@/pages/ai-operations/types';
import { MODEL_PURPOSE_LABELS, PROVIDER_TYPE_LABELS, HOSTING_TYPE_LABELS, CONFIGURATION_STATE } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function Overview({ model }: { model: AiModel }) {
  const config = CONFIGURATION_STATE[model.configurationState];

  const rows = [
    { label: 'Model family', value: model.family },
    { label: 'Provider', value: model.providerName },
    { label: 'Provider type', value: PROVIDER_TYPE_LABELS[model.providerType] },
    { label: 'Hosting type', value: HOSTING_TYPE_LABELS[model.hostingType] },
    { label: 'Hosting location', value: model.hostingLocation },
    { label: 'Primary purpose', value: MODEL_PURPOSE_LABELS[model.purpose] },
    { label: 'Last checked', value: model.lastChecked },
    { label: 'Jobs today', value: model.jobsToday },
    { label: 'Failures today', value: model.failuresToday },
    { label: 'Average response time', value: model.avgResponseTime },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Overview</h3>
        <StatusPill tone={config.tone} label={`Config: ${config.label}`} />
      </div>

      <p className="text-sm text-foreground-300 mt-3 leading-relaxed">{model.description}</p>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-background-200/40 pb-2">
            <span className="text-xs font-label text-foreground-600 whitespace-nowrap">{r.label}</span>
            <span className="text-sm text-foreground-200 text-right">{r.value}</span>
          </div>
        ))}
      </div>

      {model.providerType === 'cloud' && (
        <div className="mt-4 flex items-center gap-2">
          <Link
            to="/ai-operations/tools/CON-MODEL"
            className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            Open provider connection
            <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
          </Link>
        </div>
      )}

      {model.notes && <p className="text-xs text-foreground-500 mt-3 leading-relaxed">{model.notes}</p>}
    </section>
  );
}