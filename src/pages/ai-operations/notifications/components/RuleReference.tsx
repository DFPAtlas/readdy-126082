import { Link } from 'react-router-dom';
import { getRuleBySource } from '@/pages/ai-operations/notifications/selectors';

// Compact inline reference to a matched notification rule, used on Approval /
// Run / Orchestrator / Security / Costs detail to link to the central
// Notifications module without duplicating rule data.
export default function RuleReference({ source, eventType }: { source: string; eventType: string }) {
  const rule = getRuleBySource(source, eventType);
  if (!rule) return null;

  return (
    <Link
      to={`/ai-operations/notifications/rules/${rule.id}`}
      className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
    >
      <i className="ri-notification-3-line text-sm w-4 h-4 flex items-center justify-center"></i>
      Notification rule: {rule.name}
    </Link>
  );
}