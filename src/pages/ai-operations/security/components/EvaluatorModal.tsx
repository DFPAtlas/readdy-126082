import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Modal from '@/components/base/Modal';
import type { EvaluationResult, RiskClass, Environment, PolicyEvaluation } from '@/pages/ai-operations/types';
import type { PolicyEvaluateInput } from '@/pages/ai-operations/security/selectors';
import type { SecurityDataSourceMode, SecuritySiteOption, SecurityAgentOption } from '@/pages/ai-operations/security/SecurityContext';
import { EVALUATION_RESULT, ENVIRONMENT_OPTIONS, ENVIRONMENT_LABELS, RISK_CLASS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-3 py-2 text-sm text-foreground-100 outline-none transition-colors';

const labelCls = 'block text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1.5';

const TOOLS = ['Supabase', 'n8n', 'Stripe', 'GitHub', 'Readdy', 'Email', 'None'];
const MODELS = ['Claude Sonnet', 'Claude Opus', 'GPT-4o', 'Llama 3.1 70B', 'None'];
const KNOWLEDGE = ['Security Rules', 'Support SOP', 'UAT Standards', 'Restricted (confidential)', 'None'];

interface EvaluatorModalProps {
  open: boolean;
  onClose: () => void;
  mode: SecurityDataSourceMode;
  sites: SecuritySiteOption[];
  agents: SecurityAgentOption[];
  simulate: (input: PolicyEvaluateInput) => PolicyEvaluation;
  saveEvaluation: (input: PolicyEvaluateInput, result: PolicyEvaluation, actor: string) => Promise<{ error: string | null }>;
  actor: string;
}

export default function EvaluatorModal({ open, onClose, mode, sites, agents, simulate, saveEvaluation, actor }: EvaluatorModalProps) {
  const [site, setSite] = useState('group');
  const [agent, setAgent] = useState('');
  const [environment, setEnvironment] = useState<Environment>('production');
  const [tool, setTool] = useState('Supabase');
  const [model, setModel] = useState('Claude Sonnet');
  const [knowledge, setKnowledge] = useState('None');
  const [action, setAction] = useState('');
  const [risk, setRisk] = useState<RiskClass>('amber');
  const [evaluation, setEvaluation] = useState<PolicyEvaluation | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const isLive = mode === 'live';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSaveMessage(null);
    const result = simulate({ siteKey: site, agentKey: agent, action, risk, environment, tool, model, knowledge });
    setEvaluation(result);
  };

  const handleSave = async () => {
    if (!evaluation) return;
    setSaving(true);
    setSaveMessage(null);
    const { error } = await saveEvaluation(
      { siteKey: site, agentKey: agent, action, risk, environment, tool, model, knowledge },
      evaluation,
      actor,
    );
    if (error) {
      setSaveMessage({ ok: false, text: error });
    } else {
      setSaveMessage({ ok: true, text: 'Evaluation saved as governance evidence.' });
    }
    setSaving(false);
  };

  const reset = () => {
    setEvaluation(null);
    setSaveMessage(null);
  };

  const evalResult = evaluation ? EVALUATION_RESULT[evaluation.result as EvaluationResult] : null;

  return (
    <Modal open={open} onClose={onClose} title="Evaluate Request" className="max-w-xl">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Site</label>
            <select value={site} onChange={(e) => setSite(e.target.value)} className={`${inputCls} cursor-pointer`}>
              <option value="group">Group-wide</option>
              {sites.map((s) => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Agent</label>
            <select value={agent} onChange={(e) => setAgent(e.target.value)} className={`${inputCls} cursor-pointer`}>
              <option value="">Unassigned</option>
              {agents.map((a) => (
                <option key={a.key} value={a.key}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Environment</label>
            <select value={environment} onChange={(e) => setEnvironment(e.target.value as Environment)} className={`${inputCls} cursor-pointer`}>
              {ENVIRONMENT_OPTIONS.map((env) => (
                <option key={env} value={env}>{ENVIRONMENT_LABELS[env]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Risk</label>
            <select value={risk} onChange={(e) => setRisk(e.target.value as RiskClass)} className={`${inputCls} cursor-pointer`}>
              {(['green', 'amber', 'red'] as const).map((r) => (
                <option key={r} value={r}>{RISK_CLASS[r].label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Tool</label>
            <select value={tool} onChange={(e) => setTool(e.target.value)} className={`${inputCls} cursor-pointer`}>
              {TOOLS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Model</label>
            <select value={model} onChange={(e) => setModel(e.target.value)} className={`${inputCls} cursor-pointer`}>
              {MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Knowledge source</label>
            <select value={knowledge} onChange={(e) => setKnowledge(e.target.value)} className={`${inputCls} cursor-pointer`}>
              {KNOWLEDGE.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Action</label>
          <input value={action} onChange={(e) => setAction(e.target.value)} required className={inputCls} placeholder="e.g. modify RLS, publish site, refund payment" />
        </div>

        {evalResult && evaluation && (
          <div className="bg-background-50 border border-background-200/60 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-label text-foreground-500 uppercase tracking-wide">Simulated result</span>
              <StatusPill tone={evalResult.tone} label={evalResult.label} />
            </div>

            {evaluation.matchedPolicies.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {evaluation.matchedPolicies.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 text-[11px] font-mono text-foreground-400 bg-background-100 border border-background-200/60 rounded px-2 py-0.5">
                    {p}
                  </span>
                ))}
              </div>
            )}

            {evaluation.requiredControls.length > 0 && (
              <p className="text-[11px] font-label text-foreground-600 leading-relaxed">
                Required controls: {evaluation.requiredControls.join(' · ')}
              </p>
            )}

            {evaluation.result === 'require_approval' && (
              <Link
                to="/ai-operations/approvals"
                className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-user-star-line text-sm w-4 h-4 flex items-center justify-center"></i>
                Open Approvals
              </Link>
            )}

            <p className="text-[11px] font-label text-foreground-600 leading-relaxed">
              Policy simulation only — runtime enforcement is not connected. No agent, workflow or production action is executed.
            </p>

            <div className="flex items-center gap-2 pt-1">
              {isLive && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-200 bg-background-100 border border-background-200/60 rounded-md px-3 py-2 hover:border-background-300/60 transition-colors duration-150 cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving && <i className="ri-loader-4-line text-sm w-4 h-4 flex items-center justify-center animate-spin"></i>}
                  {saving ? 'Saving…' : 'Save Evaluation'}
                </button>
              )}
              {saveMessage && (
                <span className={`text-[11px] font-label ${saveMessage.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {saveMessage.text}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-50 border border-background-300/60 rounded-md px-3 py-2 hover:text-foreground-100 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            Reset
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            Evaluate
          </button>
        </div>
      </form>
    </Modal>
  );
}