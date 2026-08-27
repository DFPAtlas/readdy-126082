import type { AiAuditEvent } from '@/pages/ai-operations/types';

function Flag({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-background-200/30 last:border-0">
      <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">{label}</span>
      <span className={`text-xs font-label ${value ? 'text-amber-400' : 'text-foreground-600'}`}>{value ? 'Yes' : 'No'}</span>
    </div>
  );
}

export default function Verification({ event }: { event: AiAuditEvent }) {
  const v = event.verification;

  if (!v.required) {
    return (
      <section className="bg-background-100 border border-background-200/60 rounded-lg">
        <div className="px-4 py-3 border-b border-background-200/60">
          <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Verification</h4>
        </div>
        <p className="px-4 py-6 text-sm text-foreground-500">Verification not required for this event.</p>
      </section>
    );
  }

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Verification</h4>
      </div>
      <div className="px-4 py-2">
        <div className="flex items-center justify-between gap-3 py-2.5 border-b border-background-200/30">
          <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Verification status</span>
          <span className={`text-sm font-medium ${v.status === 'Passed' ? 'text-emerald-400' : v.status === 'Failed' ? 'text-red-400' : 'text-foreground-100'}`}>{v.status}</span>
        </div>
        <div className="flex items-center justify-between gap-3 py-2.5 border-b border-background-200/30">
          <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wide">Verification agent / team</span>
          <span className="text-sm text-foreground-100 text-right">{v.agent}</span>
        </div>
        <Flag label="Evidence available" value={v.evidenceAvailable} />
      </div>

      <div className="px-4 py-3 border-t border-background-200/60">
        <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-2">Checks performed</p>
        <ul className="space-y-1.5">
          {v.checksPerformed.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground-300">
              <i className="ri-checkbox-blank-circle-fill text-[6px] mt-1.5 text-accent-400 w-2 h-2 flex items-center justify-center"></i>
              {c}
            </li>
          ))}
        </ul>
      </div>

      <div className="px-4 py-3 border-t border-background-200/60">
        <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1">Result</p>
        <p className="text-sm text-foreground-100">{v.result}</p>
        {v.failureSummary && <p className="text-sm text-red-400 mt-1">{v.failureSummary}</p>}
      </div>
    </section>
  );
}