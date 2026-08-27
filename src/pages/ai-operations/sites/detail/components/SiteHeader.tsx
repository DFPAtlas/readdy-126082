import { Link } from 'react-router-dom';
import type { SiteRegistryRecord } from '@/pages/ai-operations/types';
import { SITE_STATUS, AI_STATUS, ENVIRONMENT_LABELS, BUSINESS_TYPE_LABELS, RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

interface SiteHeaderProps {
  site: SiteRegistryRecord;
  onEdit: () => void;
}

export default function SiteHeader({ site, onEdit }: SiteHeaderProps) {
  const op = SITE_STATUS[site.operationalStatus];
  const ai = AI_STATUS[site.aiStatus];
  const crit = RISK_LEVEL[site.criticality];

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs font-label text-foreground-500 flex-wrap">
        <Link to="/ai-operations" className="hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap">AI Operations</Link>
        <i className="ri-arrow-right-s-line w-4 h-4 flex items-center justify-center"></i>
        <Link to="/ai-operations/sites" className="hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap">Sites</Link>
        <i className="ri-arrow-right-s-line w-4 h-4 flex items-center justify-center"></i>
        <span className="text-foreground-200 whitespace-nowrap">{site.name}</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">{site.name}</h1>
            <StatusPill tone={op.tone} label={op.label} pulse={site.operationalStatus === 'critical'} />
            <StatusPill tone={ai.tone} label={ai.label} />
          </div>
          <p className="text-sm text-foreground-500 mt-1">{site.domain}</p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-[11px] font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">
              {BUSINESS_TYPE_LABELS[site.businessType]}
            </span>
            <span className="text-[11px] font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">
              {ENVIRONMENT_LABELS[site.environment]}
            </span>
            <span className="text-[11px] font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">
              Criticality: <span className="text-foreground-200">{crit.label}</span>
            </span>
          </div>
        </div>

        <button
          onClick={onEdit}
          className="inline-flex items-center gap-2 text-xs font-label text-foreground-200 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
        >
          <i className="ri-edit-line text-sm w-4 h-4 flex items-center justify-center"></i>
          Edit Site
        </button>
      </div>
    </div>
  );
}