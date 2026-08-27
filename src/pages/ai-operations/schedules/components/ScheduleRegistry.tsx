import { Link } from 'react-router-dom';
import type { AiSchedule } from '@/pages/ai-operations/types';
import { AUTOMATION_TYPE_LABELS, SCHEDULE_STATUS, RISK_LEVEL, ACTIVITY_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function ScheduleRegistry({ schedules }: { schedules: AiSchedule[] }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Schedule Registry</h3>
        <span className="text-[11px] font-label text-foreground-600">{schedules.length} schedules</span>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Schedule</th>
              <th className="px-4 py-2.5 font-medium">Site / Scope</th>
              <th className="px-4 py-2.5 font-medium">Agent</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Frequency</th>
              <th className="px-4 py-2.5 font-medium">Next Run</th>
              <th className="px-4 py-2.5 font-medium">Last Run</th>
              <th className="px-4 py-2.5 font-medium">Last Status</th>
              <th className="px-4 py-2.5 font-medium">Risk</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => {
              const status = SCHEDULE_STATUS[s.status];
              const risk = RISK_LEVEL[s.risk];
              const last = s.lastRunStatus ? ACTIVITY_STATUS[s.lastRunStatus] : null;
              return (
                <tr key={s.id} className="border-b border-background-200/30 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <Link to={`/ai-operations/schedules/${s.id}`} className="font-medium text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer">
                      {s.name}
                    </Link>
                    <p className="text-[10px] font-label text-foreground-600 font-mono mt-0.5">{s.id}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{s.siteName}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap max-w-[160px] truncate">{s.agentName}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{AUTOMATION_TYPE_LABELS[s.automationType]}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{s.frequency}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap font-mono text-xs">{s.nextRun}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap font-mono text-xs">{s.lastRun}</td>
                  <td className="px-4 py-3">{last ? <StatusPill tone={last.tone} label={last.label} /> : <span className="text-foreground-600 text-xs">—</span>}</td>
                  <td className="px-4 py-3"><StatusPill tone={risk.tone} label={risk.label} /></td>
                  <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/ai-operations/schedules/${s.id}`}
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
        {schedules.map((s) => {
          const status = SCHEDULE_STATUS[s.status];
          const risk = RISK_LEVEL[s.risk];
          return (
            <Link key={s.id} to={`/ai-operations/schedules/${s.id}`} className="block px-4 py-3 hover:bg-background-200/30 transition-colors duration-150 cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground-100">{s.name}</p>
                  <p className="text-[10px] font-label text-foreground-600 mt-0.5">{s.siteName} · {s.agentName}</p>
                </div>
                <StatusPill tone={status.tone} label={status.label} />
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px] font-label text-foreground-500 flex-wrap">
                <StatusPill tone={risk.tone} label={risk.label} />
                <span>{AUTOMATION_TYPE_LABELS[s.automationType]}</span>
                <span>·</span>
                <span>{s.frequency}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}