import { Link } from 'react-router-dom';
import type { NotificationRule } from '@/pages/ai-operations/types';
import {
  SEVERITY,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_RULE_STATUS,
  NOTIFICATION_CHANNEL_LABELS,
} from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function RuleRegistry({ rules }: { rules: NotificationRule[] }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Notification Rules</h3>
        <span className="text-[11px] font-label text-foreground-600">{rules.length} rules</span>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Rule</th>
              <th className="px-4 py-2.5 font-medium">Source</th>
              <th className="px-4 py-2.5 font-medium">Site / Scope</th>
              <th className="px-4 py-2.5 font-medium">Severity</th>
              <th className="px-4 py-2.5 font-medium">Priority</th>
              <th className="px-4 py-2.5 font-medium">Channels</th>
              <th className="px-4 py-2.5 font-medium">Recipient</th>
              <th className="px-4 py-2.5 font-medium">Escalation</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => {
              const sev = SEVERITY[r.severityThreshold];
              const prio = NOTIFICATION_PRIORITY[r.priority];
              const status = NOTIFICATION_RULE_STATUS[r.status];
              return (
                <tr key={r.id} className="border-b border-background-200/30 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <Link to={`/ai-operations/notifications/rules/${r.id}`} className="font-medium text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer">
                      {r.name}
                    </Link>
                    <p className="text-[10px] font-label text-foreground-600 font-mono mt-0.5">{r.id}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap max-w-[160px] truncate">{r.eventSource}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{r.siteName}</td>
                  <td className="px-4 py-3"><StatusPill tone={sev.tone} label={sev.label} /></td>
                  <td className="px-4 py-3"><StatusPill tone={prio.tone} label={prio.label} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.channels.slice(0, 3).map((c) => (
                        <span key={c} className="text-[10px] font-label text-foreground-400 bg-background-50 border border-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">
                          {NOTIFICATION_CHANNEL_LABELS[c]}
                        </span>
                      ))}
                      {r.channels.length > 3 && <span className="text-[10px] font-label text-foreground-600">+{r.channels.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap max-w-[160px] truncate">{r.initialTeam}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap max-w-[160px] truncate">{r.escalationTeam}</td>
                  <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/ai-operations/notifications/rules/${r.id}`}
                      className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Open
                      <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden divide-y divide-background-200/40">
        {rules.map((r) => {
          const sev = SEVERITY[r.severityThreshold];
          const status = NOTIFICATION_RULE_STATUS[r.status];
          return (
            <Link key={r.id} to={`/ai-operations/notifications/rules/${r.id}`} className="block px-4 py-3 hover:bg-background-200/30 transition-colors duration-150 cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground-100">{r.name}</p>
                  <p className="text-[10px] font-label text-foreground-600 mt-0.5">{r.siteName} · {r.eventSource}</p>
                </div>
                <StatusPill tone={sev.tone} label={sev.label} />
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px] font-label text-foreground-500 flex-wrap">
                <StatusPill tone={status.tone} label={status.label} />
                <span>{r.initialTeam}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}