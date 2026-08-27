import type { AgentActionPermission } from '@/pages/ai-operations/types';
import { RISK_CLASS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function ActionPermissions({ actions }: { actions: AgentActionPermission[] }) {
  const green = actions.filter((a) => a.riskClass === 'green');
  const amber = actions.filter((a) => a.riskClass === 'amber');
  const red = actions.filter((a) => a.riskClass === 'red');

  const groups = [
    { key: 'green', label: 'Green — safe actions', items: green, icon: 'ri-checkbox-circle-line', tone: 'text-emerald-400' },
    { key: 'amber', label: 'Amber — controlled actions', items: amber, icon: 'ri-alert-line', tone: 'text-amber-400' },
    { key: 'red', label: 'Red — high-risk actions', items: red, icon: 'ri-forbid-line', tone: 'text-red-400' },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Action Permissions</h3>
        <span className="text-xs font-label text-foreground-600">{actions.length} actions</span>
      </div>

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.key} className="bg-background-100 border border-background-200/60 rounded-lg">
            <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
              <i className={`${group.icon} ${group.tone} text-sm w-4 h-4 flex items-center justify-center`}></i>
              <h4 className="text-sm font-label font-semibold text-foreground-200">{group.label}</h4>
              <span className="text-xs font-label text-foreground-600 ml-auto">{group.items.length}</span>
            </div>
            {group.items.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-foreground-500">No {group.key} actions defined.</p>
              </div>
            ) : (
              <div className="divide-y divide-background-200/40">
                {group.items.map((action) => {
                  const cls = RISK_CLASS[action.riskClass];
                  return (
                    <div key={action.action} className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-background-200/30 transition-colors duration-150">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-foreground-200">{action.action}</span>
                          <StatusPill tone={cls.tone} label={cls.label} />
                        </div>
                        <p className="text-xs text-foreground-500 mt-1">{action.notes}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[11px] font-label whitespace-nowrap ${action.allowed ? 'text-emerald-400' : 'text-red-400'}`}>
                          {action.allowed ? 'Allowed' : 'Denied'}
                        </span>
                        <span className="text-[11px] font-label text-foreground-500 whitespace-nowrap">
                          {action.humanApprovalRequired ? 'Approval required' : 'No approval'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}