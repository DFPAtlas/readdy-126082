import SiteModule from '@/pages/ai-operations/wallboard/components/operations/SiteModule';
import {
  getGroupMetrics,
  getSiteModules,
  type SiteModule as SiteModuleData,
} from '@/pages/ai-operations/wallboard/operationsWallSelectors';

function Metric({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center px-6 leading-none">
      <span className="font-mono text-[22px] font-semibold tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-[8px] font-label tracking-[0.22em] text-slate-500 mt-1 whitespace-nowrap">{label}</span>
      {sub ? (
        <span className="text-[7px] font-label tracking-[0.14em] text-slate-600 mt-1 whitespace-nowrap">{sub}</span>
      ) : null}
    </div>
  );
}

function Divider() {
  return <span className="w-px h-8 self-center" style={{ background: 'rgba(34,211,238,0.18)' }} />;
}

function EstateRing({ percent }: { percent: number | null }) {
  const healthy = percent != null && percent >= 100;
  const ringColor =
    percent == null ? '#64748b' : healthy ? '#22c55e' : percent >= 60 ? '#f59e0b' : '#ef4444';
  const sweep = percent == null ? 0 : Math.max(0, Math.min(100, percent));

  return (
    <div className="flex items-center gap-3 pl-2">
      <div
        className="relative w-[52px] h-[52px] rounded-full ow-ring"
        style={{ background: `conic-gradient(${ringColor} ${sweep * 3.6}deg, rgba(34,211,238,0.12) 0deg)` }}
      >
        <div className="absolute inset-[4px] rounded-full" style={{ background: '#070d1a' }} />
        <span className="absolute inset-0 flex items-center justify-center font-mono text-[13px] font-bold tabular-nums" style={{ color: ringColor }}>
          {percent == null ? '—' : `${percent}%`}
        </span>
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[9px] font-label tracking-[0.2em] text-slate-400 whitespace-nowrap">ESTATE</span>
        <span className="text-[9px] font-label tracking-[0.2em]" style={{ color: ringColor }}>
          {percent == null ? 'NOT CONFIGURED' : 'ONLINE'}
        </span>
      </div>
    </div>
  );
}

function NetworkSpine() {
  // Star topology behind the modules: a central hub spine (horizontal) plus a
  // vertical trunk and top/bottom connector rails so every surrounding module
  // reads as linked into the DFP hub. Packets move slowly and stay subtle.
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {/* central horizontal spine (middle row) */}
      <div className="absolute left-[8%] right-[8%] top-1/2 h-px" style={{ background: 'rgba(34,211,238,0.16)' }} />
      {/* vertical trunk through the hub */}
      <div className="absolute left-1/2 top-[7%] bottom-[7%] w-px" style={{ background: 'rgba(34,211,238,0.12)' }} />
      {/* top + bottom connector rails */}
      <div className="absolute left-[8%] right-[8%] top-[16.5%] h-px" style={{ background: 'rgba(34,211,238,0.10)' }} />
      <div className="absolute left-[8%] right-[8%] top-[83.5%] h-px" style={{ background: 'rgba(34,211,238,0.10)' }} />

      {/* junction nodes */}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ background: '#22d3ee', boxShadow: '0 0 10px #22d3ee' }} />
      <span className="absolute left-[8%] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style={{ background: '#22d3ee', boxShadow: '0 0 8px #22d3ee' }} />
      <span className="absolute right-[8%] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style={{ background: '#22d3ee', boxShadow: '0 0 8px #22d3ee' }} />
      <span className="absolute left-1/2 top-[16.5%] -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(34,211,238,0.7)', boxShadow: '0 0 6px #22d3ee' }} />
      <span className="absolute left-1/2 bottom-[7%] -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(34,211,238,0.7)', boxShadow: '0 0 6px #22d3ee' }} />

      {/* slow packets — horizontal along the upper rail + vertical trunk */}
      <span className="ow-flow absolute left-[8%] right-[8%] top-[16.5%] h-[2px]" style={{ background: 'rgba(103,232,249,0.45)' }} />
      <span className="ow-flow-y absolute left-1/2 top-[7%] bottom-[7%] w-[2px]" style={{ background: 'rgba(103,232,249,0.4)' }} />
    </div>
  );
}

/**
 * Central Group Operations area — top estate metrics bar plus the connected
 * site ecosystem (DFP as the visual hub, seven surrounding brand modules).
 */
export default function GroupOperationsCenter() {
  const metrics = getGroupMetrics();
  const modules = getSiteModules();

  const byKey = (key: string): SiteModuleData => modules.find((m) => m.key === key)!;
  const top = [byKey('quickguard'), byKey('guardianhub'), byKey('buildnerve')];
  const middle = [byKey('lethub'), byKey('dfp'), byKey('garageglow')];

  return (
    <section className="flex flex-col min-h-0 flex-1">
      {/* Top metrics bar */}
      <div className="shrink-0 ow-panel px-4 py-2 flex items-center justify-between">
        <div className="flex items-baseline gap-3 shrink-0">
          <span className="text-[13px] font-bold tracking-[0.16em] text-slate-100 whitespace-nowrap">
            GROUP OPERATIONS
          </span>
          <span className="hidden md:inline text-[8.5px] font-label tracking-[0.18em] text-slate-500 whitespace-nowrap">
            OUR SITES. ONE ECOSYSTEM.
          </span>
        </div>

        <div className="flex items-center flex-1 justify-center min-w-0">
          <Metric
            label="SITES ONLINE"
            value={`${metrics.sitesOnline}/${metrics.sitesConfigured}`}
            color="#22d3ee"
            sub={`${metrics.sitesConfigured} CONFIGURED · ${metrics.sitesNotConfigured} PENDING`}
          />
          <Divider />
          <Metric label="USERS ACTIVE" value={metrics.usersActive == null ? '—' : String(metrics.usersActive)} color="#4ade80" />
          <Divider />
          <Metric label="AGENTS RUNNING" value={String(metrics.agentsRunning)} color="#a78bfa" />
          <Divider />
          <Metric label="ALERTS" value={String(metrics.alerts)} color={metrics.alerts > 0 ? '#ef4444' : '#64748b'} />
        </div>

        <EstateRing percent={metrics.estatePercent} />
      </div>

      {/* Site network */}
      <div className="ow-site-network relative flex-1 min-h-0 mt-3 grid grid-rows-3 gap-2">
        <NetworkSpine />

        <div className="ow-site-row grid grid-cols-3 gap-2">
          {top.map((s) => (
            <div key={s.key} className="ow-site-cell">
              <SiteModule site={s} />
            </div>
          ))}
        </div>

        <div className="ow-site-row grid grid-cols-3 gap-2">
          {middle.map((s) => (
            <div key={s.key} className="ow-site-cell">
              <SiteModule site={s} />
            </div>
          ))}
        </div>

        <div className="ow-site-row grid grid-cols-3 gap-2">
          <div className="ow-site-cell"><SiteModule site={byKey('vowora')} /></div>
          <div className="ow-site-cell" />
          <div className="ow-site-cell"><SiteModule site={byKey('synqoro')} /></div>
        </div>
      </div>
    </section>
  );
}