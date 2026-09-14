import { Link } from 'react-router-dom';
import type { PortfolioSummary, LaunchPipelineExec } from '../executiveTypes';
import { SectionHeading, Unavailable } from './shared';

const LIFE_CARDS: { key: string; label: string; icon: string; value: (s: PortfolioSummary) => number }[] = [
  { key: 'total', label: 'Total', icon: 'ri-folder-3-line', value: (s) => s.total },
  { key: 'active', label: 'Active', icon: 'ri-checkbox-circle-line', value: (s) => s.active },
  { key: 'building', label: 'Building', icon: 'ri-hammer-line', value: (s) => s.building },
  { key: 'testing', label: 'Testing', icon: 'ri-clipboard-line', value: (s) => s.testing },
  { key: 'live', label: 'Live', icon: 'ri-earth-line', value: (s) => s.live },
  { key: 'atRisk', label: 'At Risk', icon: 'ri-alert-line', value: (s) => s.blockedAtRisk },
  { key: 'critical', label: 'Critical Ops', icon: 'ri-pulse-line', value: (s) => s.criticalOps },
  { key: 'ready', label: 'Launch Ready', icon: 'ri-rocket-line', value: (s) => s.launchReady },
];

const PIPELINE_STAGES: { key: string; label: string; value: (p: LaunchPipelineExec) => number }[] = [
  { key: 'building', label: 'Building', value: (p) => p.building },
  { key: 'uat', label: 'UAT', value: (p) => p.uat },
  { key: 'noGo', label: 'NO-GO', value: (p) => p.noGo },
  { key: 'pending', label: 'Pending Approval', value: (p) => p.pendingApproval },
  { key: 'awaiting', label: 'Approved / Awaiting Deploy', value: (p) => p.awaitingDeployment },
  { key: 'deploying', label: 'Deploying', value: (p) => p.deploying },
  { key: 'verifying', label: 'Verification Required', value: (p) => p.verificationRequired },
  { key: 'launched', label: 'Recently Launched', value: (p) => p.recentlyLaunched },
];

export default function PortfolioSummaryPanel({
  summary,
  pipeline,
  available,
}: {
  summary: PortfolioSummary;
  pipeline: LaunchPipelineExec;
  available: boolean;
}) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-5">
      <SectionHeading icon="ri-pie-chart-2-line" title="Portfolio" action={{ label: 'View Full Portfolio', to: '/projects' }} />

      {!available ? (
        <Unavailable label="Portfolio data unavailable" />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-5">
            {LIFE_CARDS.map((c) => (
              <div key={c.key} className="bg-background-50 border border-background-200/50 rounded-md px-3 py-2 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <i className={`${c.icon} w-3 h-3 flex items-center justify-center text-foreground-400`}></i>
                  <span className="text-[9px] font-label text-foreground-500 uppercase tracking-wide truncate whitespace-nowrap">
                    {c.label}
                  </span>
                </div>
                <p className="text-lg font-heading font-bold text-foreground-50 leading-none">{c.value(summary)}</p>
              </div>
            ))}
          </div>

          <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide mb-2">Launch Pipeline</p>
          <div className="flex flex-wrap gap-2">
            {PIPELINE_STAGES.map((s) => (
              <Link
                key={s.key}
                to="/projects"
                className="flex items-center gap-2 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors cursor-pointer"
              >
                <span className="text-xs text-foreground-300 whitespace-nowrap">{s.label}</span>
                <span
                  className={`text-xs font-heading font-bold px-1.5 rounded ${
                    s.key === 'noGo' || s.key === 'deploying'
                      ? 'bg-red-500/10 text-red-400'
                      : s.key === 'launched'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-accent-500/10 text-accent-400'
                  }`}
                >
                  {s.value(pipeline)}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}