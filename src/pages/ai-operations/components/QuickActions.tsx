import { Link } from 'react-router-dom';

const QUICK_ACTIONS = [
  { key: 'search', label: 'Global Search', icon: 'ri-search-line', to: '/ai-operations/search' },
  { key: 'live', label: 'Live Operations', icon: 'ri-pulse-line', to: '/ai-operations/live' },
  { key: 'wallboard', label: 'Wallboard', icon: 'ri-tv-line', to: '/ai-operations/wallboard' },
  { key: 'orchestrator', label: 'Orchestrator', icon: 'ri-robot-2-line', to: '/ai-operations/orchestrator' },
  { key: 'runs', label: 'Tasks & Runs', icon: 'ri-list-check-3', to: '/ai-operations/runs' },
  { key: 'agents', label: 'View All Agents', icon: 'ri-robot-2-line', to: '/ai-operations/agents' },
  { key: 'sites', label: 'View Sites', icon: 'ri-global-line', to: '/ai-operations/sites' },
  { key: 'approvals', label: 'Pending Approvals', icon: 'ri-shield-check-line', to: '/ai-operations/approvals' },
  { key: 'tools', label: 'Tools & Connections', icon: 'ri-plug-2-line', to: '/ai-operations/tools' },
  { key: 'models', label: 'Models & AI Providers', icon: 'ri-cpu-line', to: '/ai-operations/models' },
  { key: 'knowledge', label: 'Knowledge & Memory', icon: 'ri-book-2-line', to: '/ai-operations/knowledge' },
  { key: 'security', label: 'AI Security & Policy', icon: 'ri-shield-keyhole-line', to: '/ai-operations/security' },
  { key: 'failed', label: 'Failed Runs', icon: 'ri-error-warning-line', to: null },
  { key: 'alerts', label: 'Critical Alerts', icon: 'ri-alert-line', to: '/ai-operations/alerts' },
  { key: 'audit', label: 'Audit & Evidence', icon: 'ri-file-list-3-line', to: '/ai-operations/audit' },
  { key: 'costs', label: 'AI Costs', icon: 'ri-money-pound-circle-line', to: '/ai-operations/costs' },
  { key: 'notifications', label: 'Notifications & Escalations', icon: 'ri-notification-3-line', to: '/ai-operations/notifications' },
  { key: 'schedules', label: 'Scheduling & Automation', icon: 'ri-calendar-2-line', to: '/ai-operations/schedules' },
  { key: 'readiness', label: 'Production Readiness', icon: 'ri-shield-check-line', to: '/ai-operations/readiness' },
  { key: 'runtime-health', label: 'Runtime Health', icon: 'ri-radar-line', to: '/ai-operations/runtime-health' },
  { key: 'runtime-controls', label: 'Runtime Controls', icon: 'ri-shield-cross-line', to: '/ai-operations/runtime-controls' },
];

export default function QuickActions() {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Quick Actions</h3>
      <div className="flex flex-wrap gap-2.5">
        {QUICK_ACTIONS.map((action) => {
          if (action.to) {
            return (
              <Link
                key={action.key}
                to={action.to}
                className="inline-flex items-center gap-2 text-xs font-label text-foreground-300 bg-background-50 border border-background-200/60 rounded-lg px-3 py-2 cursor-pointer whitespace-nowrap hover:text-foreground-100 hover:border-background-300/60 transition-colors duration-150"
              >
                <i className={`${action.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
                {action.label}
              </Link>
            );
          }
          return (
            <button
              key={action.key}
              disabled
              title="Coming soon"
              className="inline-flex items-center gap-2 text-xs font-label text-foreground-300 bg-background-50 border border-background-200/60 rounded-lg px-3 py-2 opacity-60 cursor-not-allowed whitespace-nowrap hover:border-background-300/60 transition-colors duration-150"
            >
              <i className={`${action.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
              {action.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}