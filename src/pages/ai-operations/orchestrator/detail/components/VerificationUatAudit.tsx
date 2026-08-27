import type { AiOrchestration } from '@/pages/ai-operations/types';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function VerificationUatAudit({ orchestration }: { orchestration: AiOrchestration }) {
  const v = orchestration.verification;
  const u = orchestration.uat;
  const a = orchestration.audit;

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Verification / UAT / Audit</h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Verification */}
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-heading font-semibold text-foreground-50">Verification</h4>
            <StatusPill tone={v.required ? 'emerald' : 'secondary'} label={v.required ? 'Required' : 'Not Required'} />
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div>
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Agent</p>
              <p className="text-foreground-300 mt-0.5">{v.agent}</p>
            </div>
            <div>
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Checks</p>
              <p className="text-foreground-300 mt-0.5">{v.checks}</p>
            </div>
            <div>
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Expected outcome</p>
              <p className="text-foreground-300 mt-0.5">{v.expectedOutcome}</p>
            </div>
            <div>
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Evidence</p>
              <p className="text-foreground-300 mt-0.5">{v.evidence}</p>
            </div>
          </div>
        </div>

        {/* UAT */}
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-heading font-semibold text-foreground-50">UAT</h4>
            <StatusPill tone={u.required ? 'emerald' : 'secondary'} label={u.required ? 'Required' : 'Not Required'} />
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div>
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Agent</p>
              <p className="text-foreground-300 mt-0.5">{u.agent}</p>
            </div>
            <div>
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Test reference</p>
              <p className="text-foreground-300 mt-0.5">{u.testRef}</p>
            </div>
            <div>
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Tests / pass state</p>
              <p className="text-foreground-300 mt-0.5">{u.tests} tests · {u.requiredPassState}</p>
            </div>
            <div>
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Status</p>
              <p className="text-foreground-300 mt-0.5">{u.status}</p>
            </div>
          </div>
        </div>

        {/* Audit */}
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-heading font-semibold text-foreground-50">Audit</h4>
            <StatusPill tone={a.required ? 'emerald' : 'secondary'} label={a.required ? 'Required' : 'Not Required'} />
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div>
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Approval reference</p>
              <p className="text-foreground-300 mt-0.5">{a.approvalRef}</p>
            </div>
            <div>
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Run references</p>
              <p className="text-foreground-300 mt-0.5">{a.runRefs.length ? a.runRefs.join(', ') : '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Evidence required</p>
              <p className="text-foreground-300 mt-0.5">{a.evidenceRequired}</p>
            </div>
            <div>
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Completion required</p>
              <p className="text-foreground-300 mt-0.5">{a.completionRequired ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}