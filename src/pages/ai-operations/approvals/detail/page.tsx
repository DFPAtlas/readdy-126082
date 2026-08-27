import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { AiApproval, ApprovalDecisionType } from '@/pages/ai-operations/types';
import { useAuth } from '@/components/feature/AuthGuard';
import { ROLE_LABELS } from '@/lib/permissions';
import { useApprovals } from '@/pages/ai-operations/approvals/ApprovalsContext';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';
import ApprovalHeader from '@/pages/ai-operations/approvals/detail/components/ApprovalHeader';
import RequestedAction from '@/pages/ai-operations/approvals/detail/components/RequestedAction';
import AiRecommendation from '@/pages/ai-operations/approvals/detail/components/AiRecommendation';
import Evidence from '@/pages/ai-operations/approvals/detail/components/Evidence';
import ImpactAssessment from '@/pages/ai-operations/approvals/detail/components/ImpactAssessment';
import RollbackRecovery from '@/pages/ai-operations/approvals/detail/components/RollbackRecovery';
import ApprovalRequirements from '@/pages/ai-operations/approvals/detail/components/ApprovalRequirements';
import DecisionHistory from '@/pages/ai-operations/approvals/detail/components/DecisionHistory';
import ExecutionGate from '@/pages/ai-operations/approvals/detail/components/ExecutionGate';
import WorkflowStage from '@/pages/ai-operations/approvals/detail/components/WorkflowStage';
import PolicyLinks from '@/pages/ai-operations/approvals/detail/components/PolicyLinks';
import { getAuditByApproval } from '@/pages/ai-operations/audit/selectors';
import RecentAuditEvents from '@/pages/ai-operations/audit/components/RecentAuditEvents';
import RuleReference from '@/pages/ai-operations/notifications/components/RuleReference';
import DecisionModal, { type DecisionPayload } from '@/pages/ai-operations/approvals/detail/components/DecisionModal';
import ApprovalFormModal from '@/pages/ai-operations/approvals/components/ApprovalFormModal';

export default function ApprovalDetailPage() {
  const { approvalId } = useParams<{ approvalId: string }>();
  const { mode, loading, sites, agents, runs, getApproval, recordDecision, updateApproval } = useApprovals();
  const { user, role } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<ApprovalDecisionType | null>(null);
  const [decisionError, setDecisionError] = useState('');

  // Decision actor = the authenticated staff identity (never an invented name).
  const actor = user?.email ?? (role ? ROLE_LABELS[role] : 'Authenticated staff');

  const approval = getApproval(approvalId ?? '');

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 animate-pulse">
          <div className="h-6 bg-background-200/60 rounded w-1/3 mb-3"></div>
          <div className="h-4 bg-background-200/60 rounded w-1/2"></div>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 animate-pulse">
          <div className="h-4 bg-background-200/60 rounded w-full mb-3"></div>
          <div className="h-4 bg-background-200/60 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!approval) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-lg mx-auto mt-16">
        <i className="ri-shield-check-line text-4xl text-foreground-600 w-10 h-10 flex items-center justify-center mx-auto"></i>
        <h1 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Approval not found</h1>
        <p className="text-sm text-foreground-500 mt-2">The requested approval does not exist in the registry.</p>
        <Link
          to="/ai-operations/approvals"
          className="inline-flex items-center gap-2 mt-6 text-sm font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
          Back to Approvals
        </Link>
      </div>
    );
  }

  const handleDecision = async (payload: DecisionPayload) => {
    setDecisionError('');
    const { error } = await recordDecision(approval.id, {
      type: payload.type,
      reason: payload.reason,
      conditions: payload.conditions,
      actor,
      actorRole: role ? ROLE_LABELS[role] : 'staff',
    });
    if (error) {
      setDecisionError(error);
    }
  };

  return (
    <div className="space-y-6">
      <ApprovalHeader
        approval={approval}
        onDecision={(type) => setDecisionType(type)}
        onEdit={() => setEditOpen(true)}
      />

      {/* Data-source distinction */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
        <DataSourceBadge mode={mode} />
        <p className="text-xs text-foreground-500">
          {mode === 'live'
            ? 'Live approval record — base identity, status, linkage, decision metadata and append-only decision history are live. Supporting sections below (evidence, impact, rollback detail, recommendation, workflow and gate checks) remain demo data until their tables exist.'
            : 'Demo approval record — all data is demo supporting metadata; nothing is written to Supabase.'}
        </p>
      </div>

      {decisionError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <p className="text-sm text-red-400">{decisionError}</p>
        </div>
      )}

      {/* Live-backed base record */}
      <RequestedAction approval={approval} />
      <ApprovalRequirements requirement={approval.requirement} separation={approval.separation} />
      <DecisionHistory history={approval.history} />

      {/* Demo supporting metadata */}
      <div className="flex items-center gap-3 pt-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1 whitespace-nowrap">
          <i className="ri-flask-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i>
          Demo Supporting Metadata
        </span>
        <div className="h-px flex-1 bg-background-200/60"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AiRecommendation recommendation={approval.recommendation} />
        <ImpactAssessment impact={approval.impact} />
      </div>

      <Evidence evidence={approval.evidence} />

      <RollbackRecovery rollback={approval.rollback} />

      <PolicyLinks approval={approval} />
      <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-3">
        <RuleReference source="Approvals" eventType="approval_expiring" />
      </div>
      <RecentAuditEvents title="Audit Evidence" events={getAuditByApproval(approval.id)} emptyMessage="No audit evidence recorded for this approval yet." />
      <ExecutionGate checks={approval.executionGate} />
      <WorkflowStage status={approval.status} />

      {decisionType && (
        <DecisionModal
          open
          onClose={() => setDecisionType(null)}
          decisionType={decisionType}
          severity={approval.severity}
          onSubmit={handleDecision}
        />
      )}

      <ApprovalFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        approval={approval}
        mode={mode}
        sites={sites}
        agents={agents}
        runs={runs}
        onSave={(record) => updateApproval(record as AiApproval)}
      />
    </div>
  );
}