import { Link } from 'react-router-dom';
import { demoPolicyViolations } from '@/mocks/ai-operations-security';
import { RISK_LEVEL } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import RuleReference from '@/pages/ai-operations/notifications/components/RuleReference';

export default function ViolationsPanel() {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Policy Violations</h3>
          <span className="inline-flex items-center gap-1 text-[10px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-flask-line text-xs w-3 h-3 flex items-center justify-center"></i>
            Demo
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <RuleReference source="Security & Policy" eventType="policy_violation" />
          <Link
            to="/ai-operations/audit"
            className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            Open Audit
            <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
          </Link>
          <span className="text-[11px] font-label text-foreground-600">{demoPolicyViolations.length} events</span>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Time</th>
              <th className="px-4 py-2.5 font-medium">Site</th>
              <th className="px-4 py-2.5 font-medium">Agent</th>
              <th className="px-4 py-2.5 font-medium">Policy</th>
              <th className="px-4 py-2.5 font-medium">Attempted Action</th>
              <th className="px-4 py-2.5 font-medium">Severity</th>
              <th className="px-4 py-2.5 font-medium">Result</th>
              <th className="px-4 py-2.5 font-medium">Related Run</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {demoPolicyViolations.map((v) => {
              const severity = RISK_LEVEL[v.severity];
              return (
                <tr key={v.id} className="border-b border-background-200/30 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                  <td className="px-4 py-3 text-foreground-400 whitespace-nowrap">{v.time}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{v.siteName}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{v.agentName}</td>
                  <td className="px-4 py-3">
                    <Link to={`/ai-operations/security/policies/${v.policyId}`} className="text-foreground-200 hover:text-accent-400 transition-colors cursor-pointer">
                      {v.policyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground-400">{v.attemptedAction}</td>
                  <td className="px-4 py-3"><StatusPill tone={severity.tone} label={severity.label} /></td>
                  <td className="px-4 py-3"><StatusPill tone="red" label={v.result} /></td>
                  <td className="px-4 py-3">
                    {v.relatedRunId ? (
                      <Link to={`/ai-operations/runs/${v.relatedRunId}`} className="font-mono text-xs text-accent-400 hover:text-accent-300 transition-colors cursor-pointer">
                        {v.relatedRunId}
                      </Link>
                    ) : (
                      <span className="text-foreground-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{v.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden divide-y divide-background-200/40">
        {demoPolicyViolations.map((v) => {
          const severity = RISK_LEVEL[v.severity];
          return (
            <div key={v.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-foreground-100">{v.attemptedAction}</p>
                  <p className="text-[10px] font-label text-foreground-600 mt-0.5">{v.siteName} · {v.agentName} · {v.time}</p>
                </div>
                <StatusPill tone="red" label={v.result} />
              </div>
              <div className="mt-2 flex items-center gap-3 text-[11px] font-label text-foreground-500 flex-wrap">
                <StatusPill tone={severity.tone} label={severity.label} />
                {v.relatedRunId && (
                  <Link to={`/ai-operations/runs/${v.relatedRunId}`} className="font-mono text-accent-400 cursor-pointer">
                    {v.relatedRunId}
                  </Link>
                )}
                <span>{v.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}