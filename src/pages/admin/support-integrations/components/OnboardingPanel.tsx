import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { CapabilityKey, N8nWorkflowStatus, SupportSite, SupportSiteCapability, SupportSiteConnector } from '@/types/support-tickets';
import { useSiteOnboarding } from '../onboarding-hooks';
import {
  CAPABILITIES,
  CAPABILITY_STATUS_META,
  CONNECTOR_HEALTH_META,
  CONNECTOR_TYPE_LABEL,
  ENVIRONMENT_LABELS,
  ENVIRONMENTS,
  SITE_STATUSES,
  SITE_STATUS_META,
} from '../onboarding-constants';
import ConnectorFormModal from './ConnectorFormModal';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import { formatRelative } from '../constants';

interface OnboardingPanelProps {
  site: SupportSite;
  defaultTeamName: string | null;
  onSiteChanged: () => void;
}

const N8N_WORKFLOWS: Array<{ key: keyof N8nWorkflowStatus; label: string; icon: string }> = [
  { key: 'diagnostics', label: 'Diagnostic Workflow', icon: 'ri-stethoscope-line' },
  { key: 'repairs', label: 'Repair Workflow', icon: 'ri-tools-line' },
  { key: 'ai_triage', label: 'AI Triage Workflow', icon: 'ri-robot-2-line' },
  { key: 'ai_reply', label: 'AI Reply Workflow', icon: 'ri-chat-smile-2-line' },
];

export default function OnboardingPanel({ site, defaultTeamName, onSiteChanged }: OnboardingPanelProps) {
  const { capabilities, connectors, tests, n8n, loading, error, reload } = useSiteOnboarding(site.id);

  const [testingCaps, setTestingCaps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [connectorModal, setConnectorModal] = useState(false);
  const [editingConnector, setEditingConnector] = useState<SupportSiteConnector | null>(null);
  const [disableTarget, setDisableTarget] = useState<SupportSiteConnector | null>(null);
  const [disableReason, setDisableReason] = useState('');
  const [disableError, setDisableError] = useState('');
  const [healthRunning, setHealthRunning] = useState(false);

  const capMap = useMemo(() => {
    const m: Record<string, SupportSiteCapability> = {};
    for (const c of capabilities) m[c.capability] = c;
    return m;
  }, [capabilities]);

  const runTest = async (capability: CapabilityKey) => {
    setTestingCaps((t) => [...t, capability]);
    setFeedback(null);
    const { data, error: e } = await supabase.functions.invoke('support-connector-test', {
      body: { action: 'test', site_id: site.id, capability },
    });
    setTestingCaps((t) => t.filter((c) => c !== capability));
    if (e) {
      setFeedback({ type: 'error', message: e.message || 'Connection test failed.' });
      return;
    }
    const status = data?.status as string;
    const message = data?.message as string;
    if (status === 'pass') setFeedback({ type: 'success', message: message || 'Test passed.' });
    else if (status === 'not_configured') setFeedback({ type: 'error', message: message || 'Not configured.' });
    else setFeedback({ type: 'error', message: message || 'Test failed.' });
    reload();
  };

  const toggleCapability = async (capability: CapabilityKey, enabled: boolean) => {
    setBusy(true);
    setFeedback(null);
    const { error: e } = await supabase.rpc('support_set_capability_enabled', {
      p_site_id: site.id,
      p_capability: capability,
      p_enabled: enabled,
    });
    setBusy(false);
    if (e) {
      setFeedback({ type: 'error', message: e.message });
      return;
    }
    setFeedback({ type: 'success', message: enabled ? 'Capability enabled.' : 'Capability disabled.' });
    reload();
  };

  const runHealthCheck = async () => {
    setHealthRunning(true);
    setFeedback(null);
    let passCount = 0;
    let failCount = 0;
    for (const cap of ['ticket_intake', 'site_health'] as CapabilityKey[]) {
      const { data, error: e } = await supabase.functions.invoke('support-connector-test', {
        body: { action: 'test', site_id: site.id, capability: cap },
      });
      if (e || !data) {
        failCount += 1;
        continue;
      }
      if (data.status === 'pass') passCount += 1;
      else if (data.status === 'fail') failCount += 1;
    }
    setHealthRunning(false);
    if (failCount > 0) {
      setFeedback({ type: 'error', message: `Health check degraded — ${passCount} passed, ${failCount} failed.` });
    } else {
      setFeedback({ type: 'success', message: `Health check operational — ${passCount} checks passed.` });
    }
    reload();
  };

  const changeStatus = async (status: string) => {
    setBusy(true);
    setFeedback(null);
    const { error: e } = await supabase.rpc('support_set_site_status', {
      p_site_id: site.id,
      p_status: status,
    });
    setBusy(false);
    if (e) {
      setFeedback({
        type: 'error',
        message: e.message === 'ACTIVATION_NOT_READY'
          ? 'Site cannot be activated until Ticket Intake and Customer Resolution are operational and a default team is assigned.'
          : e.message,
      });
      return;
    }
    setFeedback({ type: 'success', message: `Site status updated to ${status}.` });
    onSiteChanged();
  };

  const markRotation = async (connector: SupportSiteConnector) => {
    setFeedback(null);
    const { error: e } = await supabase.rpc('support_mark_credential_rotation', {
      p_connector_id: connector.id,
      p_needs_rotation: !connector.needs_rotation,
    });
    if (e) {
      setFeedback({ type: 'error', message: e.message });
      return;
    }
    setFeedback({ type: 'success', message: connector.needs_rotation ? 'Rotation marked complete.' : 'Credential marked for rotation.' });
    reload();
  };

  const confirmDisable = async () => {
    if (!disableTarget) return;
    if (!disableReason.trim()) {
      setDisableError('A reason is required to disable a connector.');
      return;
    }
    setDisableError('');
    const { error: e } = await supabase.rpc('support_disable_connector', {
      p_connector_id: disableTarget.id,
      p_reason: disableReason.trim(),
    });
    if (e) {
      setFeedback({ type: 'error', message: e.message });
    } else {
      setFeedback({ type: 'success', message: 'Connector disabled.' });
    }
    setDisableTarget(null);
    setDisableReason('');
    reload();
  };

  // ---- Readiness checklist ----
  const checklist = useMemo(() => {
    const cap = (k: CapabilityKey) => capMap[k];
    const operational = (k: CapabilityKey) => cap(k)?.status === 'operational';
    const items: Array<{ label: string; status: 'pass' | 'not_configured'; required: boolean }> = [
      { label: 'Site registered', status: 'pass', required: true },
      { label: 'Domain configured', status: site.domain ? 'pass' : 'not_configured', required: true },
      { label: 'Default team assigned', status: site.default_support_team_id ? 'pass' : 'not_configured', required: true },
      { label: 'Ticket intake tested', status: operational('ticket_intake') ? 'pass' : 'not_configured', required: true },
      { label: 'Customer resolution tested', status: operational('customer_resolution') ? 'pass' : 'not_configured', required: true },
      { label: 'Diagnostics tested', status: operational('diagnostics') ? 'pass' : 'not_configured', required: false },
      { label: 'Repair connector tested', status: operational('repairs') ? 'pass' : 'not_configured', required: false },
      { label: 'View-as-Customer tested', status: operational('view_as_customer') ? 'pass' : 'not_configured', required: false },
      { label: 'AI Triage tested', status: operational('ai_triage') ? 'pass' : 'not_configured', required: false },
      { label: 'AI Reply tested', status: operational('ai_reply') ? 'pass' : 'not_configured', required: false },
    ];
    const ready = items.filter((i) => i.required).every((i) => i.status === 'pass');
    return { items, ready };
  }, [capMap, site]);

  const statusMeta = SITE_STATUS_META[site.status];

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 bg-background-200/50 rounded-lg animate-pulse"></div>)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3 text-sm text-red-400 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={reload} className="text-red-300 underline cursor-pointer whitespace-nowrap">Retry</button>
        </div>
      )}

      {feedback && (
        <div className={`px-4 py-3 rounded-md text-sm border flex items-start gap-2 ${feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border-red-500/20 text-red-400'}`} role="status">
          <i className={`${feedback.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} text-base w-4 h-4 flex items-center justify-center mt-px shrink-0`}></i>
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Site status + environment */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-foreground-100">Site lifecycle</h3>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs font-label px-2.5 py-1 rounded-full uppercase whitespace-nowrap ${statusMeta.tone}`}>{statusMeta.label}</span>
              <span className="text-xs font-label px-2.5 py-1 rounded-full uppercase bg-secondary-500/15 text-secondary-300 whitespace-nowrap">{ENVIRONMENT_LABELS[site.environment]}</span>
            </div>
            {site.default_support_team_id && (
              <p className="text-xs text-foreground-500 mt-2">
                Default team: <span className="text-foreground-200">{defaultTeamName ?? 'Unknown'}</span>
              </p>
            )}
            {!site.default_support_team_id && (
              <p className="text-xs text-amber-400 mt-2">No default team — unmatched tickets will go to Needs Review.</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runHealthCheck}
              disabled={healthRunning}
              className="inline-flex items-center gap-1.5 border border-background-300/60 hover:border-accent-500/50 text-foreground-200 hover:text-accent-400 px-3 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
            >
              {healthRunning ? <div className="w-3.5 h-3.5 border-2 border-accent-400 border-t-transparent rounded-full animate-spin"></div> : <i className="ri-pulse-line text-sm w-4 h-4 flex items-center justify-center"></i>}
              {healthRunning ? 'Checking…' : 'Run health check'}
            </button>
            <select
              value={site.status}
              onChange={(e) => changeStatus(e.target.value)}
              disabled={busy}
              className="text-sm bg-background-50 border border-background-300/60 rounded-md px-3 py-2 text-foreground-100 focus:outline-none focus:ring-2 focus:ring-accent-500/40 cursor-pointer disabled:opacity-40"
            >
              {SITE_STATUSES.map((s) => <option key={s} value={s}>{SITE_STATUS_META[s].label}</option>)}
            </select>
            <select
              value={site.environment}
              disabled
              className="text-sm bg-background-50 border border-background-300/60 rounded-md px-3 py-2 text-foreground-100 opacity-50"
            >
              {ENVIRONMENTS.map((e) => <option key={e} value={e}>{ENVIRONMENT_LABELS[e]}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Readiness checklist */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground-100">Activation readiness</h3>
          <span className={`text-xs font-label px-2.5 py-1 rounded-full uppercase whitespace-nowrap ${checklist.ready ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
            {checklist.ready ? 'Ready to activate' : 'Not ready'}
          </span>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg divide-y divide-background-200/40">
          {checklist.items.map((item) => (
            <div key={item.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-foreground-300">
                {item.label}
                {item.required && <span className="text-xs text-foreground-600 ml-1.5">(required)</span>}
              </span>
              <span className={`text-xs font-label px-2 py-0.5 rounded uppercase whitespace-nowrap ${item.status === 'pass' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-foreground-600/15 text-foreground-500'}`}>
                {item.status === 'pass' ? 'Pass' : 'Not configured'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Capabilities */}
      <div>
        <h3 className="text-sm font-semibold text-foreground-100 mb-2">Capabilities</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CAPABILITIES.map((c) => {
            const cap = capMap[c.key];
            const meta = CAPABILITY_STATUS_META[cap?.status ?? 'not_configured'];
            const testing = testingCaps.includes(c.key);
            return (
              <div key={c.key} className="bg-background-100 border border-background-200/60 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent-500/10 flex items-center justify-center shrink-0">
                    <i className={`${c.icon} text-accent-400 text-lg w-5 h-5 flex items-center justify-center`}></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground-100">{c.label}</span>
                      <span className={`text-[10px] font-label px-2 py-0.5 rounded uppercase whitespace-nowrap ${meta.tone}`}>{meta.label}</span>
                    </div>
                    <p className="text-xs text-foreground-500 mt-0.5 leading-relaxed">{c.description}</p>
                    {cap?.last_error && <p className="text-xs text-red-400 mt-1 truncate">{cap.last_error}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => runTest(c.key)}
                    disabled={testing}
                    className="inline-flex items-center gap-1.5 border border-background-300/60 hover:border-accent-500/50 text-foreground-200 hover:text-accent-400 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
                  >
                    {testing ? <div className="w-3.5 h-3.5 border-2 border-accent-400 border-t-transparent rounded-full animate-spin"></div> : <i className="ri-flashlight-line text-sm w-4 h-4 flex items-center justify-center"></i>}
                    {testing ? 'Testing…' : 'Test'}
                  </button>
                  <button
                    onClick={() => toggleCapability(c.key, !cap?.enabled)}
                    disabled={busy}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 ${cap?.enabled ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-background-200/60 text-foreground-400 hover:text-foreground-200'}`}
                  >
                    {cap?.enabled ? 'Enabled' : 'Enable'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connectors */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground-100">Connectors</h3>
          <button
            onClick={() => { setEditingConnector(null); setConnectorModal(true); }}
            className="inline-flex items-center gap-1.5 border border-background-300/60 hover:border-accent-500/50 text-foreground-200 hover:text-accent-400 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line text-sm w-4 h-4 flex items-center justify-center"></i>
            Add connector
          </button>
        </div>

        {connectors.length === 0 ? (
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 text-center">
            <p className="text-sm text-foreground-400">No connectors configured.</p>
            <p className="text-xs text-foreground-600 mt-1">Add a connector to reference this site's API credentials and n8n workflows.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {connectors.map((conn) => {
              const healthMeta = CONNECTOR_HEALTH_META[conn.health_status];
              return (
                <div key={conn.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground-100">{CONNECTOR_TYPE_LABEL[conn.connector_type]}</span>
                        <span className={`text-[10px] font-label px-2 py-0.5 rounded uppercase whitespace-nowrap ${healthMeta.tone}`}>{healthMeta.label}</span>
                        {conn.needs_rotation && (
                          <span className="text-[10px] font-label px-2 py-0.5 rounded uppercase bg-amber-500/15 text-amber-400 whitespace-nowrap">Needs rotation</span>
                        )}
                        {conn.disabled && (
                          <span className="text-[10px] font-label px-2 py-0.5 rounded uppercase bg-red-500/15 text-red-400 whitespace-nowrap">Disabled</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-foreground-500 flex-wrap">
                        <span>
                          Credential: <span className={conn.credential_configured ? 'text-emerald-400' : 'text-foreground-500'}>{conn.credential_configured ? 'Configured' : 'Not configured'}</span>
                        </span>
                        {conn.api_base_reference && <span className="font-mono truncate max-w-[200px]">{conn.api_base_reference}</span>}
                        {conn.last_tested_at && <span>Last tested {formatRelative(conn.last_tested_at)}</span>}
                      </div>
                      {conn.last_error && <p className="text-xs text-red-400 mt-1">{conn.last_error}</p>}
                      {conn.disabled_reason && <p className="text-xs text-foreground-500 mt-1">Disabled: {conn.disabled_reason}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => { setEditingConnector(conn); setConnectorModal(true); }}
                        className="w-8 h-8 flex items-center justify-center text-foreground-400 hover:text-foreground-100 hover:bg-background-200/60 rounded-lg transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <i className="ri-pencil-line text-sm w-4 h-4 flex items-center justify-center"></i>
                      </button>
                      <button
                        onClick={() => markRotation(conn)}
                        className="w-8 h-8 flex items-center justify-center text-foreground-400 hover:text-amber-400 hover:bg-background-200/60 rounded-lg transition-colors cursor-pointer"
                        title={conn.needs_rotation ? 'Mark rotated' : 'Mark needs rotation'}
                      >
                        <i className="ri-refresh-line text-sm w-4 h-4 flex items-center justify-center"></i>
                      </button>
                      {!conn.disabled && (
                        <button
                          onClick={() => { setDisableTarget(conn); setDisableReason(''); setDisableError(''); }}
                          className="w-8 h-8 flex items-center justify-center text-foreground-400 hover:text-red-400 hover:bg-background-200/60 rounded-lg transition-colors cursor-pointer"
                          title="Disable connector"
                        >
                          <i className="ri-stop-circle-line text-sm w-4 h-4 flex items-center justify-center"></i>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* n8n workflow status */}
      <div>
        <h3 className="text-sm font-semibold text-foreground-100 mb-2">n8n workflow status</h3>
        <div className="bg-background-100 border border-background-200/60 rounded-lg divide-y divide-background-200/40">
          {N8N_WORKFLOWS.map((w) => {
            const configured = n8n?.[w.key] === 'configured';
            return (
              <div key={w.key} className="flex items-center justify-between px-4 py-2.5">
                <span className="flex items-center gap-2 text-sm text-foreground-300">
                  <i className={`${w.icon} text-base w-4 h-4 flex items-center justify-center text-foreground-500`}></i>
                  {w.label}
                </span>
                <span className={`text-xs font-label px-2 py-0.5 rounded uppercase whitespace-nowrap ${configured ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                  {configured ? 'Configured' : 'Not Configured'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Test history */}
      <div>
        <h3 className="text-sm font-semibold text-foreground-100 mb-2">Connection test history</h3>
        {tests.length === 0 ? (
          <div className="bg-background-100 border border-background-200/60 rounded-lg p-6 text-center">
            <p className="text-sm text-foreground-400">No tests run yet.</p>
          </div>
        ) : (
          <div className="bg-background-100 border border-background-200/60 rounded-lg divide-y divide-background-200/40">
            {tests.slice(0, 10).map((t) => {
              const capLabel = CAPABILITIES.find((c) => c.key === t.capability)?.label ?? t.capability;
              const tone = t.status === 'pass' ? 'text-emerald-400' : t.status === 'not_configured' ? 'text-foreground-500' : 'text-red-400';
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <span className="text-sm text-foreground-200">{capLabel}</span>
                    {t.safe_error && <p className="text-xs text-foreground-500 truncate">{t.safe_error}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-foreground-600 whitespace-nowrap">{formatRelative(t.completed_at ?? t.started_at)}</span>
                    <span className={`text-[10px] font-label px-2 py-0.5 rounded uppercase whitespace-nowrap ${tone === 'text-emerald-400' ? 'bg-emerald-500/15 text-emerald-400' : t.status === 'not_configured' ? 'bg-foreground-600/15 text-foreground-500' : 'bg-red-500/15 text-red-400'}`}>
                      {t.status === 'not_configured' ? 'Not configured' : t.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <ConnectorFormModal
        open={connectorModal}
        onClose={() => setConnectorModal(false)}
        siteId={site.id}
        initial={editingConnector}
        onSaved={reload}
      />

      <ConfirmDialog
        open={!!disableTarget}
        onClose={() => { setDisableTarget(null); setDisableReason(''); setDisableError(''); }}
        title="Disable connector"
        message="Disabling a connector stops new privileged diagnostics, repairs and sessions for it. Existing tickets and history remain readable."
        confirmLabel="Disable connector"
        confirmVariant="danger"
        onConfirm={confirmDisable}
        loading={busy}
      >
        <div className="mt-3">
          <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="disable-reason">Reason (required)</label>
          <input
            id="disable-reason"
            value={disableReason}
            onChange={(e) => setDisableReason(e.target.value)}
            className="w-full text-sm bg-background-50 border border-background-300/60 rounded-md px-3 py-2 text-foreground-100 focus:outline-none focus:ring-2 focus:ring-accent-500/40"
            placeholder="e.g. credential revoked"
          />
          {disableError && <p className="text-xs text-red-400 mt-1">{disableError}</p>}
        </div>
      </ConfirmDialog>
    </div>
  );
}