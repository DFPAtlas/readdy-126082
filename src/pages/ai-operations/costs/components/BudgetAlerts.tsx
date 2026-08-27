import { Link } from 'react-router-dom';
import { getBudgetAlerts } from '@/pages/ai-operations/costs/selectors';
import { SEVERITY } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import RuleReference from '@/pages/ai-operations/notifications/components/RuleReference';

function relatedLink(recordType: string, recordId: string | null, label: string) {
  if (!recordId) return null;
  switch (recordType) {
    case 'site':
      return { to: `/ai-operations/sites/${recordId}`, label: `Open ${label}` };
    case 'agent':
      return { to: `/ai-operations/agents/${recordId}`, label: `Open ${label}` };
    case 'model':
      return { to: `/ai-operations/models/${recordId}`, label: `Open ${label}` };
    case 'provider':
      return { to: '/ai-operations/costs', label: `View ${label}` };
    default:
      return null;
  }
}

export default function BudgetAlerts() {
  const rows = getBudgetAlerts();

  return (
    <section aria-label="Budget alerts" className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h3 className="text-sm font-label font-semibold text-foreground-100">Budget Alerts</h3>
        <div className="flex items-center gap-3">
          <RuleReference source="Cost & Budgets" eventType="budget_alert" />
          <span className="text-[11px] font-label text-foreground-500">{rows.length} active</span>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((a) => {
          const link = relatedLink(a.relatedRecordType ?? '', a.relatedRecordId, a.scopeLabel);
          return (
            <div key={a.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-md bg-background-50 border border-background-200/50">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-md bg-red-500/10 text-red-400 flex items-center justify-center shrink-0">
                  <i className="ri-alert-line text-sm w-4 h-4 flex items-center justify-center"></i>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-label font-semibold text-foreground-100">{a.title}</p>
                    <StatusPill tone={SEVERITY[a.severity].tone} label={SEVERITY[a.severity].label} />
                  </div>
                  <p className="text-xs text-foreground-500 mt-1">
                    Spend {a.currentSpend} vs {a.threshold} · Forecast {a.forecast}
                  </p>
                  <p className="text-xs text-foreground-400 mt-1">{a.suggestedAction}</p>
                </div>
              </div>
              {link && (
                <Link
                  to={link.to}
                  className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {link.label}
                  <i className="ri-arrow-right-line w-4 h-4 flex items-center justify-center"></i>
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}