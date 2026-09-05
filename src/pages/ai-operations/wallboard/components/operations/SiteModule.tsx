import { useEffect, useRef, useState } from 'react';
import {
  brandAccent,
  toneHex,
  type SiteModule as SiteModuleData,
  type SiteHeartbeat,
  type Tone,
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

function sslLabel(s: 'valid' | 'warning' | 'expired' | null): string | null {
  switch (s) {
    case 'valid':
      return 'VALID';
    case 'warning':
      return 'WARNING';
    case 'expired':
      return 'EXPIRED';
    default:
      return null;
  }
}

/** Compact secondary heartbeat — monitoring signal, not operational state. */
function Heartbeat({ hb }: { hb: SiteHeartbeat }) {
  const tone = toneHex(hb.tone);
  const live = hb.state === 'live';
  return (
    <span className="flex items-center gap-1 text-[8px] font-label tracking-[0.08em] whitespace-nowrap" style={{ color: tone }}>
      <span className={`w-3 h-3 flex items-center justify-center ${live ? 'ow-pulse' : ''}`}>
        <i className="ri-heart-pulse-line text-[11px]" style={{ color: tone }} />
      </span>
      <span className="font-semibold">{hb.label}</span>
      {hb.age ? <span className="font-mono text-slate-500">· {hb.age}</span> : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Live site module — shared compact live-operations panel (header + services
// + metrics + footer) used by every non-DFP site card.
// ---------------------------------------------------------------------------

/** Per-site identity icon — one consistent Remix outline family across the wall. */
const SITE_IDENTITY_ICON: Record<string, string> = {
  quickguard: 'ri-shield-line',
  guardianhub: 'ri-shield-check-line',
  buildnerve: 'ri-flask-line',
  lethub: 'ri-building-line',
  garageflow: 'ri-car-line',
  vowora: 'ri-heart-2-line',
  synqoro: 'ri-brain-line',
};

/** Human-readable age ("2s", "3m", "1h", "2d") for a heartbeat timestamp. */
function ageLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  let diff = Date.now() - d.getTime();
  if (diff < 0) diff = 0;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

/**
 * Heartbeat indicator — pulses ONCE when a new timestamp arrives, then rests
 * static. Colour alone never carries the signal: green = fresh, amber = stale,
 * red = confirmed failure, grey = unmonitored/unknown.
 */
function HeartbeatDot({ signal, tone }: { signal: string | null; tone: Tone }) {
  const [pulseId, setPulseId] = useState(0);
  const prev = useRef<string | null>(signal);

  useEffect(() => {
    if (signal && signal !== prev.current) {
      setPulseId((n) => n + 1);
    }
    prev.current = signal;
  }, [signal]);

  return (
    <span
      key={pulseId}
      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${pulseId > 0 ? 'ow-hb-pulse' : ''}`}
      style={{ background: toneHex(tone) }}
    />
  );
}

function ServicePanel({
  icon,
  label,
  status,
  tone,
  signal,
  primary,
  secondary,
  secondaryTone,
  accent,
}: {
  icon: string;
  label: string;
  status: string;
  tone: Tone;
  signal: string | null;
  primary: string | null;
  secondary?: string | null;
  secondaryTone?: Tone;
  accent: string;
}) {
  const color = toneHex(tone);
  const secondaryColor = secondaryTone ? toneHex(secondaryTone) : '#64748b';
  return (
    <div className="flex flex-col min-w-0 leading-none px-1.5 py-1" style={{ background: 'rgba(7,13,26,0.55)', border: `1px solid ${accent}14` }}>
      <div className="flex items-center gap-1">
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          <i className={`${icon} text-[12px]`} style={{ color }} />
        </span>
        <span className="text-[6.5px] font-label tracking-[0.12em] text-slate-500 whitespace-nowrap">{label}</span>
      </div>
      <div className="flex items-center gap-1 mt-1">
        <HeartbeatDot signal={signal} tone={tone} />
        <span className="text-[9px] font-semibold tracking-[0.04em] truncate" style={{ color }}>{status}</span>
      </div>
      <div className="flex items-center gap-1 mt-0.5">
        <span className="font-mono text-[8px] text-slate-300 tabular-nums whitespace-nowrap">{primary ?? '—'}</span>
        {secondary != null && (
          <span className="font-mono text-[7px] tabular-nums whitespace-nowrap" style={{ color: secondaryColor }}>· {secondary}</span>
        )}
      </div>
    </div>
  );
}

function MetricCell({
  icon,
  count,
  label,
  tone,
}: {
  icon: string;
  count: number | null;
  label: string;
  tone: Tone;
}) {
  const color = count == null ? '#64748b' : toneHex(tone);
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0 leading-none">
      <span className="w-4 h-4 flex items-center justify-center">
        <i className={`${icon} text-[12px]`} style={{ color }} />
      </span>
      <span className="font-mono text-[14px] font-semibold tabular-nums" style={{ color }}>
        {count == null ? '—' : count}
      </span>
      <span className="text-[6.5px] font-label tracking-[0.1em] text-slate-500 whitespace-nowrap">{label}</span>
    </div>
  );
}

type SiteAssessment = { tone: Tone; label: string; footer: string };

/**
 * Combine website + database + n8n into a single honest overall assessment.
 * Never HEALTHY unless every configured signal is fresh and healthy; failures
 * outrank staleness, staleness outranks monitoring gaps.
 */
function assessSite(site: SiteModuleData): SiteAssessment {
  const issues: { tone: Tone; text: string }[] = [];

  // Website
  const web = site.heartbeat;
  if (web.state === 'no_heartbeat' && web.tone === 'red') {
    issues.push({ tone: 'red', text: 'Website offline' });
  } else if (web.state === 'stale') {
    issues.push({ tone: 'amber', text: 'Website check stale' });
  } else if (web.state === 'not_monitored' || web.state === 'no_heartbeat') {
    issues.push({ tone: 'muted', text: 'Website not monitored' });
  }

  // Database
  const db = site.database;
  if (db) {
    switch (db.status) {
      case 'offline':
        issues.push({ tone: 'red', text: 'Database unavailable' });
        break;
      case 'check_error':
        issues.push({ tone: 'red', text: 'Database check error' });
        break;
      case 'stale':
        issues.push({ tone: 'amber', text: 'Database heartbeat overdue' });
        break;
      case 'degraded':
        issues.push({ tone: 'amber', text: 'Database degraded' });
        break;
      case 'unknown':
        issues.push({ tone: 'muted', text: 'Database status unknown' });
        break;
      case 'not_configured':
        issues.push({ tone: 'muted', text: 'Database not configured' });
        break;
      default:
        break;
    }
  }

  // n8n — service reachability, then workflow errors (distinct signals).
  const n8n = site.n8n;
  switch (n8n.status) {
    case 'offline':
      issues.push({ tone: 'red', text: 'n8n unreachable' });
      break;
    case 'degraded':
      issues.push({ tone: 'amber', text: 'n8n degraded' });
      break;
    case 'unknown':
      issues.push({ tone: 'muted', text: 'n8n status unknown' });
      break;
    case 'not_configured':
      issues.push({ tone: 'muted', text: 'n8n not configured' });
      break;
    default:
      break;
  }
  if (n8n.workflowErrors != null && n8n.workflowErrors > 0) {
    issues.push({ tone: 'amber', text: 'Automation workflow errors' });
  }

  const red = issues.find((i) => i.tone === 'red');
  const amber = issues.find((i) => i.tone === 'amber');
  const muted = issues.find((i) => i.tone === 'muted');

  if (red) return { tone: 'red', label: 'CRITICAL', footer: red.text };
  if (amber) return { tone: 'amber', label: 'DEGRADED', footer: amber.text };
  if (muted) return { tone: 'muted', label: 'INCOMPLETE', footer: 'Monitoring incomplete' };
  return { tone: 'green', label: 'HEALTHY', footer: 'All systems healthy' };
}

function LiveSiteModule({ site, accent }: { site: SiteModuleData; accent: { color: string; borderColor: string; boxShadow: string } }) {
  const dim = site.state === 'not_configured';
  const overall = assessSite(site);
  const overallColor = toneHex(overall.tone);
  const identityIcon = SITE_IDENTITY_ICON[site.key] ?? 'ri-apps-2-line';

  // Website
  const webStatus = site.heartbeat.label;
  const webTone = site.heartbeat.tone;
  const webRt = site.responseTimeMs != null ? `${site.responseTimeMs} ms` : null;

  // Database
  const db = site.database;
  const dbStatus = db?.status ?? 'not_configured';
  const dbLabel =
    dbStatus === 'healthy' ? 'HEALTHY'
      : dbStatus === 'degraded' ? 'DEGRADED'
        : dbStatus === 'offline' ? 'OFFLINE'
          : dbStatus === 'stale' ? 'STALE'
            : dbStatus === 'check_error' ? 'CHECK ERROR'
              : dbStatus === 'not_configured' ? 'NOT CONFIGURED'
                : 'UNKNOWN';
  const dbTone: Tone =
    dbStatus === 'healthy' ? 'green'
      : dbStatus === 'offline' ? 'red'
        : dbStatus === 'stale' || dbStatus === 'degraded' || dbStatus === 'check_error' ? 'amber'
          : 'muted';
  const dbAge = ageLabel(db?.lastHeartbeatAt);

  // n8n
  const n8n = site.n8n;
  const n8nAge = ageLabel(n8n.lastSuccessAt);
  const n8nErr = n8n.workflowErrors != null && n8n.workflowErrors > 0 ? `${n8n.workflowErrors} err` : null;

  // Counts
  const users = site.users;
  const agents = site.agents;
  const alerts = site.alerts;
  const alertsTone: Tone = alerts == null ? 'muted' : alerts > 0 ? 'red' : 'green';
  const agentsTone: Tone = agents == null ? 'muted' : 'green';
  const usersTone: Tone = users == null ? 'muted' : 'green';

  return (
    <div
      className="ow-panel ow-site-module relative flex flex-col px-2 py-1.5 min-w-0"
      style={{ borderColor: accent.borderColor, boxShadow: dim ? 'none' : accent.boxShadow, opacity: dim ? 0.55 : 1 }}
    >
      <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px]" style={{ background: accent.color }} />

      {/* 1. Header */}
      <div className="flex items-center gap-1.5 min-w-0 leading-none">
        <span className="w-6 h-6 flex items-center justify-center shrink-0 border rounded-sm" style={{ borderColor: accent.color, background: `${accent.color}16` }}>
          <i className={`${identityIcon} text-[14px]`} style={{ color: accent.color }} />
        </span>
        <div className="min-w-0 leading-none">
          <div className="text-[12px] font-semibold tracking-[0.04em] truncate" style={{ color: accent.color }}>
            {site.name}
          </div>
          <div className="text-[6.5px] font-label tracking-[0.18em] text-slate-500 truncate">{site.subtitle}</div>
        </div>
        <span
          className="ml-auto shrink-0 text-[7px] font-semibold tracking-[0.08em] px-1.5 py-0.5 border rounded-full whitespace-nowrap"
          style={{ color: overallColor, borderColor: `${overallColor}66`, background: `${overallColor}14` }}
        >
          {overall.label}
        </span>
      </div>

      {/* 2. Three service panels */}
      <div className="grid grid-cols-3 gap-1.5 mt-1.5">
        <ServicePanel
          icon="ri-global-line"
          label="WEBSITE"
          status={webStatus}
          tone={webTone}
          signal={site.lastCheckAt}
          primary={webRt}
          accent={accent.color}
        />
        <ServicePanel
          icon="ri-database-2-line"
          label="DATABASE"
          status={dbLabel}
          tone={dbTone}
          signal={db?.lastHeartbeatAt ?? null}
          primary={db?.latencyMs != null ? `${db.latencyMs} ms` : '—'}
          secondary={dbAge ? `${dbAge} ago` : null}
          accent={accent.color}
        />
        <ServicePanel
          icon="ri-flow-chart"
          label="N8N"
          status={n8n.label}
          tone={n8n.tone}
          signal={n8n.lastSuccessAt}
          primary={n8nAge ? `${n8nAge} ago` : '—'}
          secondary={n8nErr}
          secondaryTone="amber"
          accent={accent.color}
        />
      </div>

      {/* 3. Three metric cells */}
      <div className="grid grid-cols-3 gap-1.5 mt-1.5 pt-1.5 border-t" style={{ borderColor: `${accent.color}1A` }}>
        <MetricCell icon="ri-group-line" count={users} label="USERS ONLINE" tone={usersTone} />
        <MetricCell icon="ri-robot-2-line" count={agents} label="REGISTERED AGENTS" tone={agentsTone} />
        <MetricCell icon="ri-alert-line" count={alerts} label="ACTIVE ALERTS" tone={alertsTone} />
      </div>

      {/* 4. Footer */}
      <div
        className="mt-1.5 pt-1 border-t truncate text-[7px] font-label tracking-[0.04em] leading-none"
        style={{ borderColor: `${accent.color}1A`, color: overall.tone === 'green' ? '#4ade80' : overallColor }}
      >
        {overall.footer}
      </div>
    </div>
  );
}

/**
 * A single site module in the connected ecosystem. The central DFP hub keeps
 * its own dedicated rendering path (never altered by shared changes); every
 * other site card uses the shared live-operations panel, preserving each
 * site's own brand colour on the outer accent / icon / title / glow.
 */
export default function SiteModule({ site }: { site: SiteModuleData }) {
  const accent = brandAccent(site.color);
  const health = toneHex(site.stateTone);

  if (site.hub) {
    return <HubModule site={site} accent={accent} health={health} />;
  }

  return <LiveSiteModule site={site} accent={accent} />;
}

function HubModule({ site, accent, health }: { site: SiteModuleData; accent: { color: string; borderColor: string; boxShadow: string }; health: string }) {
  return (
    <div
      className="ow-panel ow-glow-cyan ow-site-module relative flex flex-col items-center justify-center px-4 py-2 min-w-0"
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
        <Heartbeat hb={site.heartbeat} />
      </div>

      <div className="flex items-center justify-center gap-4 mt-1 text-[7.5px] font-label tracking-[0.1em] text-slate-500">
        <span className="font-mono">RT {site.responseTimeMs != null ? `${site.responseTimeMs}ms` : '—'}</span>
        <span className="font-mono">SSL {sslLabel(site.sslStatus) ?? '—'}</span>
      </div>

      <div className="flex items-center justify-center gap-5 mt-2 pt-2 w-full border-t border-cyan-400/10">
        {metric('USERS', site.users, '#67e8f9')}
        {metric('AGENTS', site.agents, '#a5b4fc')}
        {metric('ALERTS', site.alerts, site.alerts != null && site.alerts > 0 ? '#ef4444' : '#64748b')}
      </div>
    </div>
  );
}