import { Link } from 'react-router-dom';
import type { AiSchedule } from '@/pages/ai-operations/types';
import { RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-background-200/40 last:border-0">
      <span className="text-xs font-label text-foreground-500 whitespace-nowrap">{label}</span>
      <span className="text-sm text-foreground-100 text-right">{value || '—'}</span>
    </div>
  );
}

export default function Governance({ schedule }: { schedule: AiSchedule }) {
  const risk = RISK_LEVEL[schedule.risk];
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Governance</h3>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3 py-2 border-b border-background-200/40">
          <span className="text-xs font-label text-foreground-500 whitespace-nowrap">Risk</span>
          <StatusPill tone={risk.tone} label={risk.label} />
        </div>
        <Row label="Policy evaluation" value={schedule.policyIds.length > 0 ? `${schedule.policyIds.length} policies referenced` : 'None referenced'} />
        <Row label="Approval required" value={schedule.approvalRequired ? 'Yes' : 'No'} />
        <Row label="Required team" value={schedule.ownerTeam} />
        <Row label="Environment restriction" value={schedule.environment} />
        <Row label="Quiet-hours rule" value={schedule.quietHoursBehaviour} />
        <Row label="Maintenance-window rule" value={schedule.maintenanceWindowBehaviour} />
        <Row label="Audit requirement" value={schedule.auditRequired ? 'Required' : 'Not required'} />

        {schedule.policyIds.length > 0 && (
          <div className="pt-3 mt-1 border-t border-background-200/60">
            <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1.5">Policy references</p>
            <div className="flex flex-wrap gap-1.5">
              {schedule.policyIds.map((p) => (
                <Link
                  key={p}
                  to={`/ai-operations/security/policies/${p}`}
                  className="text-[10px] font-label text-accent-400 bg-accent-500/10 border border-accent-500/25 rounded px-2 py-0.5 hover:bg-accent-500/20 transition-colors cursor-pointer whitespace-nowrap font-mono"
                >
                  {p}
                </Link>
              ))}
            </div>
          </div>
        )}

        {schedule.approvalRequired && (
          <div className="pt-3">
            <Link
              to="/ai-operations/approvals"
              className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              View Approvals
              <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}