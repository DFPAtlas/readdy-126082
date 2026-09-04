import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { useSecurityData } from '@/pages/ai-operations/wallboard/securityStore';
import { useRuntimeHealth } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import {
  getSecuritySummary,
  getSecurityConnections,
  getSecurityAlertSummary,
  getSecurityPolicySummary,
  getRemoteAccessStatus,
  SECURITY_STATE_META,
  type SecurityState,
  type SecurityConnection,
} from '@/pages/ai-operations/wallboard/securitySelectors';

const STATE_TEXT: Record<SecurityState, string> = {
  healthy: 'text-emerald-400',
  warning: 'text-amber-400',
  degraded: 'text-amber-400',
  offline: 'text-red-400',
  unknown: 'text-secondary-300',
};

const TONE_TEXT: Record<'emerald' | 'amber' | 'red' | 'secondary', string> = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
  secondary: 'text-secondary-300',
};

const SOURCE_BADGE: Record<'live' | 'partial' | 'unavailable', { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  partial: { label: 'Partial', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  unavailable: { label: 'Unknown', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
};

function StateBadge({ state }: { state: SecurityState }) {
  const tone = {
    healthy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
    warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    degraded: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    offline: 'text-red-400 bg-red-500/10 border-red-500/30',
    unknown: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
  }[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border text-[10px] font-label font-semibold whitespace-nowrap ${tone}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {SECURITY_STATE_META[state].label}
    </span>
  );
}

function ConnectionRow({ conn }: { conn: SecurityConnection }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{conn.name}</p>
        <p className="text-[11px] font-label text-foreground-600 truncate">{conn.provider ?? conn.group}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {conn.risk === 'critical' && (
          <span className="inline-flex items-center gap-1 text-[9px] font-label font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-1.5 py-0.5 whitespace-nowrap">
            CRITICAL
          </span>
        )}
        <span className={`w-2 h-2 rounded-full ${STATE_TEXT[conn.state].replace('text-', 'bg-')}`}></span>
        <p className={`text-[11px] font-label font-semibold ${STATE_TEXT[conn.state]} whitespace-nowrap`}>
          {SECURITY_STATE_META[conn.state].label}
        </p>
      </div>
    </div>
  );
}

export default function SecurityView() {
  useGroupLiveData();
  useSecurityData();
  useRuntimeHealth();

  const summary = getSecuritySummary();
  const connections = getSecurityConnections();
  const alerts = getSecurityAlertSummary();
  const policies = getSecurityPolicySummary();
  const sessions = useSecurityData().sessions;
  const remote = getRemoteAccessStatus();
  const securityData = useSecurityData();

  // Group connections by display category, preserving sort order.
  const groups = new Map<string, SecurityConnection[]>();
  for (const c of connections) {
    const list = groups.get(c.group) ?? [];
    list.push(c);
    groups.set(c.group, list);
  }

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Security &amp; Connectivity
          </h3>
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[summary.sourceState].cls}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
            {SOURCE_BADGE[summary.sourceState].label}
          </span>
        </div>
        <p className="text-[11px] font-label text-foreground-600">
          read-only · aggregate only · last refresh {securityData.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Summary — readable from across the room */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className={`ri-shield-keyhole-line text-xl w-5 h-5 flex items-center justify-center ${TONE_TEXT[summary.tone]}`}></i>
        </span>
        <div className="min-w-0">
          <p className={`text-2xl font-heading font-bold leading-none ${TONE_TEXT[summary.tone]}`}>{summary.label}</p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">{summary.detail}</p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <SummaryCount label="Critical Alerts" value={summary.criticalAlerts} tone={summary.criticalAlerts > 0 ? 'text-red-400' : 'text-foreground-100'} />
          <SummaryCount label="High Alerts" value={summary.highAlerts} tone={summary.highAlerts > 0 ? 'text-amber-400' : 'text-foreground-100'} />
          <SummaryCount label="Offline" value={summary.connectionsOffline} tone={summary.connectionsOffline > 0 ? 'text-red-400' : 'text-foreground-100'} />
          <SummaryCount label="Active Sessions" value={summary.activeSessions} tone="text-foreground-100" />
          <SummaryCount label="Active Policies" value={summary.activePolicies} tone="text-foreground-100" />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Connections grouped by category */}
        <div className="col-span-8 min-h-0 flex flex-col overflow-y-auto pr-1">
          <div className="flex items-center gap-2 mb-2 shrink-0">
            <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
              <i className="ri-plug-line text-base w-4 h-4 flex items-center justify-center"></i>
            </span>
            <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
              Service Connections
            </h4>
          </div>

          {connections.length === 0 ? (
            <p className="text-sm font-label text-foreground-500">No connections registered.</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              {[...groups.entries()].map(([group, items]) => (
                <section key={group}>
                  <p className="text-[11px] font-label font-semibold text-foreground-600 uppercase tracking-wide mb-2">
                    {group}
                  </p>
                  <div className="space-y-2">
                    {items.map((c) => (
                      <ConnectionRow key={c.key} conn={c} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Right column: alerts, remote access, sessions, posture */}
        <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
          {/* Security alerts */}
          <section className="bg-background-100 border border-background-200/60 rounded-lg shrink-0">
            <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-alarm-warning-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                  Security Alerts
                </h4>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-background-50 border border-background-200/60 rounded-md py-2">
                  <p className="text-[10px] font-label text-foreground-600 uppercase">Critical</p>
                  <p className={`text-xl font-heading font-bold tabular-nums mt-0.5 ${alerts.critical > 0 ? 'text-red-400' : 'text-foreground-100'}`}>
                    {alerts.critical}
                  </p>
                </div>
                <div className="bg-background-50 border border-background-200/60 rounded-md py-2">
                  <p className="text-[10px] font-label text-foreground-600 uppercase">High</p>
                  <p className={`text-xl font-heading font-bold tabular-nums mt-0.5 ${alerts.high > 0 ? 'text-amber-400' : 'text-foreground-100'}`}>
                    {alerts.high}
                  </p>
                </div>
                <div className="bg-background-50 border border-background-200/60 rounded-md py-2">
                  <p className="text-[10px] font-label text-foreground-600 uppercase">Unresolved</p>
                  <p className="text-xl font-heading font-bold text-foreground-100 tabular-nums mt-0.5">{alerts.unresolved}</p>
                </div>
              </div>
              {alerts.latestCriticalTitle && (
                <p className="text-[11px] font-label text-foreground-500 leading-tight">
                  Latest critical: <span className="text-foreground-200">{alerts.latestCriticalTitle}</span>
                </p>
              )}
              <p className="text-[11px] font-label text-foreground-600 leading-tight">
                Aggregate counts only — no exploit or payload detail is shown on the wall display.
              </p>
            </div>
          </section>

          {/* Remote access */}
          <section className="bg-background-100 border border-background-200/60 rounded-lg shrink-0">
            <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
              <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                <i className="ri-lock-2-line text-base w-4 h-4 flex items-center justify-center"></i>
              </span>
              <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                Remote Access
              </h4>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-heading font-semibold text-foreground-100">HAL Runtime Bridge</p>
                  <p className="text-[11px] font-label text-foreground-600">Outbound-only · remote relay</p>
                </div>
                <span className={`w-2 h-2 rounded-full ${
                  remote.bridge === 'reachable' ? 'bg-emerald-400' : remote.bridge === 'stale' ? 'bg-amber-400' : remote.bridge === 'offline' ? 'bg-red-400' : 'bg-secondary-300'
                }`}></span>
              </div>
              <div className="bg-background-50 border border-background-200/60 rounded-md py-2 px-3 flex items-center justify-between">
                <p className="text-[11px] font-label text-foreground-600 uppercase">Status</p>
                <p className="text-sm font-heading font-semibold text-foreground-100">{remote.bridgeLabel}</p>
              </div>
              <p className="text-[11px] font-label text-foreground-500 leading-tight">{remote.note}</p>
            </div>
          </section>

          {/* Support sessions (aggregate only) */}
          <section className="bg-background-100 border border-background-200/60 rounded-lg shrink-0">
            <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
              <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                <i className="ri-user-shared-line text-base w-4 h-4 flex items-center justify-center"></i>
              </span>
              <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                Support Sessions
              </h4>
            </div>
            <div className="p-4 space-y-2.5">
              <div className="grid grid-cols-4 gap-2 text-center">
                <SessionStat label="Active" value={sessions.active} />
                <SessionStat label="Pending" value={sessions.pending} />
                <SessionStat label="Expired" value={sessions.expired} />
                <SessionStat label="Revoked" value={sessions.revoked} />
              </div>
              <p className="text-[11px] font-label text-foreground-500 leading-tight">
                Aggregate operational state only — no customer identity is displayed.
              </p>
            </div>
          </section>

          {/* Security posture */}
          <section className="bg-background-100 border border-background-200/60 rounded-lg shrink-0">
            <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
              <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                <i className="ri-scales-3-line text-base w-4 h-4 flex items-center justify-center"></i>
              </span>
              <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
                Security Policy Posture
              </h4>
            </div>
            <div className="p-4 grid grid-cols-3 gap-2 text-center">
              <SessionStat label="Active" value={policies.active} />
              <SessionStat label="Review Due" value={policies.reviewRequired} />
              <SessionStat label="Security" value={policies.securityCategory} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function SummaryCount({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-2xl font-heading font-bold tabular-nums leading-none mt-1 ${tone}`}>{value}</p>
    </div>
  );
}

function SessionStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-md py-2">
      <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className="text-sm font-heading font-semibold text-foreground-100 tabular-nums mt-0.5">{value}</p>
    </div>
  );
}