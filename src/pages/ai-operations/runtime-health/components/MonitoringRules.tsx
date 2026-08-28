import { useState } from 'react';
import { useRuntimeHealth, saveMonitoringRule, toggleMonitoringRule } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { useAuth } from '@/components/feature/AuthGuard';
import type { AiRuntimeMonitoringRuleRow } from '@/lib/ai-operations/runtimeMonitoring';
import { SYSTEM_LABELS } from '@/pages/ai-operations/runtime-health/components/HealthHistory';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function MonitoringRules() {
  const { rules, rulesSaving } = useRuntimeHealth();
  const { role } = useAuth();
  const [editing, setEditing] = useState<AiRuntimeMonitoringRuleRow | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canEdit = role === 'owner' || role === 'admin';

  const handleToggle = (rule: AiRuntimeMonitoringRuleRow) => {
    void toggleMonitoringRule(rule.rule_key, !rule.enabled).then((res) => {
      setSaveError(res.error);
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-3 flex items-start gap-2.5">
        <i className="ri-information-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
        <p className="text-xs text-foreground-500">
          Monitoring runs server-side on a fixed allowlisted set of systems — you cannot point a rule at an arbitrary endpoint or edit credentials. Interval is constrained to a minimum of 5 minutes. Thresholds prevent alerting on a single transient failure (3 consecutive failures) and status flapping (2 consecutive healthy checks to recover).
        </p>
      </div>

      {saveError && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-3 flex items-start gap-2.5">
          <i className="ri-alert-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
          <p className="text-xs text-red-300">{saveError}</p>
        </div>
      )}

      <section className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Monitoring Rules</h3>
          <span className="text-[10px] font-label text-foreground-600">Recurring connectivity monitoring</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
                <th className="px-4 py-2.5 whitespace-nowrap">System</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Interval</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Failure Threshold</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Recovery Threshold</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Alerts</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Last Checked</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Next Check</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Status</th>
                <th className="px-4 py-2.5 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-foreground-500">
                    No monitoring rules configured.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.rule_key} className="border-b border-background-200/40 last:border-0 hover:bg-background-50/60 transition-colors">
                    <td className="px-4 py-3 text-sm text-foreground-100 whitespace-nowrap">
                      {SYSTEM_LABELS[rule.system_slug] ?? rule.system_slug}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">{rule.interval_minutes} min</td>
                    <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">{rule.failure_threshold}</td>
                    <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">{rule.recovery_threshold}</td>
                    <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">
                      {rule.create_alert_on_failure || rule.create_alert_on_recovery
                        ? `${rule.create_alert_on_failure ? 'failure' : ''}${rule.create_alert_on_failure && rule.create_alert_on_recovery ? ' / ' : ''}${rule.create_alert_on_recovery ? 'recovery' : ''}`
                        : 'none'}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">{formatTime(rule.last_checked_at)}</td>
                    <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">{formatTime(rule.next_check_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-label rounded-full px-2 py-0.5 border whitespace-nowrap ${rule.enabled ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : 'text-foreground-600 bg-background-50 border-background-200/60'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${rule.enabled ? 'bg-emerald-400' : 'bg-foreground-600'}`}></span>
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {canEdit ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setEditing(rule)}
                            disabled={rulesSaving}
                            className="inline-flex items-center gap-1 text-[11px] font-label text-foreground-300 bg-background-50 border border-background-300/60 rounded-md px-2.5 py-1.5 hover:border-background-300/80 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                          >
                            <i className="ri-settings-4-line w-3.5 h-3.5 flex items-center justify-center"></i>
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggle(rule)}
                            disabled={rulesSaving}
                            className="inline-flex items-center gap-1 text-[11px] font-label text-foreground-300 bg-background-50 border border-background-300/60 rounded-md px-2.5 py-1.5 hover:border-background-300/80 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
                          >
                            <i className={`${rule.enabled ? 'ri-pause-line' : 'ri-play-line'} w-3.5 h-3.5 flex items-center justify-center`}></i>
                            {rule.enabled ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] font-label text-foreground-600">Read-only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <RuleEditModal
          rule={editing}
          onClose={() => setEditing(null)}
          onSave={(input) =>
            saveMonitoringRule(editing.rule_key, input).then((res) => {
              if (!res.error) setEditing(null);
              return res;
            })
          }
        />
      )}
    </div>
  );
}

interface RuleEditModalProps {
  rule: AiRuntimeMonitoringRuleRow;
  onClose: () => void;
  onSave: (input: {
    interval_minutes: number;
    failure_threshold: number;
    recovery_threshold: number;
    create_alert_on_failure: boolean;
    create_alert_on_recovery: boolean;
  }) => Promise<{ error: string | null }>;
}

function RuleEditModal({ rule, onClose, onSave }: RuleEditModalProps) {
  const [interval, setInterval] = useState(rule.interval_minutes);
  const [failure, setFailure] = useState(rule.failure_threshold);
  const [recovery, setRecovery] = useState(rule.recovery_threshold);
  const [alertFailure, setAlertFailure] = useState(rule.create_alert_on_failure);
  const [alertRecovery, setAlertRecovery] = useState(rule.create_alert_on_recovery);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (interval < 5) {
      setError('Interval must be at least 5 minutes.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await onSave({
      interval_minutes: interval,
      failure_threshold: failure,
      recovery_threshold: recovery,
      create_alert_on_failure: alertFailure,
      create_alert_on_recovery: alertRecovery,
    });
    setSaving(false);
    if (res.error) setError(res.error);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative bg-background-100 border border-background-200/60 rounded-lg w-full max-w-md p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-heading font-semibold text-foreground-50">Edit Monitoring Rule</h3>
            <p className="text-xs text-foreground-500 mt-1">{SYSTEM_LABELS[rule.system_slug] ?? rule.system_slug}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-500 hover:text-foreground-100 hover:bg-background-50 transition-colors cursor-pointer" aria-label="Close">
            <i className="ri-close-line text-lg w-5 h-5 flex items-center justify-center"></i>
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Interval (minutes)" hint="Minimum 5 minutes">
            <input
              type="number"
              min={5}
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
              className="w-full bg-background-50 border border-background-300/60 rounded-md px-3 py-2 text-sm text-foreground-100 outline-none focus:border-accent-500/40 transition-colors"
            />
          </Field>

          <Field label="Failure threshold" hint="Consecutive failed checks before alert">
            <input
              type="number"
              min={1}
              value={failure}
              onChange={(e) => setFailure(Number(e.target.value))}
              className="w-full bg-background-50 border border-background-300/60 rounded-md px-3 py-2 text-sm text-foreground-100 outline-none focus:border-accent-500/40 transition-colors"
            />
          </Field>

          <Field label="Recovery threshold" hint="Consecutive healthy checks before recovery">
            <input
              type="number"
              min={1}
              value={recovery}
              onChange={(e) => setRecovery(Number(e.target.value))}
              className="w-full bg-background-50 border border-background-300/60 rounded-md px-3 py-2 text-sm text-foreground-100 outline-none focus:border-accent-500/40 transition-colors"
            />
          </Field>

          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-sm text-foreground-100">Alert on failure</span>
            <input type="checkbox" checked={alertFailure} onChange={(e) => setAlertFailure(e.target.checked)} className="accent-accent-500 w-4 h-4 cursor-pointer" />
          </label>

          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-sm text-foreground-100">Alert on recovery</span>
            <input type="checkbox" checked={alertRecovery} onChange={(e) => setAlertRecovery(e.target.checked)} className="accent-accent-500 w-4 h-4 cursor-pointer" />
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 text-xs font-label text-foreground-300 bg-background-50 border border-background-300/60 rounded-md px-3.5 py-2 hover:border-background-300/80 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 text-xs font-label font-semibold bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3.5 py-2 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-label font-semibold text-foreground-200">{label}</label>
      <p className="text-[10px] text-foreground-600 mb-1.5">{hint}</p>
      {children}
    </div>
  );
}