import {
  getAiInfraSummary,
  getHalHost,
  getOversight,
  getHalTronLink,
  getOllamaStatus,
  getLocalProbe,
  getN8nRelationship,
  getMasterAgentSummary,
  getAiTopology,
  getResourceMetrics,
  getAiInfraGaps,
  AI_INFRA_STATE_META,
  PROBE_STATE_META,
  type AiInfraState,
  type HostStatus,
  type OversightStatus,
  type TopologyNode,
} from '@/pages/ai-operations/wallboard/aiInfraSelectors';
import { useAiInfraData } from '@/pages/ai-operations/wallboard/aiInfraStore';
import { useRuntimeHealth } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';
import { useOllamaCatalogue } from '@/pages/ai-operations/models/ollamaCatalogueStore';
import { useN8nData } from '@/pages/ai-operations/wallboard/n8nStore';
import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';

const SOURCE_BADGE: Record<'live' | 'partial' | 'unavailable', { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  partial: { label: 'Partial', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const STATE_BADGE: Record<AiInfraState, string> = {
  healthy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  busy: 'text-accent-400 bg-accent-500/10 border-accent-500/25',
  degraded: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  offline: 'text-red-400 bg-red-500/10 border-red-500/30',
  stale: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  unknown: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
  not_connected: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25',
};

const SUMMARY_TONE: Record<'emerald' | 'amber' | 'red' | 'secondary', string> = {
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

function StateBadge({ state }: { state: AiInfraState }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border text-[10px] font-label font-semibold whitespace-nowrap ${STATE_BADGE[state]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {AI_INFRA_STATE_META[state].label}
    </span>
  );
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

function EmptyNote({ text }: { text: string }) {
  return <p className="text-[11px] font-label text-foreground-500 py-2 leading-tight">{text}</p>;
}

export default function AiInfrastructureView() {
  useAiInfraData();
  useRuntimeHealth();
  useOllamaCatalogue();
  useN8nData();
  const data = useGroupLiveData();

  const summary = getAiInfraSummary();
  const hal = getHalHost();
  const oversight = getOversight();
  const link = getHalTronLink();
  const ollama = getOllamaStatus();
  const probe = getLocalProbe();
  const n8n = getN8nRelationship();
  const masters = getMasterAgentSummary();
  const topology = getAiTopology();
  const resources = getResourceMetrics();
  const gaps = getAiInfraGaps();

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            AI Infrastructure · HAL &amp; Tron
          </h3>
          {!data.loading && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[summary.sourceState].cls}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[summary.sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600">
          read-only · monitoring only · last refresh {data.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Distance-readable summary banner */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className={`ri-radar-line text-xl w-5 h-5 flex items-center justify-center ${SUMMARY_TONE[summary.tone]}`}></i>
        </span>
        <div className="min-w-0">
          <p className={`text-2xl font-heading font-bold leading-none ${SUMMARY_TONE[summary.tone]}`}>
            {summary.label}
          </p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">{summary.detail}</p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <SummaryCount label="HAL" value={hal ? AI_INFRA_STATE_META[hal.state].label : 'NOT REGISTERED'} />
          <SummaryCount label="Overwatch" value={AI_INFRA_STATE_META[oversight.state].label} />
          <SummaryCount label="Local Models" value={ollama.localModels} />
          <SummaryCount label="Master Agents" value={masters.total} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Left: hosts + connection map */}
        <div className="col-span-7 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1">
          {/* HAL host card */}
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-server-line" title="HAL — Operational Automation Host" />
            <div className="p-4">
              {!hal ? (
                <EmptyNote text="No HAL runtime host is registered — a genuine authenticated bridge handshake is required." />
              ) : (
                <HostCard host={hal} />
              )}
            </div>
          </section>

          {/* Tron / Overwatch card */}
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-eye-2-line" title="Tron / Overwatch — AI Oversight" />
            <div className="p-4">
              <OversightCard oversight={oversight} link={link} />
            </div>
          </section>

          {/* Connection map */}
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-node-tree" title="System Connection Map" />
            <div className="p-4">
              <TopologyList nodes={topology} />
            </div>
          </section>
        </div>

        {/* Right: Ollama + probe + n8n + master agents + resources/gaps */}
        <div className="col-span-5 min-h-0 flex flex-col gap-3 overflow-y-auto">
          {/* Ollama */}
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-cpu-line" title="Local Ollama" />
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-heading font-semibold text-foreground-100">Model Serving</span>
                  <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">inference disabled</span>
                </div>
                <StateBadge state={ollama.state} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniCell label="Local Models" value={ollama.localModels} tone="text-foreground-100" />
                <MiniCell label="Remote Refs" value={ollama.remoteModels} tone="text-foreground-200" />
                <MiniCell
                  label="Catalogue"
                  value={ollama.catalogueFreshness === 'verified' ? 'Verified' : ollama.catalogueFreshness === 'stale' ? 'Stale' : '—'}
                  tone={ollama.catalogueFreshness === 'verified' ? 'text-emerald-400' : 'text-amber-400'}
                />
              </div>

              {/* Local AI probe */}
              <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Local Inference Probe</p>
                  <p className="text-[11px] font-label text-foreground-500 mt-0.5 leading-tight">{probe.detail}</p>
                  <p className="text-[10px] font-label text-foreground-500 mt-1 whitespace-nowrap">
                    {probe.model}
                    {probe.latencyMs != null ? ` · ${probe.latencyMs} ms` : ''}
                    {probe.resultAt ? ` · ${fmtSeen(probe.resultAt)}` : ''}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border text-[10px] font-label font-semibold whitespace-nowrap ${
                  probe.state === 'VERIFIED' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                    : probe.state === 'FAILED' ? 'text-red-400 bg-red-500/10 border-red-500/30'
                      : probe.state === 'STALE' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                        : 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  {PROBE_STATE_META[probe.state].label}
                </span>
              </div>
            </div>
          </section>

          {/* n8n relationship */}
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-flow-chart" title="n8n Automation" />
            <div className="p-4">
              <div className="grid grid-cols-4 gap-2 text-center">
                <MiniCell label="Instances" value={`${n8n.instancesOnline}/${n8n.instancesTotal}`} tone="text-foreground-100" />
                <MiniCell label="Active Workflows" value={n8n.activeWorkflows} tone="text-foreground-100" />
                <MiniCell label="Running" value={n8n.running} tone={n8n.running > 0 ? 'text-accent-400' : 'text-foreground-200'} />
                <MiniCell label="Failed" value={n8n.failed} tone={n8n.failed > 0 ? 'text-red-400' : 'text-foreground-200'} />
              </div>
              <p className="text-[10px] font-label text-foreground-500 mt-2 leading-tight">
                Reused from the Automation &amp; Workflows view — no duplicate n8n monitoring.
              </p>
            </div>
          </section>

          {/* Master agent summary */}
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-robot-2-line" title="Master Agents" />
            <div className="p-4">
              <div className="grid grid-cols-4 gap-2 text-center">
                <MiniCell label="Total" value={masters.total} tone="text-foreground-100" />
                <MiniCell label="Active" value={masters.active} tone="text-emerald-400" />
                <MiniCell label="Idle" value={masters.idle} tone="text-foreground-200" />
                <MiniCell label="Degraded" value={masters.degraded} tone={masters.degraded > 0 ? 'text-amber-400' : 'text-foreground-200'} />
              </div>
              <p className="text-[10px] font-label text-foreground-500 mt-2 leading-tight">
                Orchestration-category agents. Detailed master-agent information is handled by a later wallboard view.
              </p>
            </div>
          </section>

          {/* Resource pressure */}
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-speed-up-line" title="Resource Pressure" />
            <div className="p-4">
              <div className="grid grid-cols-5 gap-2 text-center">
                {resources.map((r) => (
                  <div key={r.key} className="bg-background-50 border border-background-200/60 rounded-md px-2 py-2">
                    <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{r.label}</p>
                    <p className="text-[10px] font-label text-secondary-300 mt-0.5 whitespace-nowrap">not monitored</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-label text-foreground-500 mt-2 leading-tight">
                No CPU / RAM / GPU / storage / temperature telemetry is relayed by the bridge — these remain unavailable, never fabricated.
              </p>
            </div>
          </section>

          {/* Gaps */}
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

function HostCard({ host }: { host: HostStatus }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-lg font-heading font-bold text-foreground-50 truncate">{host.name}</p>
            <StateBadge state={host.state} />
          </div>
          <p className="text-[11px] font-label text-foreground-600 mt-0.5 whitespace-nowrap">
            {host.hostname} · {host.environment} · {host.role}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Last heartbeat</p>
          <p className="text-xs font-heading font-semibold text-foreground-200 mt-0.5 whitespace-nowrap">{fmtSeen(host.lastHeartbeat)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
        <StatCell label="n8n" value={host.n8nStatus ?? '—'} tone={host.n8nStatus === 'healthy' ? 'text-emerald-400' : host.n8nStatus === 'unavailable' ? 'text-red-400' : 'text-foreground-200'} />
        <StatCell label="Ollama" value={host.ollamaStatus ?? '—'} tone={host.ollamaStatus === 'healthy' ? 'text-emerald-400' : host.ollamaStatus === 'unavailable' ? 'text-red-400' : 'text-foreground-200'} />
        <StatCell label="Local Models" value={host.ollamaModelCount != null ? host.ollamaModelCount : '—'} tone="text-foreground-200" />
        <StatCell label="Latency" value={host.latencyMs != null ? `${host.latencyMs} ms` : '—'} tone="text-foreground-200" />
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {host.capabilities.map((c) => (
          <span key={c} className="inline-flex items-center rounded-full px-2 py-0.5 border border-background-200/60 text-[9px] font-label text-foreground-500 whitespace-nowrap">
            {c}
          </span>
        ))}
        <span className="inline-flex items-center rounded-full px-2 py-0.5 border border-red-500/25 text-[9px] font-label font-semibold text-red-400 whitespace-nowrap">
          execution {host.executionEnabled ? 'enabled' : 'blocked'}
        </span>
      </div>

      <p className="text-[10px] font-label text-foreground-500 mt-2 leading-tight">
        {host.platform ? `${host.platform}${host.softwareVersion ? ` · v${host.softwareVersion}` : ''} · ` : ''}
        {host.connectionMode ?? 'bridge'} transport only — the browser never contacts HAL directly.
      </p>
    </div>
  );
}

function OversightCard({ oversight, link }: { oversight: OversightStatus; link: { state: string; label: string } }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-lg font-heading font-bold text-foreground-50 truncate">{oversight.name}</p>
            <StateBadge state={oversight.state} />
          </div>
          <p className="text-[11px] font-label text-foreground-600 mt-0.5">{oversight.role}</p>
        </div>
      </div>
      <p className="text-[11px] font-label text-foreground-500 mt-2 leading-tight">{oversight.detail}</p>
      <div className="flex items-center gap-2 mt-3 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
        <span className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">HAL → TRON</span>
        <span className="w-4 text-center text-foreground-500">
          <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
        </span>
        <span className="inline-flex items-center rounded-full px-2 py-0.5 border border-secondary-500/25 text-[9px] font-label font-semibold text-secondary-300 whitespace-nowrap">
          {link.label}
        </span>
        <span className="text-[10px] font-label text-foreground-500">no live oversight channel exists</span>
      </div>
    </div>
  );
}

function TopologyList({ nodes }: { nodes: TopologyNode[] }) {
  return (
    <div className="space-y-0">
      {nodes.map((n, i) => (
        <div key={n.key}>
          <div className="flex items-center gap-3 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-heading font-semibold text-foreground-100 truncate">{n.name}</p>
              <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{n.role}</p>
            </div>
            <div className="shrink-0 text-right">
              <StateBadge state={n.state} />
              <p className="text-[10px] font-label text-foreground-500 mt-1 whitespace-nowrap max-w-[220px] truncate">{n.detail}</p>
            </div>
          </div>
          {i < nodes.length - 1 && (
            <div className="flex justify-center py-0.5">
              <span className="text-foreground-500">
                <i className="ri-arrow-down-line w-3.5 h-3.5 flex items-center justify-center"></i>
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StatCell({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-md px-2.5 py-2">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-sm font-heading font-semibold mt-0.5 truncate ${tone}`}>{value}</p>
    </div>
  );
}

function MiniCell({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div>
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-lg font-heading font-bold ${tone} tabular-nums mt-0.5`}>{value}</p>
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