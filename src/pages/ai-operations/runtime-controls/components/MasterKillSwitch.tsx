import { useState } from 'react';
import { useAuth } from '@/components/feature/AuthGuard';
import { useRuntimeControls, changeRuntimeControl, findMasterSwitch } from '@/pages/ai-operations/runtime-controls/runtimeControlsStore';
import { evaluateRuntimeExecution, buildDefaultGateContext, type RuntimeExecutionState } from '@/lib/ai-operations/runtimeControls';

const STATE_META: Record<RuntimeExecutionState, { label: string; tone: 'red' | 'amber' | 'emerald' }> = {
  BLOCKED: { label: 'BLOCKED', tone: 'red' },
  ARMED_BUT_DISABLED: { label: 'ARMED BUT DISABLED', tone: 'amber' },
  READY_FOR_PILOT: { label: 'READY FOR PILOT', tone: 'amber' },
  EXECUTION_ENABLED: { label: 'EXECUTION ENABLED', tone: 'emerald' },
};

export default function MasterKillSwitch() {
  const { controls, saving, changeError } = useRuntimeControls();
  const { role } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const master = findMasterSwitch(controls);
  const isOwner = role === 'owner';

  const decision = evaluateRuntimeExecution(buildDefaultGateContext(master ? { enabled: master.enabled, execution_allowed: master.execution_allowed } : null));
  const meta = STATE_META[decision.state];

  return (
    <section className="rounded-lg border border-red-500/30 bg-red-500/5 overflow-hidden">
      <div className="px-5 py-5 flex flex-col lg:flex-row lg:items-center gap-5">
        {/* Left: switch identity + state */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-10 h-10 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center shrink-0">
              <i className="ri-shut-down-line text-lg w-5 h-5 flex items-center justify-center"></i>
            </div>
            <div>
              <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">MASTER RUNTIME KILL SWITCH</p>
              <h2 className="text-xl font-heading font-bold text-red-400">ON — EXECUTION BLOCKED</h2>
            </div>
          </div>

          <p className="text-sm text-foreground-500 mt-3 max-w-3xl leading-relaxed">
            {master?.reason ?? 'Runtime execution not yet authorised'}. While the kill switch is ON, no agent, n8n workflow, model call, tool action, knowledge retrieval, notification, schedule or remediation can execute — regardless of any other gate.
          </p>

          <div className="flex flex-wrap gap-2 mt-4">
            <StateChip label="Kill Switch" value={master?.enabled ? 'ON' : 'OFF'} tone="red" />
            <StateChip label="Execution Allowed" value={master?.execution_allowed ? 'Yes' : 'No'} tone={master?.execution_allowed ? 'emerald' : 'red'} />
            <StateChip label="Production Enabled" value="0" tone="red" />
            <StateChip label="Overall" value="NO-GO" tone="red" />
          </div>
        </div>

        {/* Right: status + action */}
        <div className="shrink-0 flex flex-col items-start lg:items-end gap-3">
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-label font-semibold border ${meta.tone === 'red' ? 'text-red-400 bg-red-500/10 border-red-500/25' : meta.tone === 'amber' ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'}`}>
            <span className={`w-2 h-2 rounded-full ${meta.tone === 'red' ? 'bg-red-400' : meta.tone === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
            {meta.label}
          </span>

          {isOwner ? (
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={saving}
              className="inline-flex items-center gap-2 text-xs font-label font-semibold bg-red-500/15 text-red-300 border border-red-500/30 rounded-md px-4 py-2.5 hover:bg-red-500/25 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              <i className="ri-lock-2-line w-4 h-4 flex items-center justify-center"></i>
              Change Control
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-600">
              <i className="ri-lock-line w-3.5 h-3.5 flex items-center justify-center"></i>
              Owner-only — view only
            </span>
          )}
        </div>
      </div>

      {changeError && (
        <div className="px-5 pb-4">
          <div className="bg-red-500/10 border border-red-500/25 rounded-md px-3 py-2 flex items-start gap-2">
            <i className="ri-alert-line text-red-400 w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
            <p className="text-xs text-red-300">{changeError}</p>
          </div>
        </div>
      )}

      {confirmOpen && master && (
        <ControlChangeModal
          title="Change Master Kill Switch"
          description="This is the authoritative group-wide kill switch. Changing it requires an explicit reason, owner authority and confirmation. Turning execution ON here does not by itself enable production — all other gates must still pass."
          currentEnabled={master.enabled}
          currentExec={master.execution_allowed}
          saving={saving}
          onClose={() => setConfirmOpen(false)}
          onSubmit={async (next, reason) => {
            const res = await changeRuntimeControl(master.control_key, next, reason);
            if (!res.error) setConfirmOpen(false);
            return res;
          }}
        />
      )}
    </section>
  );
}

function StateChip({ label, value, tone }: { label: string; value: string; tone: 'red' | 'emerald' | 'amber' }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-300 bg-background-50 border border-background-300/60 rounded-md px-2.5 py-1.5 whitespace-nowrap">
      <span className="text-foreground-600">{label}:</span>
      <span className={tone === 'red' ? 'text-red-400 font-semibold' : tone === 'emerald' ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>{value}</span>
    </span>
  );
}

interface ControlChangeModalProps {
  title: string;
  description: string;
  currentEnabled: boolean;
  currentExec: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (next: { enabled: boolean; execution_allowed: boolean }, reason: string) => Promise<{ error: string | null }>;
}

export function ControlChangeModal({
  title,
  description,
  currentEnabled,
  currentExec,
  saving,
  onClose,
  onSubmit,
}: ControlChangeModalProps) {
  const [enabled, setEnabled] = useState(currentEnabled);
  const [execAllowed, setExecAllowed] = useState(currentExec);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('A reason is required for any control change.');
      return;
    }
    setError(null);
    const res = await onSubmit({ enabled, execution_allowed: execAllowed }, reason.trim());
    if (res.error) setError(res.error);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
      <div className="relative bg-background-100 border border-background-200/60 rounded-lg w-full max-w-lg p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="text-base font-heading font-semibold text-foreground-50">{title}</h3>
            <p className="text-xs text-foreground-500 mt-1 leading-relaxed">{description}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-500 hover:text-foreground-100 hover:bg-background-50 transition-colors cursor-pointer" aria-label="Close">
            <i className="ri-close-line text-lg w-5 h-5 flex items-center justify-center"></i>
          </button>
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3 cursor-pointer bg-background-50 border border-background-300/60 rounded-md px-3 py-2.5">
            <div>
              <p className="text-sm text-foreground-100">Kill Switch enabled</p>
              <p className="text-[11px] text-foreground-600">When ON, all execution is blocked.</p>
            </div>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-red-500 w-4 h-4 cursor-pointer" />
          </label>

          <label className="flex items-center justify-between gap-3 cursor-pointer bg-background-50 border border-background-300/60 rounded-md px-3 py-2.5">
            <div>
              <p className="text-sm text-foreground-100">Execution allowed</p>
              <p className="text-[11px] text-foreground-600">Does not independently enable production — all gates must still pass.</p>
            </div>
            <input type="checkbox" checked={execAllowed} onChange={(e) => setExecAllowed(e.target.checked)} className="accent-emerald-500 w-4 h-4 cursor-pointer" />
          </label>

          <div>
            <label className="text-xs font-label font-semibold text-foreground-200">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Why is this control being changed?"
              className="w-full bg-background-50 border border-background-300/60 rounded-md px-3 py-2 text-sm text-foreground-100 outline-none focus:border-accent-500/40 transition-colors resize-none mt-1.5"
            />
          </div>

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
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 text-xs font-label font-semibold bg-red-500/15 text-red-300 border border-red-500/30 rounded-md px-3.5 py-2 hover:bg-red-500/25 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
          >
            <i className="ri-lock-2-line w-3.5 h-3.5 flex items-center justify-center"></i>
            {saving ? 'Applying…' : 'Confirm Change'}
          </button>
        </div>
      </div>
    </div>
  );
}