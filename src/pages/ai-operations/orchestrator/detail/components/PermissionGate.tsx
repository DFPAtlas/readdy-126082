import type { AiOrchestration } from '@/pages/ai-operations/types';
import { PERMISSION_GATE_STATE } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function PermissionGate({ orchestration }: { orchestration: AiOrchestration }) {
  const { permissionGate } = orchestration;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Permission Gate</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {permissionGate.map((check) => (
          <div key={check.name} className="bg-background-50 border border-background-200/40 rounded-lg p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-foreground-100 font-medium">{check.name}</p>
              <StatusPill tone={PERMISSION_GATE_STATE[check.state].tone} label={PERMISSION_GATE_STATE[check.state].label} />
            </div>
            <p className="text-xs text-foreground-500 mt-1">{check.note}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] font-label text-foreground-600 mt-3">No real permission action is performed — demo state only.</p>
    </section>
  );
}