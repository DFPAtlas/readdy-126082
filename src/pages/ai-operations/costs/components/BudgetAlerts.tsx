import { Link } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthGuard';
import { useCosts } from '@/pages/ai-operations/costs/CostsContext';
import { SEVERITY } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import { ROLE_LABELS } from '@/lib/permissions';

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
  const { budgetEvents, mode, acknowledgeEvent } = useCosts();
  const { user, role } = useAuth();
  const actor = user?.email ?? (role ? ROLE_LABELS[role] : 'Authenticated staff');
  const rows = budgetEvents;

  const handleAcknowledge = (eventKey: string) => {
    void acknowledgeEvent(eventKey, actor);
  };

  return (
    <section aria-label="Budget alerts" className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h3 className="text-sm font-label font-semibold text-foreground-100">Budget Alerts</h3>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-label text-foreground-500">{rows.length} events</span>
        </div>
      </div>

      {mode === 'live' && (
        <p className="text-[11px] font-label text-foreground-600 mb-3">
          Migrated demo baseline — no live threshold monitor triggered these events, and no notifications are sent.
        </p>
      )}

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
                    {mode === 'live' && a.acknowledged && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-label text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 whitespace-nowrap">
                        <i className="ri-check-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i>
                        Acknowledged
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground-500 mt-1">
                    Spend {a.currentSpend} vs {a.threshold} · Forecast {a.forecast}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {link && (
                  <Link
                    to={link.to}
                    className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                  >
                    {link.label}
                    <i className="ri-arrow-right-line w-4 h-4 flex items-center justify-center"></i>
                  </Link>
                )}
                {mode === 'live' && !a.acknowledged && (
                  <button
                    onClick={() => handleAcknowledge(a.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-50 border border-background-300/60 rounded-md px-2.5 py-1.5 hover:text-foreground-100 transition-colors duration-150 cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-check-line w-4 h-4 flex items-center justify-center"></i>
                    Acknowledge
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}