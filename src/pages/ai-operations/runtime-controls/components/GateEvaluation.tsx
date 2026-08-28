import type { GateResult, RuntimeExecutionState } from '@/lib/ai-operations/runtimeControls';

const STATE_META: Record<GateResult['state'], { label: string; tone: 'emerald' | 'red' | 'amber' | 'secondary' }> = {
  pass: { label: 'Pass', tone: 'emerald' },
  block: { label: 'Block', tone: 'red' },
  not_ready: { label: 'Not Ready', tone: 'amber' },
  not_required: { label: 'Not Required', tone: 'secondary' },
};

const EXEC_META: Record<RuntimeExecutionState, string> = {
  BLOCKED: 'bg-red-500/15 text-red-400 border-red-500/25',
  ARMED_BUT_DISABLED: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  READY_FOR_PILOT: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  EXECUTION_ENABLED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
};

export default function GateEvaluation({
  gates,
  state,
  title = 'Execution Gate Evaluation',
}: {
  gates: GateResult[];
  state: RuntimeExecutionState;
  title?: string;
}) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">{title}</h3>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-label font-semibold rounded-full px-2.5 py-1 border whitespace-nowrap ${EXEC_META[state]}`}>
          <i className="ri-shield-cross-line w-3.5 h-3.5 flex items-center justify-center"></i>
          {state === 'BLOCKED' ? 'EXECUTION BLOCKED' : state}
        </span>
      </div>

      <ol className="divide-y divide-background-200/40">
        {gates.map((gate, idx) => {
          const meta = STATE_META[gate.state];
          return (
            <li key={gate.key} className="px-4 py-2.5 flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-background-50 border border-background-300/60 text-[10px] font-label text-foreground-500 flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-foreground-100 font-medium">{gate.label}</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-label border whitespace-nowrap ${meta.tone === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : meta.tone === 'red' ? 'bg-red-500/10 text-red-400 border-red-500/25' : meta.tone === 'amber' ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' : 'bg-secondary-500/10 text-secondary-300 border-secondary-500/25'}`}>
                    {meta.label}
                  </span>
                </div>
                <p className="text-xs text-foreground-500 mt-0.5">{gate.note}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}