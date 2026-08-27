import { Link } from 'react-router-dom';
import type { AiOrchestration } from '@/pages/ai-operations/types';
import { SITE_STATUS, AI_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function SiteResolution({ orchestration }: { orchestration: AiOrchestration }) {
  const s = orchestration.siteResolution;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Site Resolution</h3>
        {orchestration.siteId !== 'group' && (
          <Link
            to={`/ai-operations/sites/${orchestration.siteId}`}
            className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            Open Site
            <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
          </Link>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Selected site</p>
          <p className="text-sm text-foreground-100 mt-0.5">{s.selectedSite}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Confidence</p>
          <p className="text-sm text-foreground-300 mt-0.5">{s.confidence}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Capability match</p>
          <p className="text-sm text-foreground-300 mt-0.5">{s.capabilityMatch}</p>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Operational status</p>
          <div className="mt-1"><StatusPill tone={SITE_STATUS[s.operationalStatus].tone} label={SITE_STATUS[s.operationalStatus].label} /></div>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">AI status</p>
          <div className="mt-1"><StatusPill tone={AI_STATUS[s.aiStatus].tone} label={AI_STATUS[s.aiStatus].label} /></div>
        </div>
        <div>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Alternatives considered</p>
          <p className="text-sm text-foreground-300 mt-0.5">{s.alternatives.length ? s.alternatives.join(', ') : 'None'}</p>
        </div>
      </div>
    </section>
  );
}