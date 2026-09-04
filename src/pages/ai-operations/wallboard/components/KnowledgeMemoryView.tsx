import {
  getKnowledgeSummary,
  getVectorHealth,
  getIngestionState,
  getSourceTypeBreakdown,
  getAgentCoverage,
  getSiteKnowledge,
  getMemoryStatus,
  getKnowledgeGaps,
  type SiteKnowledgeState,
} from '@/pages/ai-operations/wallboard/knowledgeSelectors';
import { useGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import { useKnowledgeData } from '@/pages/ai-operations/wallboard/knowledgeStore';

const SOURCE_BADGE: Record<'live' | 'unavailable', { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  unavailable: { label: 'Unavailable', cls: 'text-foreground-500 bg-background-200/60 border-background-300/60' },
};

const SITE_KNOWLEDGE_BADGE: Record<SiteKnowledgeState, { label: string; cls: string }> = {
  indexed: { label: 'INDEXED', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  stale: { label: 'STALE', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  connected: { label: 'CONNECTED', cls: 'text-accent-400 bg-accent-500/10 border-accent-500/25' },
  unavailable: { label: 'NONE', cls: 'text-secondary-300 bg-secondary-500/10 border-secondary-500/25' },
};

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-2xl font-heading font-bold tabular-nums leading-none mt-1 ${tone ?? 'text-foreground-100'}`}>{value}</p>
    </div>
  );
}

export default function KnowledgeMemoryView() {
  useKnowledgeData();
  const data = useGroupLiveData();

  const summary = getKnowledgeSummary();
  const vector = getVectorHealth();
  const ingestion = getIngestionState();
  const types = getSourceTypeBreakdown();
  const coverage = getAgentCoverage();
  const sites = getSiteKnowledge();
  const memory = getMemoryStatus();
  const gaps = getKnowledgeGaps();

  const maxType = Math.max(1, ...types.map((t) => t.count));

  return (
    <main className="flex-1 min-h-0 overflow-hidden px-4 pb-4 flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            Knowledge &amp; Memory · Vector Health
          </h3>
          {!data.loading && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-label border rounded-full px-2.5 py-0.5 whitespace-nowrap ${SOURCE_BADGE[summary.sourceState].cls}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {SOURCE_BADGE[summary.sourceState].label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-label text-foreground-600">
          observation only · no contents or vectors exposed · last refresh {data.lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
      </div>

      {/* Distance-readable summary banner */}
      <div className="shrink-0 flex items-center gap-4 bg-background-100 border border-background-200/60 rounded-lg px-5 py-4 mb-3">
        <span className="w-10 h-10 flex items-center justify-center rounded-md bg-background-200/50">
          <i className="ri-book-2-line text-xl w-5 h-5 flex items-center justify-center text-accent-400"></i>
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-heading font-bold leading-none text-foreground-50">
            {summary.total} sources · {vector.embedded} embedded
          </p>
          <p className="text-[12px] font-label text-foreground-600 mt-1">
            {summary.stale > 0 ? `${summary.stale} stale · ` : ''}
            {summary.awaitingIngestion > 0 ? `${summary.awaitingIngestion} awaiting ingestion` : 'all ingested'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <Stat label="Sources" value={summary.total} />
          <Stat label="Active" value={summary.active} tone="text-emerald-400" />
          <Stat label="Stale" value={summary.stale} tone={summary.stale > 0 ? 'text-amber-400' : undefined} />
          <Stat label="Embedded" value={vector.embedded} tone={vector.notEmbedded > 0 ? 'text-amber-400' : 'text-emerald-400'} />
          <Stat label="Awaiting" value={summary.awaitingIngestion} tone={summary.awaitingIngestion > 0 ? 'text-amber-400' : undefined} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Left column: source types + vector/indexing */}
        <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-stack-line" title="Source Types" />
            <div className="p-4 space-y-2">
              {types.length === 0 ? (
                <p className="text-[11px] font-label text-foreground-500 leading-tight">No knowledge sources registered.</p>
              ) : (
                types.map((t) => (
                  <div key={t.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-label text-foreground-200 whitespace-nowrap">{t.label}</span>
                      <span className="text-[11px] font-label text-foreground-100 tabular-nums">{t.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-background-200/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-400"
                        style={{ width: `${Math.round((t.count / maxType) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-database-2-line" title="Vector &amp; Indexing" />
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Indexed</p>
                  <p className="text-lg font-heading font-bold text-emerald-400 tabular-nums mt-0.5">{vector.indexed}</p>
                </div>
                <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Not indexed</p>
                  <p className="text-lg font-heading font-bold text-amber-400 tabular-nums mt-0.5">{vector.notIndexed}</p>
                </div>
                <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Embedded</p>
                  <p className="text-lg font-heading font-bold text-emerald-400 tabular-nums mt-0.5">{vector.embedded}</p>
                </div>
                <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Not embedded</p>
                  <p className="text-lg font-heading font-bold text-amber-400 tabular-nums mt-0.5">{vector.notEmbedded}</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">Last ingested</span>
                <span className="text-[11px] font-label text-foreground-100 whitespace-nowrap">{fmtDate(vector.lastIngested)}</span>
              </div>
              {vector.embeddingModels.length > 0 && (
                <div className="flex items-center justify-between bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                  <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">Embedding model</span>
                  <span className="text-[11px] font-label text-foreground-100 whitespace-nowrap truncate max-w-[140px]">{vector.embeddingModels.join(', ')}</span>
                </div>
              )}
              <p className="text-[10px] font-label text-foreground-500 leading-tight pt-1">
                No live vector-store or embedding-pipeline runtime exists — these are registry markers, not health checks.
              </p>
            </div>
          </section>
        </div>

        {/* Middle column: ingestion + agent coverage + retrieval */}
        <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-download-2-line" title="Ingestion &amp; Staleness" />
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Ingested</p>
                  <p className="text-lg font-heading font-bold text-emerald-400 tabular-nums mt-0.5">{ingestion.ingested}</p>
                </div>
                <div className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Awaiting</p>
                  <p className="text-lg font-heading font-bold text-amber-400 tabular-nums mt-0.5">{ingestion.notIngested}</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">Last successful</span>
                <span className="text-[11px] font-label text-foreground-100 whitespace-nowrap">{fmtDate(ingestion.lastSuccessful)}</span>
              </div>
              <div className="space-y-1.5 pt-1">
                {[
                  { label: 'Stale', value: summary.stale, tone: 'text-amber-400' },
                  { label: 'Review required', value: summary.reviewRequired, tone: 'text-amber-400' },
                  { label: 'Restricted', value: summary.restricted, tone: 'text-secondary-300' },
                  { label: 'Failed', value: summary.failed, tone: summary.failed > 0 ? 'text-red-400' : 'text-emerald-400' },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                    <span className="text-[11px] font-label text-foreground-200">{r.label}</span>
                    <span className={`text-[12px] font-label font-semibold tabular-nums ${r.tone}`}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-robot-2-line" title="Agent Coverage" />
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-background-50 border border-background-200/60 rounded-md px-2.5 py-2.5 text-center">
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Agents</p>
                  <p className="text-lg font-heading font-bold text-foreground-100 tabular-nums mt-0.5">{coverage.agentsTotal}</p>
                </div>
                <div className="bg-background-50 border border-background-200/60 rounded-md px-2.5 py-2.5 text-center">
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">With access</p>
                  <p className="text-lg font-heading font-bold text-emerald-400 tabular-nums mt-0.5">{coverage.agentsWithKnowledge}</p>
                </div>
                <div className="bg-background-50 border border-background-200/60 rounded-md px-2.5 py-2.5 text-center">
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">No grant</p>
                  <p className="text-lg font-heading font-bold text-amber-400 tabular-nums mt-0.5">{coverage.agentsWithoutKnowledge}</p>
                </div>
              </div>
              <p className="text-[10px] font-label text-foreground-500 leading-tight">
                Access derived from active agent→source permission grants. Not every agent requires knowledge — "no grant" is informational, not a failure.
              </p>
            </div>
          </section>

          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-radar-line" title="Retrieval Health" />
            <div className="p-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border text-[10px] font-label font-semibold text-secondary-300 bg-secondary-500/10 border-secondary-500/25 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  UNKNOWN
                </span>
              </div>
              <p className="text-[11px] font-label text-foreground-500 leading-tight mt-2">
                No retrieval-health probe exists. Retrieval state is reported as UNKNOWN — never assumed healthy.
              </p>
            </div>
          </section>
        </div>

        {/* Right column: per-site + memory + gaps */}
        <div className="col-span-4 min-h-0 flex flex-col gap-3 overflow-y-auto">
          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-building-2-line" title="Per-Site Knowledge" />
            <div className="p-3 space-y-1.5">
              {sites.map((s) => (
                <div key={s.siteId} className="flex items-center justify-between gap-3 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-label text-foreground-100 truncate whitespace-nowrap">{s.siteName}</p>
                    <p className="text-[9px] font-label text-foreground-500 truncate whitespace-nowrap">
                      {s.masterAgentName ? `master ${s.masterAgentName}` : 'no master agent'}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-[10px] font-label text-foreground-500 whitespace-nowrap">
                      {s.sources} src{s.sources === 1 ? '' : 's'}
                      {s.stale > 0 && <span className="text-amber-400"> · {s.stale} stale</span>}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border text-[9px] font-label font-semibold whitespace-nowrap ${SITE_KNOWLEDGE_BADGE[s.state].cls}`}>
                      <span className="w-1 h-1 rounded-full bg-current"></span>
                      {SITE_KNOWLEDGE_BADGE[s.state].label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="shrink-0 bg-background-100 border border-background-200/60 rounded-lg">
            <PanelHeading icon="ri-brain-line" title="Memory Status" />
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-background-50 border border-background-200/60 rounded-md px-2.5 py-2.5 text-center">
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Records</p>
                  <p className="text-lg font-heading font-bold text-foreground-100 tabular-nums mt-0.5">{memory.records}</p>
                </div>
                <div className="bg-background-50 border border-background-200/60 rounded-md px-2.5 py-2.5 text-center">
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Verified</p>
                  <p className="text-lg font-heading font-bold text-emerald-400 tabular-nums mt-0.5">{memory.verified}</p>
                </div>
                <div className="bg-background-50 border border-background-200/60 rounded-md px-2.5 py-2.5 text-center">
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Reusable</p>
                  <p className="text-lg font-heading font-bold text-accent-400 tabular-nums mt-0.5">{memory.approvedForReuse}</p>
                </div>
              </div>
              <p className="text-[10px] font-label text-foreground-500 leading-tight">
                Sanitised known-issue memory only. No live agent-memory service or write/retrieval telemetry is monitored — no contents are shown.
              </p>
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