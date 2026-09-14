import { Link } from 'react-router-dom';
import type { LiveSummary, LiveOpsItem } from '../executiveTypes';
import { HEALTH_STATE_LABELS, HEALTH_STATE_STYLES } from '@/pages/projects/portfolioTypes';
import { SectionHeading, Unavailable, EmptyNote } from './shared';

const UNHEALTHY = new Set(['CRITICAL', 'OFFLINE', 'DEGRADED', 'UNKNOWN']);

export default function LiveOperationsPanel({
  summary,
  items,
  available,
}: {
  summary: LiveSummary;
  items: LiveOpsItem[];
  available: boolean;
}) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-5">
      <SectionHeading
        icon="ri-earth-line"
        title="Live Operations"
        action={{ label: 'Open Operations', to: '/ai-operations/live' }}
      />

      {!available ? (
        <Unavailable label="Live operations data unavailable" />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
            <Count label="Live" value={summary.live} tone="text-foreground-50" />
            <Count label="Healthy" value={summary.healthy} tone="text-emerald-400" />
            <Count label="Degraded" value={summary.degraded} tone="text-amber-400" />
            <Count label="Critical" value={summary.critical} tone="text-red-400" />
            <Count label="Offline" value={summary.offline} tone="text-red-400" />
            <Count label="Unknown" value={summary.unknown} tone="text-foreground-400" />
          </div>

          <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide mb-2">
            Unhealthy live projects
          </p>
          {items.filter((i) => UNHEALTHY.has(i.healthState)).length === 0 ? (
            <EmptyNote>All live projects are healthy.</EmptyNote>
          ) : (
            <div className="space-y-2">
              {items.filter((i) => UNHEALTHY.has(i.healthState)).slice(0, 5).map((i) => (
                <Link
                  key={i.projectSlug}
                  to={`/projects/${i.projectSlug}?section=operations`}
                  className="flex items-center gap-3 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-lg px-3 py-2.5 transition-colors cursor-pointer"
                >
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-label whitespace-nowrap shrink-0 ${HEALTH_STATE_STYLES[i.healthState as keyof typeof HEALTH_STATE_STYLES] ?? ''}`}>
                    {HEALTH_STATE_LABELS[i.healthState as keyof typeof HEALTH_STATE_LABELS] ?? i.healthState}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground-100 font-medium truncate">{i.projectName}</p>
                    <p className="text-[11px] text-foreground-500 truncate">
                      {i.activeIncident !== 'None' ? i.activeIncident : 'No active incident'} · Release {i.currentRelease}
                    </p>
                  </div>
                  <span className="text-[10px] text-foreground-600 whitespace-nowrap shrink-0">{i.lastCheck}</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="bg-background-50 border border-background-200/50 rounded-md px-3 py-2">
      <p className="text-[9px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-lg font-heading font-bold leading-none ${tone}`}>{value}</p>
    </div>
  );
}