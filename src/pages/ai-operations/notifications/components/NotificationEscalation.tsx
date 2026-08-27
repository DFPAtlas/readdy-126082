import { Link } from 'react-router-dom';
import type { AiAlert } from '@/pages/ai-operations/types';
import { NOTIFICATION_STATUS, ACKNOWLEDGEMENT_STATE } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import { getRuleByAlertType, getEventsByAlert } from '@/pages/ai-operations/notifications/selectors';

// Compact "Notification & Escalation" panel shown on alert detail. Resolves the
// matched notification rule and latest notification state (demo only).
export default function NotificationEscalation({ alert }: { alert: AiAlert }) {
  const rule = getRuleByAlertType(alert.type);
  const events = getEventsByAlert(alert.id);
  const latest = events[0];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Notification &amp; Escalation</h3>
        {rule && (
          <Link
            to={`/ai-operations/notifications/rules/${rule.id}`}
            className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            Open Rule
            <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
          </Link>
        )}
      </div>
      <div className="p-4 space-y-3">
        {rule ? (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Matched Rule</span>
              <Link to={`/ai-operations/notifications/rules/${rule.id}`} className="text-sm text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer">
                {rule.name} <span className="font-mono text-xs text-foreground-500">({rule.id})</span>
              </Link>
            </div>

            {latest ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Notification Status</span>
                  <StatusPill tone={NOTIFICATION_STATUS[latest.status].tone} label={NOTIFICATION_STATUS[latest.status].label} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Acknowledgement</span>
                  <StatusPill tone={ACKNOWLEDGEMENT_STATE[latest.acknowledgement].tone} label={ACKNOWLEDGEMENT_STATE[latest.acknowledgement].label} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Escalation Level</span>
                  <span className="text-sm text-foreground-100">Level {latest.escalationLevel}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-foreground-500">No notification event recorded for this incident yet.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-foreground-500">No notification rule matches this incident type.</p>
        )}
      </div>
    </section>
  );
}