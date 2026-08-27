import { useEffect, useState } from 'react';
import Modal from '@/components/base/Modal';
import type { AgentCandidate, RoutingSimulationResult } from '@/pages/ai-operations/types';
import { demoAgents } from '@/mocks/ai-operations-agents';
import { demoSites } from '@/mocks/ai-operations-sites';
import { ENVIRONMENT_OPTIONS, ENVIRONMENT_LABELS, RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

interface RoutingSimulatorModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (result: RoutingSimulationResult, form: SimulatorForm) => void;
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

function simulate(form: SimulatorForm): RoutingSimulationResult {
  const siteId = form.site || 'group';
  const siteName = form.site ? (demoSites.find((s) => s.id === form.site)?.name ?? 'Group-wide') : 'Group-wide';

  // Candidate pool: site-specific agents for the chosen site (or core agents for group).
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

  const estimatedCost =
    form.priority === 'urgent' || form.priority === 'critical' ? '£0.10' : form.priority === 'high' ? '£0.06' : '£0.02';

  return {
    detectedSite: siteName,
    recommendedAgentId: recommended.id,
    recommendedAgentName: recommended.name,
    candidates,
    approvalRequired,
    workflow,
    tools: ['Supabase', 'n8n', 'Monitoring'],
    estimatedCost,
  };
}

export default function RoutingSimulatorModal({ open, onClose, onSave }: RoutingSimulatorModalProps) {
  const [form, setForm] = useState<SimulatorForm>(empty);
  const [preview, setPreview] = useState<RoutingSimulationResult | null>(null);

  useEffect(() => {
    if (open) {
      setForm(empty);
      setPreview(null);
    }
  }, [open]);

  const set = (patch: Partial<SimulatorForm>) => setForm((f) => ({ ...f, ...patch }));

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
              {demoSites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
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
            Routing simulation does not execute agents or modify production systems.
          </p>
          <button
            type="button"
            onClick={() => setPreview(simulate(form))}
            className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            Preview Routing
          </button>
        </div>

        {preview && (
          <div className="bg-background-50 border border-background-200/60 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h4 className="text-sm font-heading font-semibold text-foreground-50">Routing Preview</h4>
              <span className="text-[11px] font-label text-foreground-600">⚠️ Demo preview only</span>
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
                <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Estimated cost</p>
                <p className="text-foreground-100 mt-0.5">{preview.estimatedCost}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide mb-1.5">Candidate agents</p>
              <div className="space-y-1.5">
                {preview.candidates.map((c) => (
                  <div key={c.agentId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground-300 truncate">{c.agentName}</span>
                    <span className="text-foreground-500 text-xs shrink-0">Score {c.score} · {c.reason}</span>
                  </div>
                ))}
              </div>
            </div>

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

            <div>
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide mb-1.5">Tools</p>
              <div className="flex flex-wrap gap-1.5">
                {preview.tools.map((t) => (
                  <span key={t} className="text-xs text-foreground-500 bg-background-100 border border-background-200/60 rounded-md px-2 py-1">{t}</span>
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