import SiteModule from '@/pages/ai-operations/wallboard/components/operations/SiteModule';
import {
  getGroupMetrics,
  getSiteModules,
  type SiteModule as SiteModuleData,
} from '@/pages/ai-operations/wallboard/operationsWallSelectors';
import { getWidgetConfigData } from '@/pages/ai-operations/wallboard/widgetConfigStore';
import { useAutoPage } from '@/pages/ai-operations/wallboard/useAutoPage';

// DFP sits fixed in the centre; up to seven surrounding widgets per page.
const SURROUNDING_PER_PAGE = 7;

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

function EstateRing({ percent, label }: { percent: number | null; label: 'ONLINE' | 'NOT MONITORED' | 'NOT CONFIGURED' }) {
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
          {label}
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
 * The 3×3 site grid. DFP is pinned in the centre; the seven surrounding slots
 * are filled from `slots` in reading order (top row → left/right of hub →
 * bottom sides). This preserves the original first-page arrangement for every
 * page — later pages reuse the same layout with the next seven widgets.
 */
function SiteGrid({ hub, slots }: { hub: SiteModuleData | undefined; slots: SiteModuleData[] }) {
  const cell = (i: number): SiteModuleData | null => slots[i] ?? null;
  const row = (indices: number[]) => (
    <div className="ow-site-row grid grid-cols-3 gap-2">
      {indices.map((i) => (
        <div key={i} className="ow-site-cell">
          {cell(i) ? <SiteModule site={cell(i)!} /> : null}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {row([0, 1, 2])}
      <div className="ow-site-row grid grid-cols-3 gap-2">
        <div className="ow-site-cell">{cell(3) ? <SiteModule site={cell(3)!} /> : null}</div>
        <div className="ow-site-cell">{hub ? <SiteModule site={hub} /> : null}</div>
        <div className="ow-site-cell">{cell(4) ? <SiteModule site={cell(4)!} /> : null}</div>
      </div>
      <div className="ow-site-row grid grid-cols-3 gap-2">
        <div className="ow-site-cell">{cell(5) ? <SiteModule site={cell(5)!} /> : null}</div>
        <div className="ow-site-cell" />
        <div className="ow-site-cell">{cell(6) ? <SiteModule site={cell(6)!} /> : null}</div>
      </div>
    </>
  );
}

/**
 * Central Group Operations area — top estate metrics bar plus the connected
 * site ecosystem. DFP is always the visual hub; up to seven surrounding
 * widgets per page, with overflow rotating onto further pages in saved order.
 * Metrics are ESTATE-WIDE (hiding a widget never changes the underlying totals).
 */
export default function GroupOperationsCenter() {
  const metrics = getGroupMetrics();
  const allModules = getSiteModules();
  const config = getWidgetConfigData();

  // Hub = the single central widget; surrounding = visible non-hub widgets in
  // saved order (the selector preserves display_order).
  const hub = allModules.find((m) => m.hub);
  const surrounding = allModules.filter((m) => !m.hub && m.visibleOnWall);

  const pageCount = Math.max(1, Math.ceil(surrounding.length / SURROUNDING_PER_PAGE));
  const [page] = useAutoPage(pageCount);
  const start = page * SURROUNDING_PER_PAGE;
  const slots = surrounding.slice(start, start + SURROUNDING_PER_PAGE);

  return (
    <section className="flex flex-col min-h-0 flex-1">
      {/* Top metrics bar */}
      <div className="shrink-0 ow-panel px-4 py-2 flex items-center justify-between">
        <div className="flex items-baseline gap-2 shrink-0">
          <span className="text-[13px] font-bold tracking-[0.16em] text-slate-100 whitespace-nowrap">
            GROUP OPERATIONS
          </span>
          <span className="text-[7.5px] font-label tracking-[0.18em] px-1.5 py-0.5 border border-cyan-400/30 text-cyan-300 rounded whitespace-nowrap">
            ESTATE-WIDE
          </span>
          <span className="hidden md:inline text-[8.5px] font-label tracking-[0.18em] text-slate-500 whitespace-nowrap">
            OUR SITES. ONE ECOSYSTEM.
          </span>
        </div>

        <div className="flex items-center flex-1 justify-center min-w-0">
          <Metric
            label="SITES ONLINE"
            value={metrics.monitoringCoverage ? `${metrics.sitesOnline}/${metrics.sitesConfigured}` : `—/${metrics.sitesConfigured}`}
            color={metrics.monitoringCoverage ? '#22d3ee' : '#64748b'}
            sub={metrics.monitoringCoverage
              ? `${metrics.sitesConfigured} CONFIGURED · ${metrics.sitesNotConfigured} PENDING`
              : 'NOT MONITORED'}
          />
          <Divider />
          <Metric label="USERS ACTIVE" value={metrics.usersActive == null ? '—' : String(metrics.usersActive)} color="#4ade80" />
          <Divider />
          <Metric label="AGENTS RUNNING" value={String(metrics.agentsRunning)} color="#a78bfa" />
          <Divider />
          <Metric label="ALERTS" value={String(metrics.alerts)} color={metrics.alerts > 0 ? '#ef4444' : '#64748b'} />
        </div>

        <EstateRing percent={metrics.estatePercent} label={metrics.estateLabel} />
      </div>

      {/* Visible stale-configuration warning (retained last-good layout). */}
      {config.stale && (
        <div className="shrink-0 ow-stale-warning mt-2">
          <i className="ri-error-warning-line text-[12px]" />
          <span>WIDGET CONFIGURATION STALE — SHOWING LAST SAVED LAYOUT</span>
        </div>
      )}

      {/* Site network */}
      <div className="ow-site-network relative flex-1 min-h-0 mt-3 grid grid-rows-3 gap-2">
        <NetworkSpine />

        <SiteGrid hub={hub} slots={slots} />

        {pageCount > 1 && (
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
            <div className="ow-page-dots">
              {Array.from({ length: pageCount }).map((_, i) => (
                <span key={i} className={`ow-page-dot ${i === page ? 'ow-page-dot-active' : ''}`} />
              ))}
            </div>
            <span className="ow-page-label">{page + 1}/{pageCount}</span>
          </div>
        )}
      </div>
    </section>
  );
}