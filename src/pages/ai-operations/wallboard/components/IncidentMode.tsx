import { useState } from 'react';
import type {
  WallboardIncident,
  WallboardIncidentSeverity,
} from '@/pages/ai-operations/wallboard/selectors';
import CriticalAlerts from '@/pages/ai-operations/wallboard/components/CriticalAlerts';
import GroupSiteStatus from '@/pages/ai-operations/wallboard/components/GroupSiteStatus';

const SEVERITY_META: Record<
  WallboardIncidentSeverity,
  { label: string; badge: string; dot: string; text: string }
> = {
  critical: {
    label: 'CRITICAL',
    badge: 'text-red-400 bg-red-500/15 border-red-500/40',
    dot: 'bg-red-400',
    text: 'text-red-400',
  },
  high: {
    label: 'HIGH',
    badge: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    dot: 'bg-amber-400',
    text: 'text-amber-400',
  },
  warning: {
    label: 'WARNING',
    badge: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    dot: 'bg-amber-400',
    text: 'text-amber-400',
  },
  info: {
    label: 'INFO',
    badge: 'text-secondary-400 bg-secondary-500/10 border-secondary-500/25',
    dot: 'bg-secondary-400',
    text: 'text-secondary-400',
  },
};

function humaniseStatus(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface IncidentModeProps {
  incidents: WallboardIncident[];
  criticalCount: number;
}

export default function IncidentMode({ incidents, criticalCount }: IncidentModeProps) {
  const [focus, setFocus] = useState(0);
  const count = incidents.length;
  const clamped = Math.min(focus, Math.max(count - 1, 0));
  const focused = count > 0 ? incidents[clamped] : null;
  const highCount = incidents.filter((i) => i.severity === 'high').length;

  const next = () => setFocus((f) => (Math.min(f, count - 1) + 1) % count);
  const prev = () => setFocus((f) => (Math.min(f, count - 1) - 1 + count) % count);

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      {/* INCIDENT MODE banner */}
      <div className="shrink-0 border-2 border-red-500/50 bg-red-500/5 rounded-lg px-5 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-red-500/15 rounded-lg flex items-center justify-center shrink-0">
              <i className="ri-error-warning-line text-red-400 text-2xl w-7 h-7 flex items-center justify-center"></i>
            </div>
            <div>
              <p className="text-2xl font-heading font-bold text-red-400 leading-none tracking-wide whitespace-nowrap">
                INCIDENT MODE
              </p>
              <p className="text-sm font-label text-red-300/80 mt-1">
                {criticalCount} CRITICAL INCIDENT{criticalCount > 1 ? 'S' : ''}
                {highCount > 0 ? ` · ${highCount} high` : ''} · Action required
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-label text-foreground-300">
            <span className="text-foreground-600">Incident</span>
            <span className="text-foreground-100 tabular-nums whitespace-nowrap">
              {clamped + 1} of {count}
            </span>
            <button
              onClick={prev}
              className="w-8 h-8 flex items-center justify-center rounded-md border border-background-200/60 text-foreground-300 hover:text-red-300 hover:border-red-500/40 transition-colors cursor-pointer"
              aria-label="Previous incident"
              title="Previous incident"
            >
              <i className="ri-arrow-left-s-line w-4 h-4 flex items-center justify-center"></i>
            </button>
            <button
              onClick={next}
              className="w-8 h-8 flex items-center justify-center rounded-md border border-background-200/60 text-foreground-300 hover:text-red-300 hover:border-red-500/40 transition-colors cursor-pointer"
              aria-label="Next incident"
              title="Next incident"
            >
              <i className="ri-arrow-right-s-line w-4 h-4 flex items-center justify-center"></i>
            </button>
          </div>
        </div>

        {focused && (
          <div className="mt-4 grid grid-cols-12 gap-4">
            <div className="col-span-8 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 border text-xs font-label font-semibold ${SEVERITY_META[focused.severity].badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_META[focused.severity].dot}`}></span>
                  {SEVERITY_META[focused.severity].label}
                </span>
                <span className="text-xs font-label text-foreground-500">{focused.sourceLabel}</span>
                {focused.acknowledged != null && (
                  <span
                    className={`text-xs font-label rounded-full px-2 py-0.5 border whitespace-nowrap ${
                      focused.acknowledged
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                        : 'text-amber-400 bg-amber-500/10 border-amber-500/25'
                    }`}
                  >
                    {focused.acknowledged ? 'ACKNOWLEDGED' : 'UNACKNOWLEDGED'}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-heading font-semibold text-foreground-50 mt-2 leading-snug">
                {focused.title}
              </h2>
              {focused.description && (
                <p className="text-sm text-foreground-200 mt-1.5">{focused.description}</p>
              )}
            </div>
            <div className="col-span-4 min-w-0 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-[11px] font-label text-foreground-600 uppercase">Affected</p>
                <p className="text-foreground-100 font-medium">{focused.affectedService}</p>
              </div>
              <div>
                <p className="text-[11px] font-label text-foreground-600 uppercase">Status</p>
                <p className="text-foreground-100 font-medium">{humaniseStatus(focused.status)}</p>
              </div>
              <div>
                <p className="text-[11px] font-label text-foreground-600 uppercase">First detected</p>
                <p className="text-foreground-100 font-medium tabular-nums">{focused.firstDetected}</p>
              </div>
              <div>
                <p className="text-[11px] font-label text-foreground-600 uppercase">Last updated</p>
                <p className="text-foreground-100 font-medium tabular-nums">{focused.lastUpdated}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Still-usable overview alongside the incident queue */}
      <div className="grid grid-cols-12 gap-3 mt-3 flex-1 min-h-0">
        <div className="col-span-5 min-h-0 flex flex-col bg-background-100 border border-background-200/60 rounded-lg">
          <div className="px-4 py-3 border-b border-background-200/60 shrink-0">
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
              Active Incidents
            </h3>
          </div>
          <div className="divide-y divide-background-200/40 overflow-y-auto">
            {incidents.map((inc, idx) => (
              <button
                key={inc.id}
                onClick={() => setFocus(idx)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer ${
                  idx === clamped ? 'bg-red-500/5' : 'hover:bg-background-200/30'
                }`}
              >
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${SEVERITY_META[inc.severity].dot}`}></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground-100 truncate">{inc.title}</p>
                  <p className="text-[11px] font-label text-foreground-500 mt-0.5">
                    {inc.affectedService} · {inc.sourceLabel} · {inc.firstDetected}
                  </p>
                </div>
                <span className={`text-[10px] font-label font-semibold shrink-0 whitespace-nowrap ${SEVERITY_META[inc.severity].text}`}>
                  {SEVERITY_META[inc.severity].label}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="col-span-7 min-h-0 flex flex-col gap-3">
          <div className="flex-1 min-h-0">
            <CriticalAlerts />
          </div>
          <div className="flex-1 min-h-0">
            <GroupSiteStatus />
          </div>
        </div>
      </div>
    </main>
  );
}