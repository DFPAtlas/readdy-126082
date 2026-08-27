import { Link } from 'react-router-dom';
import type { NotificationRule } from '@/pages/ai-operations/types';

export default function Governance({ rule }: { rule: NotificationRule }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Audit Required', value: rule.auditRequired ? 'Yes' : 'No' },
    { label: 'Owner', value: rule.ownerTeam },
    { label: 'Last Review', value: rule.lastReviewed },
    { label: 'Next Review', value: rule.nextReview },
    { label: 'Critical Rule', value: rule.severityThreshold === 'critical' ? 'Yes' : 'No' },
    { label: 'Created', value: rule.createdAt },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Governance</h3>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-col gap-1">
              <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">{r.label}</span>
              <span className="text-sm text-foreground-100">{r.value}</span>
            </div>
          ))}
        </div>

        {rule.policyIds.length > 0 && (
          <div>
            <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Policy References</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {rule.policyIds.map((pid) => (
                <Link
                  key={pid}
                  to={`/ai-operations/security/policies/${pid}`}
                  className="text-[11px] font-label font-mono text-accent-400 hover:text-accent-300 bg-background-50 border border-background-200/60 rounded px-2 py-0.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {pid}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}