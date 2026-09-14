import { Link } from 'react-router-dom';
import type {
  RecentActivityItem,
  UpcomingMilestone,
  QuickAccessItem,
} from '../executiveTypes';
import { SectionHeading, Unavailable, EmptyNote } from './shared';
import { HEALTH_STATE_LABELS } from '@/pages/projects/portfolioTypes';

const SEVERITY_DOT: Record<RecentActivityItem['severity'], string> = {
  Critical: 'bg-red-400',
  Warning: 'bg-amber-400',
  Info: 'bg-accent-400',
};

const MILESTONE_ICON: Record<UpcomingMilestone['type'], string> = {
  launch: 'ri-rocket-line',
  maintenance: 'ri-tools-line',
  payment: 'ri-bank-card-line',
  uat: 'ri-clipboard-line',
  approval: 'ri-shield-check-line',
};

export default function ActivityPanel({
  activity,
  activityAvailable,
  upcoming,
  quickAccess,
}: {
  activity: RecentActivityItem[];
  activityAvailable: boolean;
  upcoming: UpcomingMilestone[];
  quickAccess: QuickAccessItem[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Recent activity */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-5 lg:col-span-1">
        <SectionHeading icon="ri-history-line" title="Recent Activity" action={{ label: 'Open Activity', to: '/activity-log' }} />

        {!activityAvailable ? (
          <Unavailable label="Activity data unavailable" />
        ) : activity.length === 0 ? (
          <EmptyNote>No significant activity yet.</EmptyNote>
        ) : (
          <div className="space-y-1 max-h-[340px] overflow-y-auto pr-1">
            {activity.map((a) => (
              <div key={a.key} className="flex items-start gap-2.5 py-1.5 border-b border-background-200/40 last:border-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${SEVERITY_DOT[a.severity]}`}></span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground-200 truncate">{a.event}</p>
                  <p className="text-[10px] text-foreground-500 truncate">
                    {a.projectName} · {a.source} · {a.timeLabel}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming milestones */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-5">
        <SectionHeading icon="ri-calendar-event-line" title="Upcoming" />

        {upcoming.length === 0 ? (
          <EmptyNote>No upcoming milestones with real dates.</EmptyNote>
        ) : (
          <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
            {upcoming.slice(0, 12).map((m) => (
              <div key={m.key} className="flex items-center gap-2.5 py-1.5 border-b border-background-200/40 last:border-0">
                <i className={`${MILESTONE_ICON[m.type]} w-4 h-4 flex items-center justify-center text-foreground-400 shrink-0`}></i>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground-200 truncate">{m.label}</p>
                  <p className="text-[10px] text-foreground-500 truncate">
                    {m.projectName}
                    {m.date ? ` · ${new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ' · Awaiting action'}
                  </p>
                </div>
                {m.deepLink && (
                  <Link to={m.deepLink.to} className="text-[10px] text-accent-400 hover:text-accent-300 whitespace-nowrap shrink-0 cursor-pointer">
                    Open
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick project access */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-5">
        <SectionHeading icon="ri-folder-open-line" title="Projects" action={{ label: 'View Full Portfolio', to: '/projects' }} />

        {quickAccess.length === 0 ? (
          <EmptyNote>No projects yet.</EmptyNote>
        ) : (
          <div className="space-y-1.5">
            {quickAccess.map((q) => (
              <Link
                key={q.projectSlug}
                to={`/projects/${q.projectSlug}`}
                className="flex items-center gap-3 bg-background-50 border border-background-200/50 hover:border-accent-500/30 rounded-md px-3 py-2 transition-colors cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-foreground-100 font-medium truncate">{q.projectName}</p>
                    <span className="text-[9px] font-label text-foreground-500 uppercase whitespace-nowrap shrink-0">
                      {q.lifecycle.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[10px] text-foreground-500 truncate">
                    {HEALTH_STATE_LABELS[q.health as keyof typeof HEALTH_STATE_LABELS] ?? q.health} · {q.priority} · {q.lastActivity}
                  </p>
                </div>
                <i className="ri-arrow-right-s-line text-foreground-500 w-4 h-4 flex items-center justify-center shrink-0"></i>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}