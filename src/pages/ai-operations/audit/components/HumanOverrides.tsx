import { useAudit } from '@/pages/ai-operations/audit/AuditContext';
import { RISK_CLASS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import { Link } from 'react-router-dom';

export default function HumanOverrides() {
  const { humanOverrides } = useAudit();
  const overrides = humanOverrides;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Human Override Audit</h3>
        <span className="text-[11px] font-label text-foreground-600">{overrides.length} overrides</span>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Override ID</th>
              <th className="px-4 py-2.5 font-medium">Actor</th>
              <th className="px-4 py-2.5 font-medium">Original Decision</th>
              <th className="px-4 py-2.5 font-medium">Override Decision</th>
              <th className="px-4 py-2.5 font-medium">Risk</th>
              <th className="px-4 py-2.5 font-medium">Approval</th>
              <th className="px-4 py-2.5 font-medium">Timestamp</th>
              <th className="px-4 py-2.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {overrides.map((o) => {
              const risk = RISK_CLASS[o.risk];
              return (
                <tr key={o.overrideId} className="border-b border-background-200/30 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                  <td className="px-4 py-3 font-mono text-xs text-foreground-300 whitespace-nowrap">{o.overrideId}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{o.actor}</td>
                  <td className="px-4 py-3 text-foreground-400">{o.originalDecision}</td>
                  <td className="px-4 py-3 text-foreground-100">{o.overrideDecision}</td>
                  <td className="px-4 py-3"><StatusPill tone={risk.tone} label={risk.label} /></td>
                  <td className="px-4 py-3">
                    <Link to={`/ai-operations/approvals/${o.approvalReference}`} className="font-mono text-xs text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap">
                      {o.approvalReference}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground-400 whitespace-nowrap">{o.timestamp}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{o.result}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden divide-y divide-background-200/40">
        {overrides.map((o) => {
          const risk = RISK_CLASS[o.risk];
          return (
            <div key={o.overrideId} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-foreground-100">{o.overrideDecision}</p>
                  <p className="text-[10px] font-label text-foreground-600 mt-0.5">{o.actor} · {o.timestamp}</p>
                </div>
                <StatusPill tone={risk.tone} label={risk.label} />
              </div>
              <p className="text-xs text-foreground-500 mt-2">From: {o.originalDecision}</p>
              <p className="text-xs text-foreground-500 mt-1">Reason: {o.reason}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}