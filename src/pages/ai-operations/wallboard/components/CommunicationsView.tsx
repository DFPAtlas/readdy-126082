import {
  getProviderStatus,
  getSendingDomains,
  getDeliverySummary,
  getBounces,
  getQueueState,
  getNotificationSummary,
  getMessageCategories,
  getSiteCommunication,
  getSupportInboxHealth,
  getCommunicationGaps,
  getDeliveryRateDefinition,
  type CommsSourceState,
  type SiteCommsState,
} from '@/pages/ai-operations/wallboard/communicationsSelectors';
import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { useCommunicationsData } from '@/pages/ai-operations/wallboard/communicationsStore';

const SOURCE_BADGE: Record<CommsSourceState, { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  empty: { label: 'No Data', cls: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const SITE_COMMS_BADGE: Record<SiteCommsState, { label: string; cls: string }> = {
  configured: { label: 'CONFIGURED', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  not_configured: { label: 'NOT SET', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  unavailable: { label: 'UNKNOWN', cls: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25' },
};

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function PanelHeading({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
      <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
        <i className={`${icon} text-base w-4 h-4 flex items-center justify-center`}></i>
      </span>
      <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">{title}</h4>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-2xl font-heading font-bold tabular-nums leading-none mt-1 ${tone ?? 'text-foreground-100'}`}>{value}</p>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
      <span className="text-secondary-300 mt-0.5">
        <i className="ri-information-line w-3.5 h-3.5 flex items-center justify-center"></i>
      </span>
      <p className="text-[11px] font-label text-foreground-500 leading-tight">{text}</p>
    </div>
  );
}

export default function CommunicationsView() {
  useCommunicationsData();
  const data = useGroupLiveData();

  const providers = getProviderStatus();
  const domains = getSendingDomains();
  const delivery = getDeliverySummary();
  const bounces = getBounces();
  const queue = getQueueState();
  const notifications = getNotificationSummary();
  const categories = getMessageCategories();
  const sites = getSiteCommunication();
  const inbox = getSupportInboxHealth();
  const gaps = getCommunicationGaps();

  const maxCategory = Math.max(1, ...categories.map((c) => c.count));

  // Overall distance-readable headline state.
  const emailConnected = delivery.sourceState === 'live' || providers.sourceState === 'live';

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Communications · Email &amp; Notifications
          </h3>
          {!data.loading && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${emailConnected ? SOURCE_BADGE.live.cls : SOURCE_BADGE.empty.cls}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {emailConnected ? 'Live' : 'Not Connected'}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600">
          observation only · no recipient identity or message contents · last refresh {data.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Distance-readable summary banner */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className="ri-mail-send-line text-xl w-5 h-5 flex items-center justify-center text-accent-400"></i>
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-heading font-bold leading-none text-foreground-50">
            {emailConnected ? 'Email delivery active' : 'No live email delivery connected'}
          </p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">
            {notifications.total != null ? `${notifications.total} DFP notification events (baseline)` : 'No DFP notification events'}
            {inbox.openTickets != null ? ` · ${inbox.openTickets} open support tickets` : ''}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <Stat
            label="Delivered"
            value={delivery.delivered != null ? delivery.delivered : '—'}
            tone={delivery.delivered != null ? 'text-emerald-400' : undefined}
          />
          <Stat
            label="Failed"
            value={delivery.failed != null ? delivery.failed : '—'}
            tone={delivery.failed != null && delivery.failed > 0 ? 'text-red-400' : undefined}
          />
          <Stat
            label="Bounced"
            value={delivery.bounced != null ? delivery.bounced : '—'}
            tone={delivery.bounced != null && delivery.bounced > 0 ? 'text-red-400' : undefined}
          />
          <Stat
            label="Providers"
            value={providers.sourceState === 'live' ? providers.rows.length : '—'}
            tone={providers.sourceState === 'live' ? 'text-emerald-400' : undefined}
          />
          <Stat
            label="Open Tickets"
            value={inbox.openTickets != null ? inbox.openTickets : '—'}
            tone={inbox.openTickets != null && inbox.openTickets > 0 ? 'text-amber-400' : undefined}
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Left column: providers + delivery summary */}
        <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-service-line" title="Email Providers" />
            <div className="p-4 space-y-2">
              {providers.sourceState !== 'live' ? (
                <EmptyNote text="No email provider connection is registered — provider status is NOT CONFIGURED. No API keys or SMTP credentials are shown." />
              ) : (
                providers.rows.map((p) => (
                  <div key={p.provider} className="flex items-center justify-between bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-label text-foreground-100 capitalize whitespace-nowrap">{p.provider}</p>
                      <p className="text-[9px] font-label text-foreground-500 whitespace-nowrap">
                        last checked {fmtDateTime(p.lastChecked)}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold whitespace-nowrap ${p.status === 'healthy' || p.status === 'active' || p.status === 'connected' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : p.status === 'error' || p.status === 'failed' ? 'text-red-400 bg-red-500/10 border-red-500/25' : 'text-amber-400 bg-amber-500/10 border-amber-500/30'}`}>
                      <span className="w-1 h-1 rounded-full bg-current"></span>
                      {p.status.toUpperCase()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-global-line" title="Sending Domains" />
            <div className="p-4 space-y-2">
              {domains.sourceState !== 'live' ? (
                <EmptyNote text="No sending domain is registered or verified — outbound domain status is NOT CONFIGURED." />
              ) : (
                domains.rows.map((d) => (
                  <div key={d.domain} className="flex items-center justify-between bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-label text-foreground-100 truncate whitespace-nowrap">{d.domain}</p>
                      <p className="text-[9px] font-label text-foreground-500 whitespace-nowrap">
                        {d.isDefault ? 'default · ' : ''}last checked {fmtDateTime(d.lastChecked)}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold whitespace-nowrap ${d.status === 'verified' || d.status === 'active' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : 'text-amber-400 bg-amber-500/10 border-amber-500/30'}`}>
                      <span className="w-1 h-1 rounded-full bg-current"></span>
                      {d.status.toUpperCase()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Middle column: delivery + queue + bounces */}
        <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-mail-check-line" title="Delivery Summary" />
            <div className="p-4 space-y-2">
              {delivery.sourceState !== 'live' ? (
                <EmptyNote text="No email delivery events are recorded — sent/delivered/failed/bounced counts are not shown as zero. No delivery rate is produced from missing data." />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                      <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Sent</p>
                      <p className="text-lg font-heading font-bold text-foreground-100 tabular-nums mt-0.5">{delivery.sent}</p>
                    </div>
                    <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                      <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Delivered</p>
                      <p className="text-lg font-heading font-bold text-emerald-400 tabular-nums mt-0.5">{delivery.delivered}</p>
                    </div>
                    <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                      <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Failed</p>
                      <p className="text-lg font-heading font-bold text-red-400 tabular-nums mt-0.5">{delivery.failed}</p>
                    </div>
                    <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                      <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Bounced</p>
                      <p className="text-lg font-heading font-bold text-red-400 tabular-nums mt-0.5">{delivery.bounced}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                    <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">Delivery rate</span>
                    <span className="text-[12px] font-label font-semibold text-foreground-100 tabular-nums whitespace-nowrap">
                      {delivery.deliveryRate != null ? `${Math.round(delivery.deliveryRate * 100)}%` : 'N/A'}
                    </span>
                  </div>
                  <p className="text-[10px] font-label text-foreground-500 leading-tight">{getDeliveryRateDefinition()}</p>
                </>
              )}
            </div>
          </section>

          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-stack-line" title="Notification Queue" />
            <div className="p-4 space-y-2">
              {queue.sourceState !== 'live' ? (
                <EmptyNote text="No notification delivery attempts are recorded — the queue is empty, not confirmed healthy. Queued/processing/failed counts are not fabricated." />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                    <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Queued</p>
                    <p className="text-lg font-heading font-bold text-secondary-300 tabular-nums mt-0.5">{queue.queued}</p>
                  </div>
                  <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                    <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Processing</p>
                    <p className="text-lg font-heading font-bold text-accent-400 tabular-nums mt-0.5">{queue.processing}</p>
                  </div>
                  <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                    <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Failed</p>
                    <p className="text-lg font-heading font-bold text-red-400 tabular-nums mt-0.5">{queue.failed}</p>
                  </div>
                  <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                    <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Delivered</p>
                    <p className="text-lg font-heading font-bold text-emerald-400 tabular-nums mt-0.5">{queue.delivered}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-arrow-go-back-line" title="Bounces" />
            <div className="p-4 space-y-2">
              {bounces.sourceState !== 'live' ? (
                <EmptyNote text="No bounce or suppression records exist. Recipient addresses and bounce payloads are never shown." />
              ) : (
                <div className="space-y-1.5">
                  {bounces.breakdown.map((b) => (
                    <div key={b.reason} className="flex items-center justify-between bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                      <span className="text-[11px] font-label text-foreground-200 capitalize">{b.reason}</span>
                      <span className="text-[12px] font-label font-semibold text-red-400 tabular-nums">{b.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right column: categories + support + site + gaps */}
        <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-chat-3-line" title="Message Categories" />
            <div className="p-4 space-y-2">
              {categories.length === 0 ? (
                <EmptyNote text="No DFP notification events are recorded — message categories are not available." />
              ) : (
                <>
                  {categories.map((c) => (
                    <div key={c.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-label text-foreground-200 whitespace-nowrap">{c.label}</span>
                        <span className="text-[11px] font-label text-foreground-100 tabular-nums">{c.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-background-200/60 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent-400"
                          style={{ width: `${Math.round((c.count / maxCategory) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                  {notifications.byChannel.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {notifications.byChannel.map((ch) => (
                        <span key={ch.label} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold text-secondary-300 bg-secondary-500/10 border-secondary-500/25 whitespace-nowrap">
                          {ch.label} · {ch.count}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-inbox-line" title="Support Inbox" />
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Open</p>
                  <p className="text-lg font-heading font-bold text-foreground-100 tabular-nums mt-0.5">{inbox.openTickets ?? '—'}</p>
                </div>
                <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Urgent</p>
                  <p className="text-lg font-heading font-bold text-amber-400 tabular-nums mt-0.5">{inbox.urgentTickets ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border text-[10px] font-label font-semibold whitespace-nowrap ${inbox.receiving === 'live' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : 'text-foreground-500 bg-background-200/60 border-background-300/60'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  {inbox.receiving === 'live' ? 'RECEIVING' : 'UNAVAILABLE'}
                </span>
              </div>
              <p className="text-[10px] font-label text-foreground-500 leading-tight">
                Inbox health reused from the existing support workload — no duplicate ticketing platform.
              </p>
            </div>
          </section>

          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-building-2-line" title="Per-Site Communication" />
            <div className="p-3 space-y-1.5">
              {sites.map((s) => (
                <div key={s.siteId} className="flex items-center justify-between gap-3 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-label text-foreground-100 truncate whitespace-nowrap">{s.siteName}</p>
                    <p className="text-[9px] font-label text-foreground-500 truncate whitespace-nowrap">
                      {s.provider ? `provider ${s.provider}` : 'no email provider'}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold whitespace-nowrap ${SITE_COMMS_BADGE[s.state].cls}`}>
                    <span className="w-1 h-1 rounded-full bg-current"></span>
                    {SITE_COMMS_BADGE[s.state].label}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-error-warning-line" title="Data Scope &amp; Gaps" />
            <div className="p-4 space-y-1.5">
              {gaps.map((g) => (
                <div key={g.area} className="flex items-start gap-2">
                  <span className="text-foreground-500 mt-0.5">
                    <i className="ri-information-line w-3.5 h-3.5 flex items-center justify-center"></i>
                  </span>
                  <p className="text-[11px] font-label text-foreground-500 leading-tight">
                    <span className="text-foreground-300 font-semibold">{g.area}.</span> {g.note}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}