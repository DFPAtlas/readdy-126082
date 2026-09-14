// ============================================================================
// DFP COMMAND 10 — MONITORING PANELS + SHARED BUILDING BLOCKS
// ============================================================================
import type { ReactNode } from 'react';
import { formatRelative } from '../utils';
import type { ComponentState, NormalizedSeverity, MonitorSource } from '../monitoringTypes';
import { COMPONENT_STATE_STYLES, SEVERITY_STYLES } from '../monitoringTypes';
import { freshness, STALE_THRESHOLD_HOURS } from '../monitoringUtils';

// ─── Badges ────────────────────────────────────────────────────────────────

export function MonitorStateBadge({ state }: { state: ComponentState }) {
  return (
    <span className={`inline-block text-[10px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${COMPONENT_STATE_STYLES[state]}`}>
      {state}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: NormalizedSeverity }) {
  return (
    <span className={`inline-block text-[10px] font-label px-2 py-0.5 rounded-full uppercase whitespace-nowrap ${SEVERITY_STYLES[severity]}`}>
      {severity}
    </span>
  );
}

export function FreshnessBadge({ lastCheckedAt }: { lastCheckedAt: string | null | undefined }) {
  const f = freshness(lastCheckedAt);
  if (f === 'none') {
    return <span className="text-[10px] text-foreground-500 whitespace-nowrap">never checked</span>;
  }
  if (f === 'stale') {
    return (
      <span className="inline-block text-[10px] font-label px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 whitespace-nowrap">
        STALE DATA
      </span>
    );
  }
  return (
    <span className="text-[10px] text-foreground-500 whitespace-nowrap">
      {lastCheckedAt ? formatRelative(lastCheckedAt) : '—'}
    </span>
  );
}

// ─── Panel wrapper ──────────────────────────────────────────────────────────

export function Panel({
  title,
  icon,
  source,
  actions,
  children,
}: {
  title: string;
  icon: string;
  source?: MonitorSource;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-background-200/60 flex items-center justify-center">
            <i className={`${icon} text-sm text-foreground-400 w-4 h-4 flex items-center justify-center`}></i>
          </div>
          <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">{title}</h4>
          {source && (
            <span className="text-[9px] font-label text-foreground-500 bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">
              {source}
            </span>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function FieldRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-sm text-foreground-200 truncate ${mono ? 'font-mono' : ''}`} title={value ?? undefined}>
        {value || '—'}
      </p>
    </div>
  );
}

export function EmptyNote({ text, icon = 'ri-information-line' }: { text: string; icon?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-foreground-500">
      <i className={`${icon} w-4 h-4 flex items-center justify-center text-foreground-600`}></i>
      {text}
    </div>
  );
}

export function SourceUnavailableNote({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-amber-400">
      <i className="ri-alert-line w-4 h-4 flex items-center justify-center"></i>
      {text}
    </div>
  );
}

export function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-100 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer"
    >
      <i className="ri-external-link-line w-3.5 h-3.5 flex items-center justify-center"></i>
      {label}
    </a>
  );
}

// ─── Staleness legend note ──────────────────────────────────────────────────

export function StalenessNote() {
  return (
    <p className="text-[10px] text-foreground-600">
      STALE marks last-check age &gt; {STALE_THRESHOLD_HOURS}h. Configured ≠ healthy — no state is assumed from
      configuration alone.
    </p>
  );
}