import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getActivityEvents } from '@/pages/ai-operations/live/selectors';
import { SEVERITY, ACTIVITY_SOURCE_LABELS } from '@/pages/ai-operations/constants';
import type { LiveActivityEvent } from '@/pages/ai-operations/types';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

const SOURCE_TABS: { key: string; label: string; sourceType: string | null }[] = [
  { key: 'all', label: 'All', sourceType: null },
  { key: 'agent', label: 'Agents', sourceType: 'agent' },
  { key: 'run', label: 'Runs', sourceType: 'run' },
  { key: 'approval', label: 'Approvals', sourceType: 'approval' },
  { key: 'site', label: 'Sites', sourceType: 'site' },
  { key: 'monitoring', label: 'Alerts', sourceType: 'monitoring' },
  { key: 'uat', label: 'UAT', sourceType: 'uat' },
  { key: 'system', label: 'System', sourceType: 'system' },
];

const SEVERITY_OPTIONS = ['all', 'info', 'low', 'medium', 'high', 'critical'] as const;

function referenceLink(event: LiveActivityEvent) {
  if (!event.referenceId) return null;
  const base =
    event.referenceType === 'run'
      ? '/ai-operations/runs'
      : event.referenceType === 'agent'
        ? '/ai-operations/agents'
        : event.referenceType === 'approval'
          ? '/ai-operations/approvals'
          : event.referenceType === 'site'
            ? '/ai-operations/sites'
            : null;
  if (!base) return null;
  return (
    <Link
      to={`${base}/${event.referenceId}`}
      className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2 py-1 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap"
    >
      Open
    </Link>
  );
}

export default function GroupActivityFeed({ focusMode, paused }: { focusMode: boolean; paused: boolean }) {
  const events = getActivityEvents();
  const [sourceType, setSourceType] = useState<string | null>(null);
  const [site, setSite] = useState('');
  const [severity, setSeverity] = useState<string>('all');

  const sites = useMemo(() => {
    const set = new Set(events.map((e) => e.site));
    return Array.from(set);
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (sourceType && e.sourceType !== sourceType) return false;
      if (site && e.site !== site) return false;
      if (severity !== 'all' && e.severity !== severity) return false;
      return true;
    });
  }, [events, sourceType, site, severity]);

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Group Activity Feed</h3>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-emerald-400">
          <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${paused ? '' : 'animate-pulse'}`}></span>
          {paused ? 'Paused' : 'Live'}
        </span>
      </div>

      {!focusMode && (
        <div className="px-4 py-3 border-b border-background-200/40 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {SOURCE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSourceType(tab.sourceType)}
                className={`text-xs font-label rounded-full px-2.5 py-1 border transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                  sourceType === tab.sourceType
                    ? 'bg-accent-500/15 text-accent-400 border-accent-500/30'
                    : 'text-foreground-400 border-background-300/40 hover:text-foreground-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2.5">
            <select
              value={site}
              onChange={(e) => setSite(e.target.value)}
              className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-1.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer"
              aria-label="Filter by site"
            >
              <option value="">Site: All</option>
              {sites.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-1.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer"
              aria-label="Filter by severity"
            >
              {SEVERITY_OPTIONS.map((s) => (
                <option key={s} value={s}>{s === 'all' ? 'Severity: All' : SEVERITY[s as keyof typeof SEVERITY].label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="divide-y divide-background-200/40 max-h-[520px] overflow-y-auto">
        {filtered.map((event) => {
          const severityDisplay = SEVERITY[event.severity];
          return (
            <div key={event.id} className="px-4 py-3 hover:bg-background-200/30 transition-colors duration-150">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-label text-foreground-600 tabular-nums whitespace-nowrap">{event.timestamp}</span>
                    <span className="text-[10px] font-label text-foreground-500 bg-background-200/50 rounded px-1.5 py-0.5 whitespace-nowrap">
                      {ACTIVITY_SOURCE_LABELS[event.sourceType]}
                    </span>
                    <span className="text-xs font-medium text-foreground-200">{event.site}</span>
                    <span className="text-foreground-600">&middot;</span>
                    <span className="text-xs text-foreground-400">{event.actor}</span>
                  </div>
                  <p className="text-sm text-foreground-300 mt-0.5">{event.event}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusPill tone={severityDisplay.tone} label={severityDisplay.label} />
                  {referenceLink(event)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}