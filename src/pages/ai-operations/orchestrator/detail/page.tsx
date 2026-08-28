import { useParams, Link } from 'react-router-dom';
import { useOrchestrator } from '@/pages/ai-operations/orchestrator/OrchestratorContext';
import { getAlertByOrchestration } from '@/pages/ai-operations/alerts/selectors';
import OpenIncident from '@/pages/ai-operations/alerts/components/OpenIncident';
import OrchestratorHeader from '@/pages/ai-operations/orchestrator/detail/components/OrchestratorHeader';
import LifecycleStepper from '@/pages/ai-operations/orchestrator/detail/components/LifecycleStepper';
import RequestClassification from '@/pages/ai-operations/orchestrator/detail/components/RequestClassification';
import SiteResolution from '@/pages/ai-operations/orchestrator/detail/components/SiteResolution';
import AgentSelection from '@/pages/ai-operations/orchestrator/detail/components/AgentSelection';
import CandidateAgents from '@/pages/ai-operations/orchestrator/detail/components/CandidateAgents';
import RoutingDecisions, { type RoutingDecisionItem } from '@/pages/ai-operations/orchestrator/detail/components/RoutingDecisions';
import ExecutionPlan from '@/pages/ai-operations/orchestrator/detail/components/ExecutionPlan';
import AgentWorkflow from '@/pages/ai-operations/orchestrator/detail/components/AgentWorkflow';
import PermissionGate from '@/pages/ai-operations/orchestrator/detail/components/PermissionGate';
import RiskAssessment from '@/pages/ai-operations/orchestrator/detail/components/RiskAssessment';
import HumanApprovalGate from '@/pages/ai-operations/orchestrator/detail/components/HumanApprovalGate';
import CapacityFallback from '@/pages/ai-operations/orchestrator/detail/components/CapacityFallback';
import FailureStrategy from '@/pages/ai-operations/orchestrator/detail/components/FailureStrategy';
import RequiredTools from '@/pages/ai-operations/orchestrator/detail/components/RequiredTools';
import RequiredKnowledge from '@/pages/ai-operations/orchestrator/detail/components/RequiredKnowledge';
import PolicyEvaluation from '@/pages/ai-operations/orchestrator/detail/components/PolicyEvaluation';
import VerificationUatAudit from '@/pages/ai-operations/orchestrator/detail/components/VerificationUatAudit';
import RelatedRecords from '@/pages/ai-operations/orchestrator/detail/components/RelatedRecords';
import { getAuditByOrchestration } from '@/pages/ai-operations/audit/selectors';
import RecentAuditEvents from '@/pages/ai-operations/audit/components/RecentAuditEvents';
import RuleReference from '@/pages/ai-operations/notifications/components/RuleReference';
import ExecutionGateSummary from '@/pages/ai-operations/runtime-controls/components/ExecutionGateSummary';
import RuntimeRequestEvaluation from '@/pages/ai-operations/runtime-controls/components/RuntimeRequestEvaluation';
import N8nWorkflowMapping from '@/pages/ai-operations/runtime-controls/components/N8nWorkflowMapping';

export default function OrchestratorDetailPage() {
  const { orchestrationId } = useParams<{ orchestrationId: string }>();
  const { orchestrations, loading, error, refresh, loadDemo, getDecisions, mode } = useOrchestrator();

  const orchestration = orchestrations.find((o) => o.id === orchestrationId);

  const relatedAlert = orchestrationId ? getAlertByOrchestration(orchestrationId) : undefined;

  const routingItems: RoutingDecisionItem[] = (() => {
    if (!orchestrationId) return [];
    if (mode === 'live') {
      return getDecisions(orchestrationId).map((d) => ({
        timestamp: d.timestamp,
        label: d.label,
        result: d.result,
        reason: d.reason,
        actor: `${d.actorType} · ${d.actorReference}`,
      }));
    }
    const o = orchestrations.find((x) => x.id === orchestrationId);
    return (o?.events ?? []).map((e) => ({
      timestamp: e.timestamp,
      label: e.event,
      result: e.summary,
      reason: '',
      actor: e.actor,
    }));
  })();

  if (loading) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-12 text-center">
        <i className="ri-loader-4-line text-2xl text-accent-400 w-8 h-8 flex items-center justify-center mx-auto animate-spin"></i>
        <p className="text-sm text-foreground-500 mt-3">Loading orchestration…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-lg mx-auto mt-16">
        <i className="ri-error-warning-line text-3xl text-red-400 w-10 h-10 flex items-center justify-center mx-auto"></i>
        <h1 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Orchestrator unavailable</h1>
        <p className="text-sm text-foreground-500 mt-2">{error}</p>
        <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
          <button
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Retry
          </button>
          <button
            onClick={loadDemo}
            className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-50 border border-background-300/60 rounded-md px-4 py-2 hover:text-foreground-100 hover:border-background-400/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            Use Demo Data
          </button>
        </div>
      </div>
    );
  }

  if (!orchestration) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-lg mx-auto mt-16">
        <i className="ri-robot-2-line text-4xl text-foreground-600 w-10 h-10 flex items-center justify-center mx-auto"></i>
        <h1 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Orchestration not found</h1>
        <p className="text-sm text-foreground-500 mt-2">The requested orchestration does not exist in the registry.</p>
        <Link
          to="/ai-operations/orchestrator"
          className="inline-flex items-center gap-2 mt-6 text-sm font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
          Back to Orchestrator
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OrchestratorHeader orchestration={orchestration} />
      <LifecycleStepper orchestration={orchestration} />

      {/* Execution runtime banner */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
          <i className="ri-lock-line w-4 h-4 flex items-center justify-center"></i>
        </div>
        <div>
          <p className="text-sm font-label font-semibold text-foreground-100">Execution disabled — runtime is not connected.</p>
          <p className="text-xs text-foreground-400 mt-1">
            This orchestration is planning/governance metadata only. No agent, tool, model, n8n workflow or run has been executed. Candidate scoring below reflects registry eligibility, not runtime availability.
          </p>
        </div>
      </div>

      {relatedAlert && <OpenIncident alert={relatedAlert} />}

      {/* Runtime execution gate evaluation (deterministic, fail-closed) */}
      <ExecutionGateSummary orchestration={orchestration} />

      {/* Runtime request evaluation (deny-only gateway) */}
      <RuntimeRequestEvaluation orchestration={orchestration} />

      {/* n8n workflow mapping (read-only, dry-run preview) */}
      <N8nWorkflowMapping orchestration={orchestration} />

      {(orchestration.status === 'blocked' || orchestration.status === 'failed' || orchestration.status === 'escalated') && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-3">
          <RuleReference source="Orchestrator" eventType="orchestration_blocked" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RequestClassification orchestration={orchestration} />
        <SiteResolution orchestration={orchestration} />
      </div>

      <AgentSelection orchestration={orchestration} />
      <CandidateAgents orchestration={orchestration} />
      <RoutingDecisions items={routingItems} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ExecutionPlan orchestration={orchestration} />
        <AgentWorkflow orchestration={orchestration} />
      </div>

      <PermissionGate orchestration={orchestration} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RiskAssessment orchestration={orchestration} />
        <HumanApprovalGate orchestration={orchestration} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CapacityFallback orchestration={orchestration} />
        <FailureStrategy orchestration={orchestration} />
      </div>

      <RequiredTools orchestration={orchestration} />
      <RequiredKnowledge orchestration={orchestration} />
      <PolicyEvaluation orchestration={orchestration} />
      <VerificationUatAudit orchestration={orchestration} />
      <RecentAuditEvents title="Audit Events" events={getAuditByOrchestration(orchestration.id)} emptyMessage="No audit events recorded for this orchestration yet." />
      <RelatedRecords orchestration={orchestration} />
    </div>
  );
}