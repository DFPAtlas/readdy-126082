// ============================================================================
// Agent Deployment — Step 5: Validate.
// ============================================================================

import type { StepProps, ValidationCheck, CheckKind } from '@/pages/ai-operations/agent-deployment/types';

const KIND_LABELS: Record<CheckKind, string> = {
  required: 'Required fields',
  consistency: 'Site & parent consistency',
  connectivity: 'Connection validation',
  mapping: 'Workflow mapping',
  gate: 'Gates & execution',
};

const toneFor = (status: ValidationCheck['status']) => {
  if (status === 'pass') return { icon: 'ri-checkbox-circle-line', cls: 'text-emerald-400', border: 'border-emerald-500/30' };
  if (status === 'warning') return { icon: 'ri-alert-line', cls: 'text-amber-400', border: 'border-amber-500/30' };
  return { icon: 'ri-close-circle-line', cls: 'text-red-400', border: 'border-red-500/30' };
};

export default function ValidateStep({ checks }: StepProps) {
  const kinds: CheckKind[] = ['required', 'consistency', 'connectivity', 'mapping', 'gate'];

  return (
    <div className="space-y-4">
      <div className="bg-background-50 border border-background-200/60 rounded-md p-3 space-y-1">
        <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide">What these checks mean</p>
        <p className="text-xs text-foreground-500">
          <span className="text-foreground-300">Connection validation</span> confirms the runtime and workflow are registered and reachable.
        </p>
        <p className="text-xs text-foreground-500">
          <span className="text-foreground-300">Dispatch preview</span> shows the mapping that <em>would</em> be dispatched — it is never a workflow run.
        </p>
        <p className="text-xs text-foreground-500">
          <span className="text-foreground-300">Test execution</span> is actual execution, which is not connected — it is shown honestly as unavailable.
        </p>
      </div>

      {kinds.map((kind) => {
        const group = checks.filter((c) => c.kind === kind);
        if (group.length === 0) return null;
        return (
          <div key={kind}>
            <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide mb-2">{KIND_LABELS[kind]}</p>
            <div className="space-y-2">
              {group.map((c) => {
                const t = toneFor(c.status);
                return (
                  <div key={c.key} className={`flex items-start gap-3 bg-background-50 border ${t.border} rounded-md px-3 py-2.5`}>
                    <i className={`${t.icon} ${t.cls} text-base w-5 h-5 flex items-center justify-center mt-0.5`}></i>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground-200 font-medium">{c.label}</p>
                      <p className="text-xs text-foreground-500 mt-0.5">{c.note}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}