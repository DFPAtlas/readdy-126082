import { useState, type FormEvent } from 'react';
import Modal from '@/components/base/Modal';
import type { AutomationType, RunPriority, RiskLevel, Environment } from '@/pages/ai-operations/types';
import {
  AUTOMATION_TYPE_OPTIONS,
  AUTOMATION_TYPE_LABELS,
  ENVIRONMENT_OPTIONS,
  ENVIRONMENT_LABELS,
  RUN_PRIORITY_OPTIONS,
  RUN_PRIORITY,
  RISK_LEVEL,
} from '@/pages/ai-operations/constants';
import { demoSites } from '@/mocks/ai-operations-sites';
import { demoAgents } from '@/mocks/ai-operations-agents';
import { allNotificationRules } from '@/pages/ai-operations/notifications/selectors';
import type { ScheduleFormInput } from '@/pages/ai-operations/schedules/SchedulesContext';

interface ScheduleFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: ScheduleFormInput) => Promise<{ error: string | null }>;
}

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors cursor-pointer';

const labelCls = 'block text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1.5';

export default function ScheduleFormModal({ open, onClose, onSave }: ScheduleFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [siteId, setSiteId] = useState('group');
  const [agentId, setAgentId] = useState('');
  const [automationType, setAutomationType] = useState<AutomationType>('scheduled');
  const [environment, setEnvironment] = useState<Environment>('production');
  const [frequency, setFrequency] = useState('Daily at 08:00');
  const [priority, setPriority] = useState<RunPriority>('normal');
  const [risk, setRisk] = useState<RiskLevel>('low');
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [notificationRuleId, setNotificationRuleId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<string | null>(null);

  const triggerType = automationType === 'event_triggered' ? 'event' : automationType === 'condition_triggered' ? 'condition' : automationType === 'recurring' ? 'recurrence' : 'time';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setSuccessKey(null);

    const scheduleKey = `SCH-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const input: ScheduleFormInput = {
      schedule_key: scheduleKey,
      name: name.trim(),
      description: description.trim() || null,
      automation_type: automationType,
      trigger_type: triggerType,
      site_id: siteId,
      agent_id: agentId || null,
      notification_rule_id: notificationRuleId || null,
      schedule_expression: frequency,
      recurrence_summary: frequency,
      timezone: 'Europe/London',
      environment,
      status: 'draft',
      risk_level: risk,
      priority,
      approval_required: approvalRequired,
      audit_required: true,
      owner_team: 'AI Operations',
      notes: notes.trim() || null,
    };

    const result = await onSave(input);
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setSuccessKey(scheduleKey);
    // Reset fields but keep the success banner visible.
    setName('');
    setDescription('');
    setAgentId('');
    setFrequency('Daily at 08:00');
    setNotificationRuleId('');
    setNotes('');
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Schedule" className="max-w-2xl">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {formError && (
          <div className="bg-red-500/10 border border-red-500/25 rounded-md p-3">
            <p className="text-[11px] font-label text-red-300 leading-relaxed">{formError}</p>
          </div>
        )}
        {successKey && (
          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-md p-3">
            <p className="text-[11px] font-label text-emerald-300 leading-relaxed">
              Schedule saved ({successKey}) — execution runtime is not connected.
            </p>
          </div>
        )}

        <div>
          <label className={labelCls}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} placeholder="e.g. Nightly data-health check" />
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} className={inputCls} placeholder="What does this schedule do?" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Site / scope</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={inputCls}>
              <option value="group">Group-wide</option>
              {demoSites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Agent</label>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={inputCls}>
              <option value="">Select agent…</option>
              {demoAgents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Automation type</label>
            <select value={automationType} onChange={(e) => setAutomationType(e.target.value as AutomationType)} className={inputCls}>
              {AUTOMATION_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{AUTOMATION_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Environment</label>
            <select value={environment} onChange={(e) => setEnvironment(e.target.value as Environment)} className={inputCls}>
              {ENVIRONMENT_OPTIONS.map((env) => (
                <option key={env} value={env}>{ENVIRONMENT_LABELS[env]}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Schedule expression</label>
          <input value={frequency} onChange={(e) => setFrequency(e.target.value)} className={inputCls} placeholder="e.g. Daily at 08:00" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as RunPriority)} className={inputCls}>
              {RUN_PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{RUN_PRIORITY[p].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Risk</label>
            <select value={risk} onChange={(e) => setRisk(e.target.value as RiskLevel)} className={inputCls}>
              {(Object.keys(RISK_LEVEL) as RiskLevel[]).map((r) => (
                <option key={r} value={r}>{RISK_LEVEL[r].label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Notification rule (optional)</label>
          <select value={notificationRuleId} onChange={(e) => setNotificationRuleId(e.target.value)} className={inputCls}>
            <option value="">None</option>
            {allNotificationRules.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground-200 cursor-pointer">
          <input type="checkbox" checked={approvalRequired} onChange={(e) => setApprovalRequired(e.target.checked)} className="accent-accent-500 cursor-pointer" />
          Approval required before execution
        </label>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className={inputCls} placeholder="Optional notes" />
        </div>

        <div className="bg-amber-500/10 border border-amber-500/25 rounded-md p-3">
          <p className="text-[11px] font-label text-amber-300 leading-relaxed">
            Schedules are not connected to production execution. Saving records configuration metadata only — no cron job, agent trigger, run or production action occurs.
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
            disabled={saving}
            className="inline-flex items-center gap-1.5 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save Schedule'}
          </button>
        </div>
      </form>
    </Modal>
  );
}