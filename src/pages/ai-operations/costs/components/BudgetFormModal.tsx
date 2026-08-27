import { useState, type FormEvent } from 'react';
import Modal from '@/components/base/Modal';
import type { AiBudget, BudgetScope } from '@/pages/ai-operations/types';
import {
  BUDGET_SCOPE_OPTIONS,
  BUDGET_SCOPE_LABELS,
  ENVIRONMENT_OPTIONS,
  ENVIRONMENT_LABELS,
} from '@/pages/ai-operations/constants';

interface BudgetFormModalProps {
  open: boolean;
  onClose: () => void;
  budget: AiBudget | null;
  onSave: (budget: AiBudget) => void;
}

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';

const labelCls = 'block text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1.5';

const SITES = [
  { id: 'digital-footprint', label: 'Digital Footprint' },
  { id: 'quickguard', label: 'QuickGuard' },
  { id: 'guardianhub', label: 'GuardianHub' },
  { id: 'lethub', label: 'LetHub' },
  { id: 'wedora', label: 'Wedora' },
  { id: 'the-forge', label: 'The Forge' },
];

const AGENTS = [
  { id: 'tf-code', label: 'Code Agent' },
  { id: 'core-orchestrator', label: 'DFP Group Master Orchestrator' },
  { id: 'core-diagnostics', label: 'Diagnostics Agent' },
  { id: 'qg-match', label: 'Guard Matching Agent' },
];

const MODELS = [
  { id: 'MOD-CLAUDE-SONNET', label: 'Claude Sonnet' },
  { id: 'MOD-GPT4O', label: 'GPT-4o' },
  { id: 'MOD-CLAUDE-HAIKU', label: 'Claude Haiku' },
  { id: 'MOD-LLAMA-70B', label: 'Llama 3.1 70B' },
];

const PROVIDERS = [
  { id: 'PROV-ANTHROPIC', label: 'Anthropic' },
  { id: 'PROV-OPENAI', label: 'OpenAI' },
  { id: 'PROV-OLLAMA', label: 'Local Ollama' },
];

function targetsFor(scope: BudgetScope) {
  if (scope === 'site') return SITES;
  if (scope === 'agent') return AGENTS;
  if (scope === 'model') return MODELS;
  if (scope === 'provider') return PROVIDERS;
  return [];
}

export default function BudgetFormModal({ open, onClose, budget, onSave }: BudgetFormModalProps) {
  const [name, setName] = useState(budget?.name ?? '');
  const [scope, setScope] = useState<BudgetScope>(budget?.scope ?? 'site');
  const [scopeId, setScopeId] = useState(budget?.scopeId ?? '');
  const [dailyLimit, setDailyLimit] = useState(budget?.dailyLimit ?? '');
  const [monthlyLimit, setMonthlyLimit] = useState(budget?.monthlyLimit ?? '');
  const [warningThreshold, setWarningThreshold] = useState(budget?.warningThreshold ?? 70);
  const [criticalThreshold, setCriticalThreshold] = useState(budget?.criticalThreshold ?? 90);
  const [ownerTeam, setOwnerTeam] = useState(budget?.ownerTeam ?? '');
  const [environment, setEnvironment] = useState(budget?.environment ?? 'production');
  const [reviewDate, setReviewDate] = useState(budget?.reviewDate ?? '2026-09-01');
  const [notes, setNotes] = useState(budget?.notes ?? '');

  const targets = targetsFor(scope);

  const handleScopeChange = (next: BudgetScope) => {
    setScope(next);
    setScopeId('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const target = targets.find((t) => t.id === scopeId);
    const id = budget?.id ?? `BUD-${Date.now().toString(36).toUpperCase()}`;

    const record: AiBudget = {
      id,
      name: name.trim(),
      scope,
      scopeId: scope === 'group' || scope === 'environment' ? null : scopeId || null,
      scopeLabel: scope === 'group' ? 'Group-wide' : scope === 'environment' ? environment : target?.label ?? '—',
      monthlyLimit: monthlyLimit.trim() || '£0.00',
      dailyLimit: dailyLimit.trim() || '£0.00',
      warningThreshold,
      criticalThreshold,
      currentSpend: '£0.00',
      forecast: '£0.00',
      remaining: monthlyLimit.trim() || '£0.00',
      status: 'not_configured',
      ownerTeam: ownerTeam.trim() || 'Group AI Operations',
      environment,
      startDate: '2026-08-25',
      reviewDate: reviewDate || '2026-09-01',
      notes: notes.trim(),
    };

    onSave(record);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={budget ? 'Edit Budget' : 'Add Budget'} className="max-w-xl">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div>
          <label className={labelCls}>Budget name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} placeholder="e.g. QuickGuard AI budget" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Scope</label>
            <select value={scope} onChange={(e) => handleScopeChange(e.target.value as BudgetScope)} className={inputCls}>
              {BUDGET_SCOPE_OPTIONS.map((s) => (
                <option key={s} value={s}>{BUDGET_SCOPE_LABELS[s]}</option>
              ))}
            </select>
          </div>
          {targets.length > 0 ? (
            <div>
              <label className={labelCls}>Target</label>
              <select value={scopeId} onChange={(e) => setScopeId(e.target.value)} required className={inputCls}>
                <option value="">Select…</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className={labelCls}>Environment</label>
              <select value={environment} onChange={(e) => setEnvironment(e.target.value as AiBudget['environment'])} className={inputCls}>
                {ENVIRONMENT_OPTIONS.map((env) => (
                  <option key={env} value={env}>{ENVIRONMENT_LABELS[env]}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Monthly limit</label>
            <input value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} required placeholder="£100.00" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Daily limit</label>
            <input value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} placeholder="£4.00" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Warning threshold (%)</label>
            <input type="number" min={1} max={99} value={warningThreshold} onChange={(e) => setWarningThreshold(Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Critical threshold (%)</label>
            <input type="number" min={1} max={100} value={criticalThreshold} onChange={(e) => setCriticalThreshold(Number(e.target.value))} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Owner / team</label>
            <input value={ownerTeam} onChange={(e) => setOwnerTeam(e.target.value)} className={inputCls} placeholder="e.g. Group AI Operations" />
          </div>
          <div>
            <label className={labelCls}>Review date</label>
            <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} className={inputCls} placeholder="Optional notes (no financial credentials)" />
        </div>

        <div className="bg-amber-500/10 border border-amber-500/25 rounded-md p-3">
          <p className="text-[11px] font-label text-amber-300 leading-relaxed">
            Budgets are stored locally as demo metadata only — no spend limit is enforced and no real billing system is touched.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-50 border border-background-300/60 rounded-md px-3 py-2 hover:text-foreground-100 hover:border-background-400/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            Save Budget
          </button>
        </div>
      </form>
    </Modal>
  );
}