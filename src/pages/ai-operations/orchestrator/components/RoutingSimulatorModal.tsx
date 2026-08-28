import { useEffect, useState } from 'react';
import Modal from '@/components/base/Modal';
import type { AgentCandidate, AgentHealth, RoutingSimulationResult } from '@/pages/ai-operations/types';
import { demoAgents } from '@/mocks/ai-operations-agents';
import { demoSites } from '@/mocks/ai-operations-sites';
import { ENVIRONMENT_OPTIONS, ENVIRONMENT_LABELS, RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import { useGroupLiveData, type GroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import type { SimulationCandidateInput } from '@/pages/ai-operations/orchestrator/OrchestratorContext';

interface RoutingSimulatorModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'live' | 'demo' | 'error';
  onSave: (result: SimulatorOutcome, form: SimulatorForm) => void;
}

export interface SimulatorForm {
  title: string;
  description: string;
  source: string;
  site: string;
  taskType: string;
  environment: string;
  priority: string;
  risk: string;
}

export interface SimulatorOutcome extends RoutingSimulationResult {
  blockedCandidates: AgentCandidate[];
  missingDependencies: string[];
  policyResult: string;
  candidateInputs: SimulationCandidateInput[];
  workflowSteps: string[];
  checks: { toolReady: boolean; modelReady: boolean; knowledgeReady: boolean };
}

const empty: SimulatorForm = {
  title: '',
  description: '',
  source: 'User',
  site: '',
  taskType: '',
  environment: 'production',
  priority: 'normal',
  risk: 'low',
};

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';

const SOURCES = ['User', 'Agent', 'Scheduled', 'Event', 'Support Ticket', 'Monitoring Alert', 'API', 'n8n', 'System'];
const TASK_TYPES = ['Support', 'Diagnostics', 'Monitoring', 'Security', 'UAT', 'Repair', 'Data Health', 'Billing', 'Lead Processing', 'Compliance', 'Matching', 'Workflow', 'Reporting', 'Deployment'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent', 'critical'];
const RISKS = ['low', 'medium', 'high', 'critical'];

const RISK_PENALTY: Record<string, number> = { low: 0, medium: 5, high: 10, critical: 15 };

function reasonFor(active: boolean, toolReady: boolean, modelReady: boolean, knowledgeReady: boolean, policyBlocked: boolean, policyReason: string): string {
  if (!active) return 'Not active / disabled / paused';
  if (policyBlocked) return `Policy blocked — ${policyReason}`;
  if (!toolReady) return 'BLOCKED — Tool access not registered';
  if (!modelReady) return 'BLOCKED — Model assignment missing';
  if (!knowledgeReady) return 'BLOCKED — Knowledge access missing';
  return 'Registry eligible (planning only)';
}

// Deterministic, registry-only candidate evaluation. Never fabricates runtime
// availability; capacity is always "unknown" (runtime is not connected).
function simulateLive(form: SimulatorForm, data: GroupLiveData): SimulatorOutcome {
  const siteKey = form.site || 'group';
  const siteRow = siteKey === 'group' ? undefined : data.sites.find((s) => s.site_key === siteKey);
  const siteUuid = siteRow?.id ?? null;
  const siteName = siteRow?.name ?? 'Group-wide';

  const toolAccessActive = new Set(data.toolAccess.filter((t) => t.is_active !== false).map((t) => t.agent_id));
  const modelAssignActive = new Set(data.modelAssignments.filter((m) => m.is_active !== false).map((m) => m.agent_id));
  const knowledgeActive = new Set(data.knowledgePermissions.filter((k) => k.is_active !== false).map((k) => k.agent_id));
  const activePolicies = data.policies.filter((p) => p.is_active !== false);

  const candidates: AgentCandidate[] = [];
  const blocked: AgentCandidate[] = [];
  const candidateInputs: SimulationCandidateInput[] = [];

  let rank = 0;

  for (const agent of data.agents) {
    const inScope =
      siteKey === 'group'
        ? agent.site_id == null
        : agent.site_id == null || agent.site_id === siteUuid;
    if (!inScope) continue;

    const uuid = agent.id;
    const active = agent.is_active !== false && agent.status !== 'disabled' && agent.status !== 'paused';
    const toolReady = toolAccessActive.has(uuid);
    const modelReady = modelAssignActive.has(uuid);
    const knowledgeReady = knowledgeActive.has(uuid);

    let policyResult = 'allow';
    let policyReason = '';
    for (const p of activePolicies) {
      const appliesSite = p.site_id == null || p.site_id === siteUuid;
      const appliesAgent = p.agent_id == null || p.agent_id === uuid;
      if (!appliesSite || !appliesAgent) continue;
      if (p.effect === 'deny') { policyResult = 'deny'; policyReason = p.name; break; }
      if (p.effect === 'restrict') { policyResult = 'restrict'; policyReason = p.name; }
      if (p.effect === 'require_approval' && policyResult !== 'restrict') policyResult = 'require_approval';
    }
    const policyBlocked = policyResult === 'deny' || policyResult === 'restrict';

    const riskPenalty = RISK_PENALTY[agent.risk_level ?? 'low'] ?? 0;
    const score = Math.max(0, Math.min(100,
      50 + (inScope ? 15 : 0) + (toolReady ? 10 : 0) + (modelReady ? 10 : 0) + (knowledgeReady ? 5 : 0) + (policyBlocked ? 0 : 10) - riskPenalty,
    ));

    const eligible = active && toolReady && modelReady && knowledgeReady && !policyBlocked;

    const candidate: AgentCandidate = {
      agentId: agent.agent_key,
      agentName: agent.name,
      eligibility: eligible ? 'Eligible' : 'Blocked',
      score,
      health: (agent.health as AgentHealth) ?? 'unknown',
      capacity: 'unknown',
      capabilityMatch: `${score}%`,
      permissionMatch: toolReady && modelReady && knowledgeReady ? 'Full' : 'Partial',
      reason: reasonFor(active, toolReady, modelReady, knowledgeReady, policyBlocked, policyReason),
      selected: false,
    };

    candidateInputs.push({
      agentKey: agent.agent_key,
      rank: rank + 1,
      score,
      eligible,
      rejectionReason: eligible ? null : candidate.reason,
      selectionReason: eligible ? 'Registry eligible (planning only)' : null,
    });

    if (eligible) {
      rank += 1;
      candidates.push(candidate);
    } else {
      blocked.push(candidate);
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const recommended = candidates[0] ?? null;

  const checks = recommended
    ? {
        toolReady: toolAccessActive.has(data.agents.find((a) => a.agent_key === recommended.agentId)?.id ?? ''),
        modelReady: modelAssignActive.has(data.agents.find((a) => a.agent_key === recommended.agentId)?.id ?? ''),
        knowledgeReady: knowledgeActive.has(data.agents.find((a) => a.agent_key === recommended.agentId)?.id ?? ''),
      }
    : { toolReady: false, modelReady: false, knowledgeReady: false };

  const missingDependencies: string[] = [];
  if (recommended) {
    if (!checks.toolReady) missingDependencies.push('Tool access not registered');
    if (!checks.modelReady) missingDependencies.push('Model assignment missing');
    if (!checks.knowledgeReady) missingDependencies.push('Knowledge access missing');
  }

  const approvalRequired =
    form.risk === 'high' || form.risk === 'critical' || form.priority === 'urgent' || form.priority === 'critical';

  const workflow = approvalRequired
    ? ['Classify', 'Resolve Site', 'Select Agent', 'Check Permissions', 'Human Approval', 'Execute', 'Verify', 'Complete']
    : ['Classify', 'Resolve Site', 'Select Agent', 'Check Permissions', 'Execute', 'Verify', 'Complete'];

  return {
    detectedSite: siteName,
    recommendedAgentId: recommended?.agentId ?? '',
    recommendedAgentName: recommended?.agentName ?? 'No eligible agent',
    candidates: candidates.slice(0, 5),
    blockedCandidates: blocked,
    missingDependencies,
    policyResult: recommended ? 'allow' : 'no_eligible',
    approvalRequired,
    workflow,
    tools: [],
    estimatedCost: '—',
    candidateInputs,
    workflowSteps: workflow,
    checks,
  };
}

// Demo-mode fallback (explicit demo only) — mirrors the previous behaviour.
function simulateDemo(form: SimulatorForm): SimulatorOutcome {
  const siteId = form.site || 'group';
  const siteName = form.site ? (demoSites.find((s) => s.id === form.site)?.name ?? 'Group-wide') : 'Group-wide';

  const pool =
    siteId === 'group'
      ? demoAgents.filter((a) => a.assignedSite === null)
      : demoAgents.filter((a) => a.assignedSite === siteId || a.assignedSite === null);

  const pick = pool.slice(0, 3);
  const recommended = pick[0] ?? demoAgents[0];

  const candidates: AgentCandidate[] = pick.map((a, i) => ({
    agentId: a.id,
    agentName: a.name,
    eligibility: 'Eligible',
    score: 95 - i * 8,
    health: a.health,
    capacity: a.queueCount >= 4 ? 'at_capacity' : a.queueCount >= 2 ? 'high_load' : 'available',
    capabilityMatch: `${90 - i * 5}%`,
    permissionMatch: 'Full',
    reason: i === 0 ? 'best match' : i === 1 ? 'fallback' : 'secondary scope',
    selected: i === 0,
  }));

  const approvalRequired = form.risk === 'high' || form.risk === 'critical' || form.priority === 'urgent' || form.priority === 'critical';

  const workflow = approvalRequired
    ? ['Classify', 'Select Agent', 'Check Permissions', 'Human Approval', 'Execute', 'Verify', 'Complete']
    : ['Classify', 'Select Agent', 'Check Permissions', 'Execute', 'Verify', 'Complete'];

  return {
    detectedSite: siteName,
    recommendedAgentId: recommended.id,
    recommendedAgentName: recommended.name,
    candidates,
    blockedCandidates: [],
    missingDependencies: [],
    policyResult: 'allow',
    approvalRequired,
    workflow,
    tools: ['Supabase', 'n8n', 'Monitoring'],
    estimatedCost: form.priority === 'urgent' || form.priority === 'critical' ? '£0.10' : form.priority === 'high' ? '£0.06' : '£0.02',
    candidateInputs: candidates.map((c, i) => ({ agentKey: c.agentId, rank: i + 1, score: c.score, eligible: true, rejectionReason: null, selectionReason: c.reason })),
    workflowSteps: workflow,
    checks: { toolReady: true, modelReady: true, knowledgeReady: true },
  };
}

export default function RoutingSimulatorModal({ open, onClose, mode, onSave }: RoutingSimulatorModalProps) {
  const data = useGroupLiveData();
  const [form, setForm] = useState<SimulatorForm>(empty);
  const [preview, setPreview] = useState<SimulatorOutcome | null>(null);

  useEffect(() => {
    if (open) {
      setForm(empty);
      setPreview(null);
    }
  }, [open]);

  const set = (patch: Partial<SimulatorForm>) => setForm((f) => ({ ...f, ...patch }));

  const live = mode === 'live';

  const siteOptions = live
    ? data.sites.map((s) => ({ key: s.site_key, name: s.name }))
    : demoSites.map((s) => ({ key: s.id, name: s.name }));

  const handlePreview = () => {
    if (live) setPreview(simulateLive(form, data));
    else setPreview(simulateDemo(form));
  };

  const handleSave = () => {
    if (!preview) return;
    onSave(preview, form);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Simulate Routing" className="max-w-2xl">
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Request title</label>
          <input type="text" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Diagnose a support incident" className={inputCls} />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={2} maxLength={500} placeholder="What should the request do..." className={`${inputCls} resize-y`} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Source</label>
            <select value={form.source} onChange={(e) => set({ source: e.target.value })} className={`${inputCls} cursor-pointer`}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Site (if known)</label>
            <select value={form.site} onChange={(e) => set({ site: e.target.value })} className={`${inputCls} cursor-pointer`}>
              <option value="">Auto-detect / Group-wide</option>
              {siteOptions.map((s) => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Task type (if known)</label>
            <select value={form.taskType} onChange={(e) => set({ taskType: e.target.value })} className={`${inputCls} cursor-pointer`}>
              <option value="">Auto-detect</option>
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Environment</label>
            <select value={form.environment} onChange={(e) => set({ environment: e.target.value })} className={`${inputCls} cursor-pointer`}>
              {ENVIRONMENT_OPTIONS.map((e) => (
                <option key={e} value={e}>{ENVIRONMENT_LABELS[e]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Priority</label>
            <select value={form.priority} onChange={(e) => set({ priority: e.target.value })} className={`${inputCls} cursor-pointer`}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Risk</label>
            <select value={form.risk} onChange={(e) => set({ risk: e.target.value })} className={`${inputCls} cursor-pointer`}>
              {RISKS.map((r) => (
                <option key={r} value={r}>{RISK_LEVEL[r as 'low' | 'medium' | 'high' | 'critical'].label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
          <p className="text-[11px] font-label text-foreground-600 max-w-[320px]">
            Simulation / planning only — execution runtime is disabled. No agent, tool, model or n8n execution occurs.
          </p>
          <button
            type="button"
            onClick={handlePreview}
            className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            Preview Routing
          </button>
        </div>

        {preview && (
          <div className="bg-background-50 border border-background-200/60 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h4 className="text-sm font-heading font-semibold text-foreground-50">Routing Preview</h4>
              <span className="text-[11px] font-label text-foreground-600">{live ? 'Live registry eligibility' : '⚠️ Demo preview only'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Detected site</p>
                <p className="text-foreground-100 mt-0.5">{preview.detectedSite}</p>
              </div>
              <div>
                <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Recommended agent</p>
                <p className="text-foreground-100 mt-0.5">{preview.recommendedAgentName}</p>
              </div>
              <div>
                <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Approval required</p>
                <div className="mt-1">
                  {preview.approvalRequired ? (
                    <StatusPill tone="amber" label="Yes" />
                  ) : (
                    <StatusPill tone="emerald" label="No" />
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Runtime capacity</p>
                <p className="text-foreground-100 mt-0.5">Unknown — runtime not connected</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide mb-1.5">Candidate agents</p>
              <div className="space-y-1.5">
                {preview.candidates.length === 0 && (
                  <p className="text-sm text-foreground-500">No eligible candidates in the live registry.</p>
                )}
                {preview.candidates.map((c) => (
                  <div key={c.agentId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground-300 truncate">{c.agentName}</span>
                    <span className="text-foreground-500 text-xs shrink-0">Score {c.score} · {c.reason}</span>
                  </div>
                ))}
              </div>
            </div>

            {preview.blockedCandidates.length > 0 && (
              <div>
                <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide mb-1.5">Blocked / ineligible</p>
                <div className="space-y-1">
                  {preview.blockedCandidates.map((c) => (
                    <div key={c.agentId} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-foreground-500 truncate">{c.agentName}</span>
                      <span className="text-red-400 shrink-0">{c.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preview.missingDependencies.length > 0 && (
              <div>
                <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide mb-1.5">Missing dependencies</p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.missingDependencies.map((d) => (
                    <span key={d} className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-0.5">{d}</span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide mb-1.5">Proposed workflow</p>
              <div className="flex flex-wrap gap-1.5">
                {preview.workflow.map((step, i) => (
                  <span key={`${step}-${i}`} className="inline-flex items-center gap-1.5">
                    <span className="text-xs text-foreground-300 border border-background-300/50 rounded-md px-2 py-1">{step}</span>
                    {i < preview.workflow.length - 1 && <i className="ri-arrow-right-line text-foreground-600 w-3.5 h-3.5 flex items-center justify-center"></i>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-5 py-4 border-t border-background-400/60 shrink-0">
        <p className="text-[11px] font-label text-foreground-600">No execute control — simulation only.</p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap">
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!preview}
            className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 disabled:cursor-not-allowed text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            Save Simulation
          </button>
        </div>
      </div>
    </Modal>
  );
}