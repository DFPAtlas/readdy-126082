import { useState, type FormEvent } from 'react';
import Modal from '@/components/base/Modal';
import type { NotificationRule, Severity, NotificationChannel } from '@/pages/ai-operations/types';
import {
  ENVIRONMENT_OPTIONS,
  ENVIRONMENT_LABELS,
  SEVERITY,
  NOTIFICATION_PRIORITY_OPTIONS,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_CHANNEL_OPTIONS,
  NOTIFICATION_CHANNEL_LABELS,
} from '@/pages/ai-operations/constants';
import { demoSites } from '@/mocks/ai-operations-sites';
import { useNotifications } from '@/pages/ai-operations/notifications/NotificationsContext';

interface RuleFormModalProps {
  open: boolean;
  onClose: () => void;
  rule: NotificationRule | null;
}

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';

const labelCls = 'block text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1.5';

const SEVERITY_OPTIONS = ['info', 'low', 'medium', 'high', 'critical'] as const;

const EVENT_TYPE_OPTIONS = [
  'site_health',
  'agent_failure',
  'run_failure',
  'orchestration_blocked',
  'tool_connection',
  'model_provider',
  'model_failure',
  'security',
  'policy_violation',
  'action_blocked',
  'approval_expiring',
  'uat_failure',
  'budget_alert',
  'repeating_incident',
  'sla_breach',
  'integration',
  'other',
];

export default function RuleFormModal({ open, onClose, rule }: RuleFormModalProps) {
  const { createRule, updateRule } = useNotifications();
  const [ruleKey, setRuleKey] = useState(rule?.id ?? '');
  const [name, setName] = useState(rule?.name ?? '');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [eventType, setEventType] = useState(rule?.eventType ?? 'site_health');
  const [scope, setScope] = useState<'group' | 'site'>(rule?.siteId === 'group' ? 'group' : 'site');
  const [siteId, setSiteId] = useState(rule && rule.siteId !== 'group' ? (rule.siteId ?? '') : '');
  const [environment, setEnvironment] = useState(rule?.environment ?? 'production');
  const [severity, setSeverity] = useState<Severity>(rule?.severityThreshold ?? 'high');
  const [priority, setPriority] = useState(rule?.priority ?? 'high');
  const [channels, setChannels] = useState<NotificationChannel[]>(rule?.channels ?? ['dfp_command']);
  const [recipient, setRecipient] = useState(rule?.initialTeam ?? '');
  const [ackRequired, setAckRequired] = useState(rule?.acknowledgementRequired ?? true);
  const [ownerTeam, setOwnerTeam] = useState(rule?.ownerTeam ?? '');
  const [auditRequired, setAuditRequired] = useState(rule?.auditRequired ?? false);
  const [notes, setNotes] = useState(rule?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleChannel = (c: NotificationChannel) => {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      rule_key: ruleKey.trim(),
      name: name.trim(),
      description: description.trim() || null,
      event_type: eventType,
      scope,
      site_id: scope === 'group' ? null : siteId || null,
      environment,
      severity_minimum: severity,
      priority_minimum: priority,
      channels,
      recipient_reference: recipient.trim() || '—',
      acknowledgement_required: ackRequired,
      owner_team: ownerTeam.trim() || null,
      audit_required: auditRequired,
      notes: notes.trim() || null,
    };

    const result = rule ? await updateRule(rule.id, payload) : await createRule(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={rule ? 'Edit Notification Rule' : 'New Notification Rule'} className="max-w-xl">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Rule Key</label>
            <input
              value={ruleKey}
              onChange={(e) => setRuleKey(e.target.value)}
              required
              disabled={Boolean(rule)}
              className={inputCls}
              placeholder="e.g. NOT-1025"
            />
          </div>
          <div>
            <label className={labelCls}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} placeholder="e.g. New Site Outage" />
          </div>
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} className={inputCls} placeholder="Short description of what this rule routes" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Event Type</label>
            <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={inputCls}>
              {EVENT_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Scope</label>
            <select value={scope} onChange={(e) => setScope(e.target.value as 'group' | 'site')} className={inputCls}>
              <option value="group">Group-wide</option>
              <option value="site">Site-specific</option>
            </select>
          </div>
        </div>

        {scope === 'site' && (
          <div>
            <label className={labelCls}>Site</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={inputCls}>
              <option value="">Select a site…</option>
              {demoSites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Environment</label>
            <select value={environment} onChange={(e) => setEnvironment(e.target.value)} className={inputCls}>
              {ENVIRONMENT_OPTIONS.map((env) => (
                <option key={env} value={env}>{ENVIRONMENT_LABELS[env]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Severity Minimum</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className={inputCls}>
              {SEVERITY_OPTIONS.map((s) => (
                <option key={s} value={s}>{SEVERITY[s].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
              {NOTIFICATION_PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{NOTIFICATION_PRIORITY[p].label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Channels</label>
          <div className="flex flex-wrap gap-2">
            {NOTIFICATION_CHANNEL_OPTIONS.map((c) => {
              const active = channels.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleChannel(c)}
                  className={`text-[11px] font-label rounded-md px-2.5 py-1.5 border transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-accent-500/10 border-accent-500/40 text-accent-300'
                      : 'bg-background-50 border-background-300/60 text-foreground-500 hover:border-background-400/60'
                  }`}
                >
                  {NOTIFICATION_CHANNEL_LABELS[c]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Recipient / Team</label>
            <input value={recipient} onChange={(e) => setRecipient(e.target.value)} required className={inputCls} placeholder="e.g. Security Team" />
          </div>
          <div>
            <label className={labelCls}>Owner / Team</label>
            <input value={ownerTeam} onChange={(e) => setOwnerTeam(e.target.value)} className={inputCls} placeholder="e.g. Group AI Operations" />
          </div>
        </div>

        <div className="flex items-center gap-6 flex-wrap">
          <label className="inline-flex items-center gap-2 text-sm text-foreground-300 cursor-pointer">
            <input type="checkbox" checked={ackRequired} onChange={(e) => setAckRequired(e.target.checked)} className="accent-accent-500" />
            Acknowledgement required
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-foreground-300 cursor-pointer">
            <input type="checkbox" checked={auditRequired} onChange={(e) => setAuditRequired(e.target.checked)} className="accent-accent-500" />
            Audit required
          </label>
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className={inputCls} placeholder="Optional notes (no credentials or private contact details)" />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/25 rounded-md p-3">
            <p className="text-[11px] font-label text-red-300 leading-relaxed">{error}</p>
          </div>
        )}

        <div className="bg-amber-500/10 border border-amber-500/25 rounded-md p-3">
          <p className="text-[11px] font-label text-amber-300 leading-relaxed">
            Saving a rule stores configuration metadata only — no message is sent and no delivery occurs.
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
            className="inline-flex items-center gap-1.5 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            {saving ? 'Saving…' : rule ? 'Save Changes' : 'Create Rule'}
          </button>
        </div>
      </form>
    </Modal>
  );
}