import { Link } from 'react-router-dom';
import type { AiAlert } from '@/pages/ai-operations/types';
import { SEVERITY, ALERT_STATUS, ALERT_TYPE_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

// Deterministic demo age calculation relative to a fixed "now" (2026-08-25 11:00).
function ageLabel(detectedAt: string): string {
  if (!detectedAt || detectedAt === 'Just now') return 'Just now';
  const m = detectedAt.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!m) return '—';
  const [, , , dd, hh, mm] = m;
  const nowMins = 25 * 24 * 60 + 11 * 60; // 2026-08-25 11:00 in day-relative minutes
  const detMins = (Number(dd) - 1) * 24 * 60 + Number(hh) * 60 + Number(mm);
  const mins = nowMins - detMins;
  if (mins < 0) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${mins % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export default function IncidentQueue({ alerts }: { alerts: AiAlert[] }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Incident Queue</h3>
        <span className="text-[11px] font-label text-foreground-600">{alerts.length} alerts</span>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Alert</th>
              <th className="px-4 py-2.5 font-medium">Site</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Severity</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Source</th>
              <th className="px-4 py-2.5 font-medium">Assigned Team</th>
              <th className="px-4 py-2.5 font-medium">Detected</th>
              <th className="px-4 py-2.5 font-medium">Age</th>
              <th className="px-4 py-2.5 font-medium">Related Run</th>
              <th className="px-4 py-2.5 font-medium text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => {
              const sev = SEVERITY[a.severity];
              const status = ALERT_STATUS[a.status];
              return (
                <tr key={a.id} className="border-b border-background-200/30 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <Link to={`/ai-operations/alerts/${a.id}`} className="font-medium text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer">
                      {a.title}
                    </Link>
                    <p className="text-[10px] font-label text-foreground-600 font-mono mt-0.5">{a.id}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{a.siteName}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{ALERT_TYPE_LABELS[a.type]}</td>
                  <td className="px-4 py-3"><StatusPill tone={sev.tone} label={sev.label} /></td>
                  <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} /></td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap max-w-[160px] truncate">{a.triggerSource}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{a.assignedTeam}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{a.detectedAt.replace('2026-08-25 ', '')}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{ageLabel(a.detectedAt)}</td>
                  <td className="px-4 py-3">
                    {a.runId ? (
                      <Link to={`/ai-operations/runs/${a.runId}`} className="text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer font-mono whitespace-nowrap">
                        {a.runId}
                      </Link>
                    ) : (
                      <span className="text-foreground-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/ai-operations/alerts/${a.id}`}
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
        {alerts.map((a) => {
          const sev = SEVERITY[a.severity];
          const status = ALERT_STATUS[a.status];
          return (
            <Link key={a.id} to={`/ai-operations/alerts/${a.id}`} className="block px-4 py-3 hover:bg-background-200/30 transition-colors duration-150 cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground-100">{a.title}</p>
                  <p className="text-[10px] font-label text-foreground-600 mt-0.5">{a.siteName} · {ALERT_TYPE_LABELS[a.type]}</p>
                </div>
                <StatusPill tone={sev.tone} label={sev.label} />
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px] font-label text-foreground-500 flex-wrap">
                <StatusPill tone={status.tone} label={status.label} />
                <span>{a.assignedTeam}</span>
                <span>{ageLabel(a.detectedAt)} ago</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}