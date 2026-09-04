import {
  brandAccent,
  toneHex,
  type SiteModule as SiteModuleData,
} from '@/pages/ai-operations/wallboard/operationsWallSelectors';

function metric(label: string, value: number | null, accent: string) {
  return (
    <div className="flex flex-col items-center leading-none">
      <span className="font-mono text-[13px] font-semibold tabular-nums" style={{ color: accent }}>
        {value == null ? '—' : value}
      </span>
      <span className="text-[7.5px] font-label tracking-[0.2em] text-slate-500 mt-0.5">{label}</span>
    </div>
  );
}

/**
 * A single site module in the connected ecosystem. The site's own brand colour
 * is preserved on the outer accent / icon / title / glow, independently of its
 * health state (which is shown as a separate ONLINE/DEGRADED/OFFLINE label).
 */
export default function SiteModule({ site }: { site: SiteModuleData }) {
  const accent = brandAccent(site.color);
  const health = toneHex(site.stateTone);

  if (site.hub) {
    return <HubModule site={site} accent={accent} health={health} />;
  }

  const dim = site.state === 'not_configured';

  return (
    <div
      className="ow-panel relative flex flex-col px-3 py-2 min-w-0"
      style={{ borderColor: accent.borderColor, boxShadow: dim ? 'none' : accent.boxShadow, opacity: dim ? 0.55 : 1 }}
    >
      {/* left accent bar */}
      <span className="absolute left-0 top-2 bottom-2 w-[2px]" style={{ background: accent.color }} />

      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-6 h-6 shrink-0 flex items-center justify-center border rounded-sm font-bold text-[11px]"
          style={{ borderColor: accent.color, color: accent.color, background: `${accent.color}14` }}
        >
          {site.shortCode}
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-[13px] font-semibold tracking-[0.04em] truncate" style={{ color: accent.color }}>
            {site.name}
          </div>
          <div className="text-[7.5px] font-label tracking-[0.16em] text-slate-500 truncate">
            {site.subtitle}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <span className="text-[9px] font-label tracking-[0.14em] whitespace-nowrap" style={{ color: health }}>
          {site.stateLabel}
        </span>
        <span
          className={`w-1.5 h-1.5 rounded-full ${site.stateTone === 'red' ? 'ow-alert' : site.stateTone === 'green' ? 'ow-pulse' : ''}`}
          style={{ background: health }}
        />
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-cyan-400/10">
        {metric('USERS', site.users, '#67e8f9')}
        {metric('AGENTS', site.agents, '#a5b4fc')}
        {metric('ALERTS', site.alerts, site.alerts != null && site.alerts > 0 ? '#ef4444' : '#64748b')}
      </div>
    </div>
  );
}

function HubModule({ site, accent, health }: { site: SiteModuleData; accent: { color: string; borderColor: string; boxShadow: string }; health: string }) {
  return (
    <div
      className="ow-panel ow-glow-cyan relative flex flex-col items-center justify-center px-4 py-2 min-w-0"
      style={{ borderColor: accent.borderColor }}
    >
      <span className="absolute left-0 top-0 w-full h-[2px]" style={{ background: `linear-gradient(90deg, ${accent.color}, transparent)` }} />

      <div className="flex items-center gap-3">
        <span
          className="w-9 h-9 flex items-center justify-center border rounded-md font-bold text-[15px]"
          style={{ borderColor: accent.color, color: accent.color, background: `${accent.color}16`, boxShadow: accent.boxShadow }}
        >
          {site.shortCode}
        </span>
        <div className="text-left leading-tight">
          <div className="text-[16px] font-bold tracking-[0.06em]" style={{ color: accent.color }}>
            {site.name}
          </div>
          <div className="text-[8px] font-label tracking-[0.2em] text-slate-400">{site.subtitle}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <span className="text-[9.5px] font-label tracking-[0.14em]" style={{ color: health }}>
          {site.stateLabel}
        </span>
        <span
          className={`w-1.5 h-1.5 rounded-full ${site.stateTone === 'green' ? 'ow-pulse' : site.stateTone === 'red' ? 'ow-alert' : ''}`}
          style={{ background: health }}
        />
      </div>

      <div className="flex items-center justify-center gap-5 mt-2 pt-2 w-full border-t border-cyan-400/10">
        {metric('USERS', site.users, '#67e8f9')}
        {metric('AGENTS', site.agents, '#a5b4fc')}
        {metric('ALERTS', site.alerts, site.alerts != null && site.alerts > 0 ? '#ef4444' : '#64748b')}
      </div>
    </div>
  );
}