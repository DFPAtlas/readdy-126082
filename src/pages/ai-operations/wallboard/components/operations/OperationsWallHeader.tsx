import { useEffect, useState, useMemo } from 'react';
import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { useRuntimeHealth } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { useOperationsHealthData } from '@/pages/ai-operations/wallboard/operationsHealthStore';
import {
  getGlobalSystemState,
  getUserTotals,
  formatWallTime,
  formatWallDate,
  timezoneLabel,
} from '@/pages/ai-operations/wallboard/operationsWallSelectors';

const STATE_COLOR: Record<string, string> = {
  nominal: '#22c55e',
  degraded: '#f59e0b',
  critical: '#ef4444',
  offline: '#64748b',
};

/**
 * Command-level header — DFP COMMAND title, live clock, and global system
 * state. Owns the once-per-second clock so it stays isolated from the
 * operational-data refresh.
 *
 * The global state is composed from the group snapshot AND the runtime-health
 * and operations-health stores (core systems / bridges / database) — so the
 * header re-derives whenever ANY of those authoritative signals change, never
 * from the group snapshot alone.
 */
export default function OperationsWallHeader() {
  const [now, setNow] = useState<Date>(() => new Date());
  const group = useGroupLiveData();
  const runtimeHealth = useRuntimeHealth();
  const operationsHealth = useOperationsHealthData();

  // Clock — updates once per second (independent of data refresh).
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const global = useMemo(
    () => getGlobalSystemState(),
    [group, runtimeHealth, operationsHealth],
  );
  const accent = STATE_COLOR[global.state] ?? '#64748b';

  // Platform user totals — re-derived whenever the shared live snapshot changes.
  const users = useMemo(() => getUserTotals(), [group, runtimeHealth, operationsHealth]);
  const onlineColor = users.onlineNow == null ? '#64748b' : '#4ade80';
  const accountsColor = users.totalAccounts == null ? '#64748b' : '#22d3ee';
  const platformBreakdown = users.platforms
    .map((p) => `${p.name}: ${p.count == null ? 'awaiting feed' : p.count.toLocaleString('en-GB')}`)
    .join('\n');

  return (
    <header className="shrink-0 flex items-stretch justify-between border-b border-cyan-400/15 h-[64px]">
      {/* Left — title */}
      <div className="flex items-center gap-4 pl-6">
        <div className="flex items-baseline gap-3 whitespace-nowrap">
          <span className="text-[26px] font-bold tracking-[0.18em] text-slate-100 font-heading">
            DFP COMMAND
          </span>
          <span className="w-[3px] h-[26px] self-center ow-rail" />
          <span className="text-[26px] font-semibold tracking-[0.18em] text-cyan-300 font-heading">
            OPERATIONS WALL
          </span>
        </div>
        <div className="hidden xl:flex flex-col leading-tight border-l border-cyan-400/15 pl-4">
          <span className="text-[10px] font-label tracking-[0.22em] text-slate-400">
            PEOPLE // PLATFORMS // PROGRESS // ALWAYS ON
          </span>
        </div>
      </div>

      {/* Right — user totals + clock + system state */}
      <div className="flex items-center gap-5 pr-6">
        {/* Platform user totals — grand total across every platform. ONLINE NOW
            is live presence; TOTAL USERS sums each platform's OWN reported
            account count and names its coverage honestly. */}
        <div className="flex items-end gap-4" title={platformBreakdown}>
          <div className="flex flex-col items-end leading-none">
            <span
              className="font-mono text-[24px] font-semibold tabular-nums"
              style={{ color: onlineColor }}
            >
              {users.onlineNow == null ? '—' : users.onlineNow.toLocaleString('en-GB')}
            </span>
            <span className="text-[8px] font-label tracking-[0.18em] text-slate-500 mt-1 whitespace-nowrap">
              ONLINE NOW
            </span>
          </div>

          <span className="w-px h-8 self-center" style={{ background: 'rgba(34,211,238,0.18)' }} />

          <div className="flex flex-col items-end leading-none">
            <span
              className="font-mono text-[24px] font-semibold tabular-nums"
              style={{ color: accountsColor }}
            >
              {users.totalAccounts == null ? '—' : users.totalAccounts.toLocaleString('en-GB')}
            </span>
            <span className="text-[8px] font-label tracking-[0.18em] text-slate-500 mt-1 whitespace-nowrap">
              TOTAL USERS
            </span>
            <span className="text-[7.5px] font-label tracking-[0.14em] text-slate-600 mt-0.5 whitespace-nowrap">
              {users.platformsTotal === 0
                ? 'NO PLATFORMS REGISTERED'
                : `${users.platformsReporting}/${users.platformsTotal} PLATFORMS REPORTING`}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end leading-tight">
          <span className="text-[11px] font-label tracking-[0.18em] text-slate-400">
            {formatWallDate(now)}
          </span>
          <span className="text-[12px] font-label tracking-[0.18em] text-slate-500">
            {timezoneLabel(now)}
          </span>
        </div>

        <span className="font-mono text-[30px] font-semibold tracking-[0.08em] text-slate-100 tabular-nums">
          {formatWallTime(now)}
        </span>

        <div
          className="flex flex-col items-center justify-center border rounded-md px-4 py-1.5 whitespace-nowrap"
          style={{ borderColor: `${accent}55`, background: `${accent}14` }}
        >
          <span className="text-[9px] font-label tracking-[0.24em] text-slate-400">SYSTEM STATE</span>
          <span
            className="flex items-center gap-2 text-[14px] font-bold tracking-[0.14em]"
            style={{ color: accent }}
          >
            <span
              className={`w-2 h-2 rounded-full ${global.state === 'critical' ? 'ow-alert' : 'ow-pulse'}`}
              style={{ background: accent }}
            />
            {global.label}
          </span>
        </div>
      </div>
    </header>
  );
}