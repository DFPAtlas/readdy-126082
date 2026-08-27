import { useAudit } from '@/pages/ai-operations/audit/AuditContext';
import type { AuditIntegrityState } from '@/pages/ai-operations/types';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

function toneFor(state: AuditIntegrityState): 'emerald' | 'amber' | 'red' | 'secondary' {
  if (state === 'pass') return 'emerald';
  if (state === 'warning') return 'amber';
  if (state === 'fail') return 'red';
  return 'secondary';
}

export default function ComplianceReadiness() {
  const { complianceChecks } = useAudit();
  const checks = complianceChecks;
  const passCount = checks.filter((c) => c.state === 'pass').length;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Compliance Readiness</h3>
          <p className="text-[11px] font-label text-foreground-600 mt-0.5">Operational readiness only — not a legal compliance certification.</p>
        </div>
        <span className="text-[11px] font-label text-foreground-600 whitespace-nowrap">{passCount}/{checks.length} pass</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
        {checks.map((c) => (
          <div key={c.name} className="flex items-start justify-between gap-3 p-3 bg-background-50 border border-background-200/60 rounded-md">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground-100">{c.name}</p>
              <p className="text-xs text-foreground-500 mt-0.5">{c.note}</p>
            </div>
            <StatusPill tone={toneFor(c.state)} label={c.state.toUpperCase()} />
          </div>
        ))}
      </div>
    </section>
  );
}