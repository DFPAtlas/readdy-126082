import { useParams, Link } from 'react-router-dom';
import { useRuns } from '@/pages/ai-operations/runs/RunsContext';
import { getAlertByRun } from '@/pages/ai-operations/alerts/selectors';
import OpenIncident from '@/pages/ai-operations/alerts/components/OpenIncident';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';
import RunHeader from '@/pages/ai-operations/runs/detail/components/RunHeader';
import RunOverview from '@/pages/ai-operations/runs/detail/components/RunOverview';
import ExecutionTimeline from '@/pages/ai-operations/runs/detail/components/ExecutionTimeline';
import AgentChain from '@/pages/ai-operations/runs/detail/components/AgentChain';
import InputResult from '@/pages/ai-operations/runs/detail/components/InputResult';
import FailureDetails from '@/pages/ai-operations/runs/detail/components/FailureDetails';
import CostTracking from '@/pages/ai-operations/runs/detail/components/CostTracking';
import ApprovalUat from '@/pages/ai-operations/runs/detail/components/ApprovalUat';
import AuditMetadata from '@/pages/ai-operations/runs/detail/components/AuditMetadata';
import SecurityDecision from '@/pages/ai-operations/runs/detail/components/SecurityDecision';
import RecentAuditEvents from '@/pages/ai-operations/audit/components/RecentAuditEvents';
import RuleReference from '@/pages/ai-operations/notifications/components/RuleReference';

// A labelled divider marking the sections below as demo supporting metadata
// (not yet backed by live persistence).
function DemoMetadataDivider() {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="flex-1 h-px bg-background-200/60"></span>
      <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-amber-400 whitespace-nowrap">
        <i className="ri-flask-line w-3.5 h-3.5 flex items-center justify-center"></i>
        Demo Supporting Metadata
      </span>
      <span className="flex-1 h-px bg-background-200/60"></span>
    </div>
  );
}

export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const { mode, loading, error, refresh, loadDemo, getRun, getAuditForRun } = useRuns();

  const run = runId ? getRun(runId) : undefined;
  const liveMode = mode === 'live';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-background-100 rounded-md animate-pulse"></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-background-100 border border-background-200/60 rounded-lg p-3.5 h-20 animate-pulse"></div>
          ))}
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 bg-background-200/50 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (mode === 'error') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Run Detail</h1>
          <DataSourceBadge mode="error" />
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-xl mx-auto">
          <i className="ri-error-warning-line text-4xl text-amber-400 w-10 h-10 flex items-center justify-center mx-auto"></i>
          <h2 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Live Tasks &amp; Runs unavailable</h2>
          <p className="text-sm text-foreground-500 mt-2">{error}</p>
          <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
            <button
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 text-sm font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line w-4 h-4 flex items-center justify-center"></i>
              Retry
            </button>
            <button
              onClick={loadDemo}
              className="inline-flex items-center gap-2 text-sm font-label text-foreground-200 bg-background-100 border border-background-200/60 rounded-md px-4 py-2 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-flask-line w-4 h-4 flex items-center justify-center"></i>
              Use Demo Data
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-lg mx-auto mt-16">
        <i className="ri-list-check-3 text-4xl text-foreground-600 w-10 h-10 flex items-center justify-center mx-auto"></i>
        <h1 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Run not found</h1>
        <p className="text-sm text-foreground-500 mt-2">The requested run does not exist in the registry.</p>
        <Link
          to="/ai-operations/runs"
          className="inline-flex items-center gap-2 mt-6 text-sm font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
          Back to Tasks &amp; Runs
        </Link>
      </div>
    );
  }

  const relatedAlert = runId ? getAlertByRun(runId) : undefined;

  return (
    <div className="space-y-6">
      {liveMode && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-database-2-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i>
            Live Run Record
          </span>
          <span className="text-[11px] font-label text-foreground-600">Sections below the divider are demo supporting metadata.</span>
        </div>
      )}

      <RunHeader run={run} liveMode={liveMode} />

      {relatedAlert && <OpenIncident alert={relatedAlert} />}

      {(run.status === 'failed' || run.status === 'blocked' || run.status === 'timed_out') && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-3">
          <RuleReference source="Tasks & Runs" eventType="run_failure" />
        </div>
      )}

      <RunOverview run={run} />
      <ExecutionTimeline steps={run.steps} />

      {liveMode && <DemoMetadataDivider />}

      <AgentChain chain={run.chain} />
      <InputResult input={run.input} result={run.result} />
      <FailureDetails run={run} />
      <CostTracking cost={run.cost} />
      <ApprovalUat approval={run.approval} uat={run.uat} />
      <SecurityDecision run={run} />
      <RecentAuditEvents title="Audit Trail" events={getAuditForRun(run.id)} emptyMessage="No audit events recorded for this run yet." />
      <AuditMetadata audit={run.audit} />
    </div>
  );
}