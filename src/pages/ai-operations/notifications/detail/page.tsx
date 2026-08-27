import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useNotifications } from '@/pages/ai-operations/notifications/NotificationsContext';
import RuleHeader from '@/pages/ai-operations/notifications/detail/components/RuleHeader';
import Trigger from '@/pages/ai-operations/notifications/detail/components/Trigger';
import NotificationRouting from '@/pages/ai-operations/notifications/detail/components/NotificationRouting';
import EscalationPath from '@/pages/ai-operations/notifications/detail/components/EscalationPath';
import SuppressionDedup from '@/pages/ai-operations/notifications/detail/components/SuppressionDedup';
import Governance from '@/pages/ai-operations/notifications/detail/components/Governance';
import NotificationActivity from '@/pages/ai-operations/notifications/components/NotificationActivity';
import RuleFormModal from '@/pages/ai-operations/notifications/components/RuleFormModal';

export default function RuleDetailPage() {
  const { ruleId } = useParams<{ ruleId: string }>();
  const { getRule, getEventsByRule } = useNotifications();
  const [showEdit, setShowEdit] = useState(false);

  const rule = getRule(ruleId ?? '');

  if (!rule) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-lg mx-auto mt-16">
        <i className="ri-notification-3-line text-4xl text-foreground-600 w-10 h-10 flex items-center justify-center mx-auto"></i>
        <h1 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Rule not found</h1>
        <p className="text-sm text-foreground-500 mt-2">The requested notification rule does not exist in the registry.</p>
        <Link
          to="/ai-operations/notifications"
          className="inline-flex items-center gap-2 mt-6 text-sm font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
          Back to Notifications &amp; Escalations
        </Link>
      </div>
    );
  }

  const events = getEventsByRule(rule.id);

  return (
    <div className="space-y-6">
      {/* Operational status banner */}
      <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg px-4 py-3 flex items-start gap-3">
        <i className="ri-information-line text-amber-400 w-5 h-5 flex items-center justify-center shrink-0 mt-0.5"></i>
        <p className="text-xs text-amber-300 leading-relaxed">
          <span className="font-label font-semibold">Automatic escalation runtime is not connected.</span>{' '}
          This rule and its escalation path are configuration metadata only — no message is delivered and no timer runs.
        </p>
      </div>

      <RuleHeader rule={rule} />

      <div className="flex justify-end">
        <button
          onClick={() => setShowEdit(true)}
          className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-50 border border-background-300/60 rounded-md px-3 py-2 hover:text-foreground-100 hover:border-background-400/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-edit-line text-sm w-4 h-4 flex items-center justify-center"></i>
          Edit Rule
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Trigger rule={rule} />
        <NotificationRouting rule={rule} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="text-[11px] font-label font-semibold text-foreground-500 uppercase tracking-wide">Demo Supporting Metadata</h4>
            <span className="flex-1 h-px bg-background-300/40"></span>
          </div>
          <EscalationPath rule={rule} />
        </div>
        <div className="space-y-5">
          <SuppressionDedup rule={rule} />
          <Governance rule={rule} />
        </div>
      </div>

      {events.length > 0 && (
        <NotificationActivity events={events} />
      )}

      <RuleFormModal open={showEdit} onClose={() => setShowEdit(false)} rule={rule} />
    </div>
  );
}