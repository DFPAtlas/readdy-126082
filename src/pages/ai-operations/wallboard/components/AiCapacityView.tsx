import {
  getAiCapacitySummary,
  getAiProviderStatuses,
  getAiModelStatuses,
  getLocalAiSources,
  getLocalModelCount,
  getAiQueueSummary,
  getAiRoutingResilience,
  getAiCostSummary,
  AI_STATE_META,
  type AiHealthState,
  type ProviderStatusItem,
  type ModelStatusItem,
  type LocalAiSource,
} from '@/pages/ai-operations/wallboard/aiCapacitySelectors';
import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { useOllamaCatalogue } from '@/pages/ai-operations/models/ollamaCatalogueStore';
import { useRuntimeHealth } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';

const SOURCE_BADGE: Record<'live' | 'partial' | 'unavailable', { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  partial: { label: 'Partial', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const STATE_BADGE: Record<AiHealthState, string> = {
  healthy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  degraded: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  unavailable: 'text-red-400 bg-red-500/10 border-red-500/30',
  not_configured: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
  disabled: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
  unknown: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
};

const RESILIENCE_TONE: Record<'emerald' | 'amber' | 'red' | 'secondary', string> = {
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

function StateBadge({ state }: { state: AiHealthState }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border text-[10px] font-label font-semibold whitespace-nowrap ${STATE_BADGE[state]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {AI_STATE_META[state].label}
    </span>
  );
}

function EmptyState({ icon, title, note }: { icon: string; title: string; note: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-background-300/60 py-8 px-4 min-h-[120px]">
      <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50 text-foreground-500">
        <i className={`${icon} text-xl w-5 h-5 flex items-center justify-center`}></i>
      </span>
      <p className="text-sm font-heading font-semibold text-foreground-200 mt-3">{title}</p>
      <p className="text-[11px] font-label text-foreground-600 mt-1 max-w-xs leading-tight">{note}</p>
    </div>
  );
}

export default function AiCapacityView() {
  const data = useGroupLiveData();
  useOllamaCatalogue();
  useRuntimeHealth();

  const summary = getAiCapacitySummary();
  const providers = getAiProviderStatuses();
  const models = getAiModelStatuses();
  const localAi = getLocalAiSources();
  const queue = getAiQueueSummary();
  const resilience = getAiRoutingResilience();
  const cost = getAiCostSummary();

  const activeModels = models.filter((m) => m.state !== 'disabled');
  const hasAnyProviders = providers.length > 0;

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            AI Capacity · Models &amp; Providers
          </h3>
          {!data.loading && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[summary.sourceState].cls}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[summary.sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600">
          registry health · read-only · last refresh {data.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Summary strip */}
      <div className="shrink-0 grid grid-cols-3 md:grid-cols-6 gap-2.5 mb-3">
        <SummaryStat label="Providers" value={summary.providersTotal} tone="text-foreground-100" icon="ri-cloud-line" />
        <SummaryStat label="Providers Healthy" value={summary.providersHealthy} tone={summary.providersUnavailable > 0 || summary.providersDegraded > 0 ? 'text-amber-400' : 'text-emerald-400'} icon="ri-check-double-line" />
        <SummaryStat label="Models Active" value={summary.modelsActive} tone="text-foreground-100" icon="ri-brain-line" />
        <SummaryStat label="Models Healthy" value={summary.modelsHealthy} tone={summary.modelsDegraded > 0 ? 'text-amber-400' : 'text-emerald-400'} icon="ri-pulse-line" />
        <SummaryStat label="Running Jobs" value={queue.running} tone={queue.running > 0 ? 'text-accent-400' : 'text-foreground-200'} icon="ri-loader-4-line" />
        <SummaryStat label="Queued Jobs" value={queue.queued} tone={queue.queued > 0 ? 'text-amber-400' : 'text-foreground-200'} icon="ri-stack-line" />
      </div>

      {/* Distance-readable resilience + cost banner */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className={`ri-shield-star-line text-xl w-5 h-5 flex items-center justify-center ${RESILIENCE_TONE[resilience.tone]}`}></i>
        </span>
        <div className="min-w-0">
          <p className={`text-2xl font-heading font-bold leading-none ${RESILIENCE_TONE[resilience.tone]}`}>
            {resilience.label}
          </p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">
            {resilience.healthyModels} healthy model{resilience.healthyModels === 1 ? '' : 's'} · {resilience.healthyFallbackModels} healthy fallback model{resilience.healthyFallbackModels === 1 ? '' : 's'} of {resilience.fallbackAssignments} fallback assignment{resilience.fallbackAssignments === 1 ? '' : 's'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <SummaryCount label="AI Spend (est.)" value={`£${cost.total.toFixed(2)}`} />
          <SummaryCount label="Failed (recent)" value={queue.failedRecent} />
          <SummaryCount label="Local Models" value={getLocalModelCount()} />
        </div>
      </div>

      {data.loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-label text-foreground-500">Loading AI capacity…</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
          {/* Left: providers + models */}
          <div className="col-span-8 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1">
            <section className="shrink-0">
              <SectionHeading icon="ri-cloud-line" title="AI Providers" />
              {!hasAnyProviders ? (
                <EmptyState icon="ri-cloud-off-line" title="No providers" note="No AI provider is registered. Unavailable is never shown as healthy." />
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {providers.map((p) => (
                    <ProviderCard key={p.key} item={p} />
                  ))}
                </div>
              )}
            </section>

            <section className="shrink-0">
              <SectionHeading icon="ri-brain-line" title="Models" />
              {activeModels.length === 0 ? (
                <EmptyState icon="ri-brain-line" title="No active models" note="No models are currently active in the registry." />
              ) : (
                <div className="space-y-2">
                  {activeModels.map((m) => (
                    <ModelRow key={m.modelKey} item={m} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right: local AI + queue + cost split */}
          <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
            <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
              <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-cpu-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Local AI</h4>
              </div>
              <div className="p-3 space-y-2.5">
                {localAi.length === 0 ? (
                  <p className="text-[11px] font-label text-foreground-500 py-2">No local AI source registered.</p>
                ) : (
                  localAi.map((s) => (
                    <LocalAiRow key={s.key} item={s} />
                  ))
                )}
                <p className="text-[10px] font-label text-foreground-500 leading-tight">
                  No GPU / compute-utilisation registry exists — local capacity is shown from the relayed Ollama catalogue only, never invented.
                </p>
              </div>
            </section>

            <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
              <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-stack-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">AI Workload</h4>
              </div>
              <div className="p-4 grid grid-cols-2 gap-2 text-center">
                <QueueCell label="Running" value={queue.running} tone={queue.running > 0 ? 'text-accent-400' : 'text-foreground-200'} />
                <QueueCell label="Queued" value={queue.queued} tone={queue.queued > 0 ? 'text-amber-400' : 'text-foreground-200'} />
                <QueueCell label="Failed" value={queue.failedRecent} tone={queue.failedRecent > 0 ? 'text-red-400' : 'text-foreground-200'} />
                <QueueCell label="Retry" value={queue.retryScheduled} tone="text-foreground-200" />
                <QueueCell label="Awaiting Approval" value={queue.awaitingApproval} tone="text-foreground-200" />
              </div>
            </section>

            <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
              <div className="px-4 py-3 border-b border-background-200/60 flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
                  <i className="ri-money-pound-circle-line text-base w-4 h-4 flex items-center justify-center"></i>
                </span>
                <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Provider Cost Split</h4>
              </div>
              <div className="p-4">
                {cost.split.length === 0 ? (
                  <p className="text-[11px] font-label text-foreground-500 py-1">No cost usage recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {cost.split.map((s) => (
                      <div key={s.provider} className="flex items-center justify-between gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                        <span className="text-sm font-heading font-semibold text-foreground-100 truncate">{s.provider}</span>
                        <span className="text-sm font-heading font-semibold text-foreground-200 tabular-nums whitespace-nowrap">
                          £{s.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] font-label text-foreground-500 mt-2 leading-tight">
                  {cost.isEstimated ? 'Estimated / migrated baseline — not paid invoice data.' : 'Provider cost usage.'}
                </p>
              </div>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

function ProviderCard({ item }: { item: ProviderStatusItem }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg px-3.5 py-3 flex flex-col min-h-[96px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{item.name}</p>
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide mt-0.5 whitespace-nowrap">
            {item.type} · {item.hosting}
          </p>
        </div>
        <StateBadge state={item.state} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-label">
        <span className="text-foreground-500 whitespace-nowrap">{item.activeModels} active model{item.activeModels === 1 ? '' : 's'}</span>
        <span className="text-foreground-500 whitespace-nowrap">
          {item.monitoringEnabled ? 'monitoring on' : 'monitoring off'}
        </span>
      </div>
    </div>
  );
}

function ModelRow({ item }: { item: ModelStatusItem }) {
  const isLocal = item.hosting === 'local';
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg px-3.5 py-2.5 flex items-center gap-3">
      <span className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-background-200/50 ${isLocal ? 'text-accent-400' : 'text-secondary-300'}`}>
        <i className={`${isLocal ? 'ri-cpu-line' : 'ri-cloud-line'} text-base w-4 h-4 flex items-center justify-center`}></i>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{item.name}</p>
          {item.isDefault && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold tracking-wide text-accent-400 bg-accent-500/10 border-accent-500/25 whitespace-nowrap">
              DEFAULT
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600 mt-0.5 truncate">
          {item.providerName}
          {item.fallbackPriority != null ? ` · fallback priority ${item.fallbackPriority}` : ''}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-3 text-[11px] font-label">
        <span className="text-foreground-500 tabular-nums whitespace-nowrap">{item.usedAsPrimary} primary</span>
        <span className="text-foreground-500 tabular-nums whitespace-nowrap">{item.usedAsFallback} fallback</span>
      </div>
      <StateBadge state={item.state} />
    </div>
  );
}

function LocalAiRow({ item }: { item: LocalAiSource }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{item.name}</p>
        <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{item.role}</p>
        <p className="text-[11px] font-label text-foreground-500 mt-0.5 truncate">{item.detail}</p>
      </div>
      <div className="shrink-0 text-right">
        <StateBadge state={item.state} />
        <p className="text-[10px] font-label text-foreground-500 mt-1 whitespace-nowrap">{fmtSeen(item.lastSeen)}</p>
      </div>
    </div>
  );
}

function SectionHeading({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200/50 text-accent-400">
        <i className={`${icon} text-base w-4 h-4 flex items-center justify-center`}></i>
      </span>
      <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">{title}</h4>
    </div>
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

function SummaryCount({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className="text-2xl font-heading font-bold text-foreground-100 tabular-nums leading-none mt-1">{value}</p>
    </div>
  );
}

function QueueCell({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-heading font-bold ${tone} tabular-nums mt-0.5`}>{value}</p>
    </div>
  );
}