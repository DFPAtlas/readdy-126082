import type { LiveSummary, CommercialSummary, LaunchPipeline } from '../portfolioTypes';
import { formatMoney } from '../portfolioDerive';

export default function PortfolioSidePanels({
  live,
  commercial,
  pipeline,
}: {
  live: LiveSummary;
  commercial: CommercialSummary;
  pipeline: LaunchPipeline;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel icon="ri-rocket-2-line" title="Live Portfolio" accent="text-emerald-400">
        <Stat label="Live Projects" value={String(live.live)} />
        <div className="grid grid-cols-2 gap-2 mt-3">
          <TinyStat label="Healthy" value={live.healthy} tone="text-emerald-400" />
          <TinyStat label="Degraded" value={live.degraded} tone="text-amber-400" />
          <TinyStat label="Critical" value={live.critical} tone="text-red-400" />
          <TinyStat label="Offline" value={live.offline} tone="text-red-400" />
          <TinyStat label="Unknown" value={live.unknown} tone="text-foreground-400" />
        </div>
      </Panel>

      <Panel icon="ri-money-pound-circle-line" title="Commercial Summary" accent="text-emerald-400">
        {commercial.coverageIncomplete && (
          <p className="text-[10px] text-foreground-500 mb-2">
            Configured Portfolio Values — some projects lack financial figures.
          </p>
        )}
        <Stat label="Monthly Revenue" value={formatMoney(commercial.configuredMonthlyRevenue)} />
        <Stat label="Monthly Operating Cost" value={formatMoney(commercial.monthlyOperatingCost)} />
        <Stat
          label="Monthly Margin"
          value={formatMoney(commercial.monthlyMargin)}
          tone={commercial.monthlyMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
        <div className="grid grid-cols-2 gap-2 mt-3">
          <TinyStat label="Over Budget" value={commercial.projectsOverBudget} tone="text-red-400" />
          <TinyStat label="Launch Blockers" value={commercial.commercialLaunchBlockers} tone="text-amber-400" />
        </div>
      </Panel>

      <Panel icon="ri-git-branch-line" title="Launch Pipeline" accent="text-accent-400">
        <div className="space-y-1.5">
          <PipelineRow label="Building" value={pipeline.building} />
          <PipelineRow label="In UAT" value={pipeline.uat} />
          <PipelineRow label="No-Go" value={pipeline.noGo} tone="text-red-400" />
          <PipelineRow label="Pending Approval" value={pipeline.pendingApproval} />
          <PipelineRow label="Awaiting Deployment" value={pipeline.awaitingDeployment} tone="text-emerald-400" />
          <PipelineRow label="Deploying" value={pipeline.deploying} />
          <PipelineRow label="Verification Required" value={pipeline.verificationRequired} />
        </div>
      </Panel>
    </div>
  );
}

function Panel({
  icon,
  title,
  accent,
  children,
}: {
  icon: string;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-5">
      <h3 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-4">
        <i className={`${icon} ${accent} w-4 h-4 flex items-center justify-center`}></i>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-background-200/60 last:border-0">
      <span className="text-xs text-foreground-500">{label}</span>
      <span className={`text-sm font-heading font-semibold ${tone ?? 'text-foreground-100'}`}>{value}</span>
    </div>
  );
}

function TinyStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-md px-2.5 py-2">
      <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide">{label}</p>
      <p className={`text-base font-heading font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function PipelineRow({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-foreground-500">{label}</span>
      <span className={`font-heading font-semibold ${tone ?? 'text-foreground-100'}`}>{value}</span>
    </div>
  );
}