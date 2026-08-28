import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { ToolConnection } from '@/pages/ai-operations/types';
import { useTools } from '@/pages/ai-operations/tools/ToolsContext';
import { useAuth } from '@/components/feature/AuthGuard';
import { ROLE_LABELS } from '@/lib/permissions';
import DataSourceBadge from '@/pages/ai-operations/sites/components/DataSourceBadge';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import ConnectionHeader from '@/pages/ai-operations/tools/detail/components/ConnectionHeader';
import Overview from '@/pages/ai-operations/tools/detail/components/Overview';
import AgentAccess from '@/pages/ai-operations/tools/detail/components/AgentAccess';
import SiteUsage from '@/pages/ai-operations/tools/detail/components/SiteUsage';
import AllowedOperations from '@/pages/ai-operations/tools/detail/components/AllowedOperations';
import Permissions from '@/pages/ai-operations/tools/detail/components/Permissions';
import HealthDiagnostics from '@/pages/ai-operations/tools/detail/components/HealthDiagnostics';
import Dependencies from '@/pages/ai-operations/tools/detail/components/Dependencies';
import RecentUsage from '@/pages/ai-operations/tools/detail/components/RecentUsage';
import SecurityControls from '@/pages/ai-operations/tools/detail/components/SecurityControls';
import ApplicablePolicies from '@/pages/ai-operations/tools/detail/components/ApplicablePolicies';
import { getAuditByTool } from '@/pages/ai-operations/audit/selectors';
import RecentAuditEvents from '@/pages/ai-operations/audit/components/RecentAuditEvents';
import ConnectionFormModal from '@/pages/ai-operations/tools/components/ConnectionFormModal';
import AgentAccessFormModal from '@/pages/ai-operations/tools/detail/components/AgentAccessFormModal';
import RuntimeConnectivity from '@/pages/ai-operations/runtime-health/components/RuntimeConnectivity';
import { resolveCategorySystem } from '@/lib/ai-operations/runtimeHealth';

export default function ToolDetailPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const { connections, mode, loading, error, refresh, loadDemo, agents, updateConnection, grantAccess, revokeAccess } = useTools();
  const { user, role } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [revokeAgent, setRevokeAgent] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  // Actor for audit events = authenticated staff identity (never invented).
  const actor = user?.email ?? (role ? ROLE_LABELS[role] : 'Authenticated staff');

  const connection = connections.find((c) => c.id === connectionId);

  // Loading skeleton.
  if (loading) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="w-full h-8 bg-background-200/60 rounded-md animate-pulse"></div>
        ))}
        <p className="text-xs font-label text-foreground-600 pt-2">Loading connection…</p>
      </div>
    );
  }

  // Error state — never auto-switch to demo.
  if (mode === 'error') {
    return (
      <div className="bg-background-100 border border-red-500/20 rounded-lg p-10 text-center max-w-lg mx-auto mt-16">
        <i className="ri-cloud-off-line text-3xl text-red-400 w-8 h-8 flex items-center justify-center mx-auto"></i>
        <h1 className="text-base font-heading font-semibold text-foreground-50 mt-4">Live connection unavailable</h1>
        <p className="text-sm text-foreground-500 mt-2">{error ?? 'The live registry could not be reached.'}</p>
        <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
          <button
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 text-xs font-label text-foreground-200 bg-background-100 border border-background-300/60 rounded-md px-4 py-2 hover:border-background-300/80 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Retry
          </button>
          <button
            onClick={loadDemo}
            className="inline-flex items-center gap-2 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-flask-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Use Demo Data
          </button>
        </div>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-lg mx-auto mt-16">
        <i className="ri-plug-2-line text-4xl text-foreground-600 w-10 h-10 flex items-center justify-center mx-auto"></i>
        <h1 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Connection not found</h1>
        <p className="text-sm text-foreground-500 mt-2">The requested connection does not exist in the registry.</p>
        <Link
          to="/ai-operations/tools"
          className="inline-flex items-center gap-2 mt-6 text-sm font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
          Back to Tools &amp; Connections
        </Link>
      </div>
    );
  }

  const handleRevokeConfirm = () => {
    if (!revokeAgent) return;
    void revokeAccess(connection.id, revokeAgent, revokeReason.trim(), actor);
    setRevokeAgent(null);
    setRevokeReason('');
  };

  return (
    <div className="space-y-6">
      {/* Data source + live/demo distinction */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <DataSourceBadge mode={mode} />
        <p className="text-xs text-foreground-500">
          {mode === 'live'
            ? 'Live Connection Record — base identity, metadata and agent access are read from Supabase. Sections below the divider are demo supporting metadata with no production table yet.'
            : mode === 'demo'
              ? 'Demo Data — this connection record is from the mock registry.'
              : 'Live connection data is unavailable; the registry may be in an error state.'}
        </p>
      </div>

      <ConnectionHeader connection={connection} onEdit={() => setEditOpen(true)} />

      <Overview connection={connection} />

      {/* Live runtime connectivity (verified server-side, manual check only) */}
      <RuntimeConnectivity
        connectionKey={connection.id}
        system={resolveCategorySystem(connection.category)}
      />

      {/* Live agent access (from ai_tool_agent_access) */}
      <AgentAccess
        connection={connection}
        mode={mode}
        onGrant={mode === 'live' ? () => setGrantOpen(true) : undefined}
        onRevoke={mode === 'live' ? (agentId) => setRevokeAgent(agentId) : undefined}
      />

      {/* Demo supporting metadata — no live production tables yet */}
      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-background-200/60"></div>
        <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">
          Demo Supporting Metadata
        </span>
        <div className="h-px flex-1 bg-background-200/60"></div>
      </div>

      <SiteUsage connection={connection} />

      <AllowedOperations connection={connection} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Permissions connection={connection} />
        <HealthDiagnostics connection={connection} />
      </div>

      <Dependencies connection={connection} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RecentUsage connection={connection} />
        <SecurityControls connection={connection} />
      </div>

      <ApplicablePolicies connectionId={connection.id} />

      <RecentAuditEvents title="Recent Audit Events" events={getAuditByTool(connection.id)} emptyMessage="No recent audit events for this connection." />

      {/* Edit connection modal */}
      <ConnectionFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        connection={connection}
        onSave={(record) => updateConnection(connection.id, record as ToolConnection, actor)}
      />

      {/* Grant / update agent access modal */}
      <AgentAccessFormModal
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        agents={agents}
        onSave={(agentKey, input) => void grantAccess(connection.id, agentKey, input, actor)}
      />

      {/* Revoke access confirm */}
      <ConfirmDialog
        open={revokeAgent !== null}
        onClose={() => {
          setRevokeAgent(null);
          setRevokeReason('');
        }}
        title="Revoke agent access"
        message="Revoking access sets it inactive — the access history is preserved and never physically deleted."
        confirmLabel="Revoke Access"
        confirmVariant="danger"
        onConfirm={handleRevokeConfirm}
      >
        <textarea
          value={revokeReason}
          onChange={(e) => setRevokeReason(e.target.value)}
          rows={3}
          placeholder="Reason for revocation (optional)…"
          className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none mt-3"
        />
      </ConfirmDialog>
    </div>
  );
}