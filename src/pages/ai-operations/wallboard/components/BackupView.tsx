import { useBackupData } from '@/pages/ai-operations/wallboard/backupStore';
import {
  getBackupSummary,
  getBackupTargets,
  getRestoreReadiness,
  getBackupGaps,
  BACKUP_STATE_META,
  type BackupState,
  type BackupTargetView,
} from '@/pages/ai-operations/wallboard/backupSelectors';

const STATE_TEXT: Record<BackupState, string> = {
  current: 'text-emerald-400',
  due: 'text-amber-400',
  failed: 'text-red-400',
  stale: 'text-amber-400',
  never_backed_up: 'text-red-400',
  unknown: 'text-secondary-300',
};

const STATE_BADGE: Record<BackupState, string> = {
  current: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  due: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  failed: 'text-red-400 bg-red-500/10 border-red-500/30',
  stale: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  never_backed_up: 'text-red-400 bg-red-500/10 border-red-500/30',
  unknown: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
};

const SOURCE_BADGE: Record<'live' | 'partial' | 'unavailable', { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  partial: { label: 'Partial', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const TONE_TEXT: Record<'emerald' | 'amber' | 'red' | 'secondary', string> = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
  secondary: 'text-secondary-300',
};

function fmtSeen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function StatusBadge({ state }: { state: BackupState }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border text-[10px] font-label font-semibold whitespace-nowrap ${STATE_BADGE[state]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {BACKUP_STATE_META[state].label}
    </span>
  );
}

function TargetTile({ target }: { target: BackupTargetView }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-4 flex flex-col min-h-[150px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{target.name}</p>
          <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide mt-0.5 whitespace-nowrap">
            {target.provider ?? 'Backup'} · {target.type}
          </p>
        </div>
        <StatusBadge state={target.state} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Metric label="Last success" value={fmtSeen(target.lastSuccess)} />
        <Metric label="Age" value={target.age} />
        <Metric label="Verification" value={target.verification} />
      </div>

      <div className="mt-auto pt-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-label text-foreground-600 uppercase truncate">
          {target.note ?? 'No live health signal'}
        </p>
        {target.verifiedAt && (
          <span className="inline-flex items-center gap-1 text-[10px] font-label font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-shield-check-line w-3 h-3 flex items-center justify-center"></i>
            {fmtSeen(target.verifiedAt)}
          </span>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-label text-foreground-600 uppercase">{label}</p>
      <p className="text-sm font-heading font-semibold text-foreground-100 tabular-nums mt-0.5 whitespace-nowrap">{value}</p>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string | null }) {
  const v = value ?? '—';
  const failed = v.toLowerCase().includes('fail');
  const pending = v.toLowerCase().includes('pending') || v.toLowerCase() === 'not_run';
  return (
    <div className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
      <p className="text-[11px] font-label text-foreground-600 uppercase whitespace-nowrap">{label}</p>
      <p
        className={`text-sm font-heading font-semibold whitespace-nowrap ${
          failed ? 'text-red-400' : pending ? 'text-amber-400' : 'text-emerald-400'
        }`}
      >
        {v}
      </p>
    </div>
  );
}

export default function BackupView() {
  const backup = useBackupData();
  const summary = getBackupSummary();
  const targets = getBackupTargets();
  const readiness = getRestoreReadiness();
  const gaps = getBackupGaps();

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Backups &amp; Recovery
          </h3>
          {!backup.loading && (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[summary.sourceState].cls}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[summary.sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600">
          read-only monitoring · last refresh {backup.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Summary strip — readable from across the room */}
      <div className="shrink-0 grid grid-cols-3 md:grid-cols-6 gap-2.5 mb-3">
        <SummaryStat label="Targets" value={summary.total} tone="text-foreground-100" icon="ri-archive-line" />
        <SummaryStat label="Current" value={summary.current} tone="text-emerald-400" icon="ri-check-double-line" />
        <SummaryStat label="Stale" value={summary.stale} tone={summary.stale > 0 ? 'text-amber-400' : 'text-foreground-200'} icon="ri-time-line" />
        <SummaryStat label="Failed" value={summary.failed} tone={summary.failed > 0 ? 'text-red-400' : 'text-foreground-200'} icon="ri-close-circle-line" />
        <SummaryStat label="Never Backed Up" value={summary.neverBackedUp} tone={summary.neverBackedUp > 0 ? 'text-red-400' : 'text-foreground-200'} icon="ri-forbid-2-line" />
        <SummaryStat label="Unknown" value={summary.unknown} tone="text-secondary-300" icon="ri-question-line" />
      </div>

      {/* Distance-readable summary banner */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className={`ri-safe-2-line text-xl w-5 h-5 flex items-center justify-center ${TONE_TEXT[summary.tone]}`}></i>
        </span>
        <div className="min-w-0">
          <p className={`text-2xl font-heading font-bold leading-none ${TONE_TEXT[summary.tone]}`}>{summary.label}</p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">{summary.detail}</p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <SummaryCount label="Targets" value={summary.total} />
          <SummaryCount label="Current" value={summary.current} />
          <SummaryCount label="Stale + Failed" value={summary.stale + summary.failed} />
        </div>
      </div>

      {backup.loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-label text-foreground-500">Loading backup status…</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
          {/* Backup targets + restore readiness */}
          <div className="col-span-8 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1">
            <section className="shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-archive-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                  Backup Targets
                </h4>
              </div>
              {targets.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-background-300/60 py-8 px-4 min-h-[120px]">
                  <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50 text-foreground-500">
                    <i className="ri-archive-line text-xl w-5 h-5 flex items-center justify-center"></i>
                  </span>
                  <p className="text-sm font-heading font-semibold text-foreground-200 mt-3">No backup targets registered</p>
                  <p className="text-[11px] font-label text-foreground-600 mt-1 max-w-xs leading-tight">
                    No authoritative backup source is reporting. Monitoring-unavailable is never shown as healthy.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {targets.map((t) => (
                    <TargetTile key={t.key} target={t} />
                  ))}
                </div>
              )}
            </section>

            <section className="shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-restart-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                  Restore Readiness
                </h4>
              </div>
              <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
                {!readiness.hasDrill ? (
                  <p className="text-sm font-label text-foreground-500">{readiness.note}</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-heading font-semibold text-foreground-100 truncate">
                          {readiness.drillReference ?? 'Latest restore drill'}
                        </p>
                        <p className="text-[11px] font-label text-foreground-600 capitalize mt-0.5">
                          {(readiness.drillStatus ?? 'unknown').replace(/_/g, ' ')}
                        </p>
                      </div>
                      {readiness.recoveryTimeMinutes != null && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-500 bg-background-50 border border-background-200/60 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                          RTO {readiness.recoveryTimeMinutes}m
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <ResultRow label="Database" value={readiness.databaseResult} />
                      <ResultRow label="Storage" value={readiness.storageResult} />
                      <ResultRow label="Application" value={readiness.applicationResult} />
                    </div>
                    <p className="text-[11px] font-label text-foreground-500 leading-tight mt-3">{readiness.note}</p>
                  </>
                )}
              </div>
            </section>
          </div>

          {/* Backup gaps */}
          <div className="col-span-4 min-h-0 flex flex-col overflow-y-auto">
            <section className="bg-background-100 border border-background-200/60 rounded-lg flex-1 min-h-0 flex flex-col">
              <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2 shrink-0">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-alert-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                  Backup Gaps
                </h4>
              </div>
              <div className="p-4 flex-1 min-h-0 overflow-y-auto space-y-2.5">
                <p className="text-[11px] font-label text-foreground-600 leading-tight">
                  Critical systems with no usable backup-status source. These are not monitored — never assumed healthy.
                </p>
                {gaps.map((g) => (
                  <div
                    key={g.system}
                    className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{g.system}</p>
                      <p className="text-[11px] font-label text-foreground-500 truncate">{g.note}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-label font-semibold text-secondary-300 bg-secondary-500/10 border border-secondary-500/25 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
                      NOT MONITORED
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryStat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: string;
  icon: string;
}) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg px-3 py-3 flex flex-col justify-between min-h-[84px]">
      <div className="flex items-center gap-2">
        <span className={`w-6 h-6 flex items-center justify-center rounded-md bg-background-200/50 ${tone}`}>
          <i className={`${icon} text-sm w-3.5 h-3.5 flex items-center justify-center`}></i>
        </span>
        <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      </div>
      <p className={`text-3xl font-heading font-bold ${tone} leading-none tabular-nums mt-2`}>{value}</p>
    </div>
  );
}

function SummaryCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className="text-2xl font-heading font-bold text-foreground-100 tabular-nums leading-none mt-1">{value}</p>
    </div>
  );
}