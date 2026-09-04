import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { useBackupData } from '@/pages/ai-operations/wallboard/backupStore';
import { useBusinessData } from '@/pages/ai-operations/wallboard/businessStore';
import { useInfrastructureData } from '@/pages/ai-operations/wallboard/infrastructureStore';
import { usePowerData } from '@/pages/ai-operations/wallboard/powerStore';
import { useSecurityData } from '@/pages/ai-operations/wallboard/securityStore';
import { useSiteMonitorData } from '@/pages/ai-operations/wallboard/siteStore';
import { useWorkloadData } from '@/pages/ai-operations/wallboard/workloadStore';
import { useRuntimeHealth } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import {
  getDailyBriefing,
  type BriefingTone,
  type SystemLine,
  type AttentionItem,
  type RecentChange,
} from '@/pages/ai-operations/wallboard/briefingSelectors';

const SOURCE_BADGE: Record<'live' | 'partial' | 'unavailable', { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  partial: { label: 'Partial', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const TONE_TEXT: Record<BriefingTone, string> = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
  secondary: 'text-secondary-300',
};

const TONE_DOT: Record<BriefingTone, string> = {
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  red: 'bg-red-400',
  secondary: 'bg-secondary-300',
};

function SystemChip({ line }: { line: SystemLine }) {
  const unavailable = line.status === 'unavailable';
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-3 flex flex-col justify-between min-h-[88px]">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${TONE_DOT[line.tone]}`}></span>
        <p className="text-[11px] font-label font-semibold text-foreground-600 uppercase tracking-wide whitespace-nowrap">
          {line.label}
        </p>
      </div>
      <p className={`text-sm font-heading font-semibold leading-snug mt-2 ${unavailable ? 'text-foreground-500' : 'text-foreground-100'}`}>
        {line.detail}
      </p>
    </div>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const tone =
    item.severity === 'high'
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      : 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25';
  return (
    <div className="flex items-start justify-between gap-3 bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-heading font-semibold text-foreground-100 leading-tight">{item.label}</p>
        <p className="text-[11px] font-label text-foreground-600 truncate mt-0.5">{item.detail}</p>
      </div>
      <span className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${item.severity === 'high' ? 'bg-amber-400' : 'bg-secondary-300'}`}></span>
    </div>
  );
}

function ChangeRow({ change }: { change: RecentChange }) {
  return (
    <div className="flex items-center gap-3 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
      <span className="text-[11px] font-label font-semibold text-foreground-500 tabular-nums whitespace-nowrap">{change.time}</span>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[change.tone]}`}></span>
      <p className="text-[12px] font-label text-foreground-200 truncate">{change.text}</p>
    </div>
  );
}

export default function DailyBriefingView() {
  // Subscribe to every source the briefing reads so the view re-renders on the
  // shared 30s refresh (no separate polling of its own).
  useGroupLiveData();
  useBackupData();
  useBusinessData();
  useInfrastructureData();
  usePowerData();
  useSecurityData();
  useSiteMonitorData();
  useWorkloadData();
  useRuntimeHealth();

  const b = getDailyBriefing();
  const data = useGroupLiveData();

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Daily Briefing
          </h3>
          <span className="text-[11px] font-label font-semibold text-accent-400 bg-accent-500/10 border border-accent-500/25 rounded-full px-3 py-0.5 whitespace-nowrap">
            {b.dateLabel}
          </span>
          {!data.loading && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[b.sourceState].cls}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[b.sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600">
          read-only summary · Europe/London day · refresh {data.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Headline */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className={`ri-newspaper-line text-xl w-5 h-5 flex items-center justify-center ${TONE_TEXT[b.headlineTone]}`}></i>
        </span>
        <p className={`text-xl md:text-2xl font-heading font-bold leading-tight ${TONE_TEXT[b.headlineTone]}`}>
          {b.headline}
        </p>
        {b.usersOnlineTotal != null && (
          <div className="ml-auto shrink-0 text-center">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">Users Online</p>
            <p className="text-2xl font-heading font-bold tabular-nums leading-none mt-1 text-foreground-100">
              {b.usersOnlineTotal}
            </p>
          </div>
        )}
      </div>

      {/* Systems strip */}
      <div className="shrink-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-3">
        {b.systems.map((s) => (
          <SystemChip key={s.key} line={s} />
        ))}
      </div>

      {/* Business / Operations / Attention */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0 overflow-y-auto">
        {/* Business */}
        <section className="col-span-4 min-h-0 bg-background-100 border border-background-200/60 rounded-lg flex flex-col">
          <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2 shrink-0">
            <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
              <i className="ri-line-chart-line text-base w-4 h-4 flex items-center justify-center"></i>
            </span>
            <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Business</h4>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2.5">
            {b.business.map((f) => (
              <div key={f.label} className="bg-background-50 border border-background-200/60 rounded-md px-3 py-3">
                <div className="flex items-center gap-1.5">
                  <i className={`${f.icon} text-sm w-3.5 h-3.5 flex items-center justify-center text-foreground-500`}></i>
                  <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{f.label}</p>
                </div>
                <p className={`text-2xl font-heading font-bold tabular-nums leading-none mt-2 ${f.status === 'unavailable' ? 'text-foreground-500' : 'text-foreground-100'}`}>
                  {f.status === 'unavailable' ? '—' : f.value ?? '—'}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Operations */}
        <section className="col-span-4 min-h-0 bg-background-100 border border-background-200/60 rounded-lg flex flex-col">
          <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2 shrink-0">
            <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
              <i className="ri-tools-line text-base w-4 h-4 flex items-center justify-center"></i>
            </span>
            <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Operations</h4>
          </div>
          <div className="p-4 flex flex-col gap-2">
            {b.operations.map((o) => (
              <div key={o.label} className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{o.label}</p>
                <p className={`text-lg font-heading font-bold tabular-nums leading-none ${o.status === 'unavailable' ? 'text-foreground-500' : TONE_TEXT[o.tone]}`}>
                  {o.status === 'unavailable' ? '—' : o.value ?? 0}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Attention required */}
        <section className="col-span-4 min-h-0 bg-background-100 border border-background-200/60 rounded-lg flex flex-col">
          <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2 shrink-0">
            <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
              <i className="ri-alert-line text-base w-4 h-4 flex items-center justify-center"></i>
            </span>
            <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Attention Required</h4>
            {b.hasAttention && (
              <span className="ml-auto inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-amber-500/15 text-amber-400 text-[11px] font-label font-semibold tabular-nums">
                {b.attention.length}
              </span>
            )}
          </div>
          <div className="p-4 flex-1 min-h-0 overflow-y-auto">
            {b.attention.length === 0 ? (
              <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-8 text-center">
                <p className="text-sm font-heading font-semibold text-foreground-200">Nothing requires attention</p>
                <p className="text-[11px] font-label text-foreground-600 mt-1">No unresolved non-critical operational items.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {b.attention.map((a) => (
                  <AttentionRow key={a.key} item={a} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Since yesterday */}
      <div className="shrink-0 mt-3 bg-background-100 border border-background-200/60 rounded-lg">
        <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
          <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
            <i className="ri-history-line text-base w-4 h-4 flex items-center justify-center"></i>
          </span>
          <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Since Yesterday</h4>
          <p className="text-[11px] font-label text-foreground-500 ml-2">derived from the audit trail &amp; lead registry</p>
        </div>
        <div className="p-3">
          {b.recentChanges.length === 0 ? (
            <p className="text-[12px] font-label text-foreground-600 px-1">No recorded changes since yesterday.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {b.recentChanges.map((c) => (
                <ChangeRow key={c.key} change={c} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}