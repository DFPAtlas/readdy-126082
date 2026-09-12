// ============================================================================
// DFP AI Operations — Activity tabs below the group agent network.
//
// Three operational tabs:
//   * Live activity   — confirmed starts / completions / failures + report
//                       arrivals (deduplicated, bounded).
//   * Needs attention — prioritised alerts + pending approvals.
//   * Run history     — filterable run records with result, timestamps, duration
//                       (paginated, bounded coverage).
//
// Site + agent filters apply consistently across all three tabs. Honest states:
// unknown values stay "—", and a partial/bounded window is never described as a
// complete total.
// ============================================================================

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getGroupLiveData } from '@/pages/ai-operations/live/groupLiveDataStore';
import {
  getLiveActivityEvents,
  getAttentionItems,
  getRunHistory,
  type LiveActivityEvent,
  type AttentionItem,
  type RunHistoryItem,
} from '@/pages/ai-operations/network/activitySelectors';
import { TONE_HEX } from '@/pages/ai-operations/network/networkSelectors';

type Tab = 'activity' | 'attention' | 'history';

const RUN_PAGE_SIZE = 10;

const KIND_LABEL: Record<LiveActivityEvent['kind'], string> = {
  start: 'STARTED',
  completion: 'COMPLETED',
  failure: 'FAILED',
  report: 'REPORT',
};

function toneForKind(kind: LiveActivityEvent['kind']): string {
  if (kind === 'completion') return TONE_HEX.emerald;
  if (kind === 'failure') return TONE_HEX.red;
  if (kind === 'report') return TONE_HEX.amber;
  return TONE_HEX.accent;
}

const selectCls =
  'bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-2.5 py-1.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer';

export default function ActivityTabs() {
  const [tab, setTab] = useState<Tab>('activity');
  const [siteFilter, setSiteFilter] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [runStatus, setRunStatus] = useState('');
  const [runPage, setRunPage] = useState(0);

  const data = getGroupLiveData();

  const sites = useMemo(
    () => data.sites.map((s) => ({ key: s.site_key, name: s.name })),
    [data],
  );

  const q = agentSearch.trim().toLowerCase();
  const matches = (siteKey: string, agentName: string | null) =>
    (!siteFilter || siteKey === siteFilter) &&
    (!q || (agentName ?? '').toLowerCase().includes(q));

  const activity = useMemo(
    () => getLiveActivityEvents().filter((e) => matches(e.siteKey, e.agentName)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [siteFilter, agentSearch, data],
  );

  const attention = useMemo(
    () => getAttentionItems().filter((i) => matches(i.siteKey, i.agentName)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [siteFilter, agentSearch, data],
  );

  const history = useMemo(
    () =>
      getRunHistory().filter(
        (r) => matches(r.siteKey, r.agentName) && (!runStatus || r.status === runStatus),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [siteFilter, agentSearch, runStatus, data],
  );

  const pageCount = Math.max(1, Math.ceil(history.length / RUN_PAGE_SIZE));
  const safePage = Math.min(runPage, pageCount - 1);
  const pageRows: RunHistoryItem[] = history.slice(safePage * RUN_PAGE_SIZE, safePage * RUN_PAGE_SIZE + RUN_PAGE_SIZE);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of getRunHistory()) set.add(r.status);
    return Array.from(set).sort();
  }, [data]);

  const tabBtn = (t: Tab, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={`gn-tab ${tab === t ? 'gn-tab-active' : ''}`}
    >
      {label}
      <span className="gn-tab-count">{count}</span>
    </button>
  );

  return (
    <section className="gn-tabs">
      <div className="gn-tabs-head">
        <div className="gn-tabs-nav" role="tablist" aria-label="Operational activity">
          {tabBtn('activity', 'Live activity', activity.length)}
          {tabBtn('attention', 'Needs attention', attention.length)}
          {tabBtn('history', 'Run history', history.length)}
        </div>

        <div className="gn-tabs-filters">
          <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} className={selectCls}>
            <option value="">Site: all</option>
            {sites.map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={agentSearch}
            onChange={(e) => setAgentSearch(e.target.value)}
            placeholder="Filter by agent…"
            className="gn-tabs-search"
          />
        </div>
      </div>

      {/* Live activity */}
      {tab === 'activity' && (
        <div className="gn-tabs-body">
          {activity.length === 0 ? (
            <div className="gn-tabs-empty">No confirmed activity matches the current filters.</div>
          ) : (
            activity.map((e) => (
              <div key={e.id} className="gn-tabs-row">
                <span className="gn-status-dot" style={{ background: toneForKind(e.kind) }} />
                <span className="gn-tabs-kind" style={{ color: toneForKind(e.kind) }}>{KIND_LABEL[e.kind]}</span>
                <span className="gn-tabs-site">{e.siteName}</span>
                <span className="gn-tabs-agent">{e.agentName ?? '—'}</span>
                <span className="gn-tabs-summary" title={e.summary}>{e.summary}</span>
                <span className="gn-tabs-time">{e.timestampLabel}</span>
              </div>
            ))
          )}
          {activity.length > 0 && (
            <div className="gn-tabs-note">Latest {activity.length} confirmed events.</div>
          )}
        </div>
      )}

      {/* Needs attention */}
      {tab === 'attention' && (
        <div className="gn-tabs-body">
          {attention.length === 0 ? (
            <div className="gn-tabs-empty">Nothing needs attention for the current filters.</div>
          ) : (
            attention.map((i) => (
              <Link
                key={i.id}
                to={`/ai-operations/${i.referenceType === 'alert' ? 'alerts' : 'approvals'}/${i.referenceKey}`}
                className="gn-tabs-row gn-tabs-row-link"
              >
                <span className="gn-status-dot" style={{ background: TONE_HEX[i.tone === 'red' ? 'red' : i.tone === 'amber' ? 'amber' : 'secondary'] }} />
                <span className="gn-tabs-kind" style={{ color: TONE_HEX[i.tone === 'red' ? 'red' : i.tone === 'amber' ? 'amber' : 'secondary'] }}>
                  {i.type === 'alert' ? 'ALERT' : 'APPROVAL'}
                </span>
                <span className="gn-tabs-site">{i.siteName}</span>
                <span className="gn-tabs-agent">{i.agentName ?? '—'}</span>
                <span className="gn-tabs-summary" title={i.title}>{i.title}</span>
                <span className="gn-tabs-time">{i.timestampLabel}</span>
              </Link>
            ))
          )}
          {attention.length > 0 && <div className="gn-tabs-note">{attention.length} item{attention.length === 1 ? '' : 's'}.</div>}
        </div>
      )}

      {/* Run history */}
      {tab === 'history' && (
        <div className="gn-tabs-body">
          <div className="gn-tabs-history-filter">
            <select value={runStatus} onChange={(e) => { setRunStatus(e.target.value); setRunPage(0); }} className={selectCls}>
              <option value="">Status: all</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <span className="gn-tabs-note">Showing {pageRows.length} of {history.length} runs.</span>
          </div>

          {pageRows.length === 0 ? (
            <div className="gn-tabs-empty">No runs match the current filters.</div>
          ) : (
            <div className="gn-tabs-history">
              {pageRows.map((r) => (
                <Link key={r.runKey} to={`/ai-operations/runs/${r.runKey}`} className="gn-tabs-row gn-tabs-row-link">
                  <span className="gn-status-dot" style={{ background: TONE_HEX[r.tone] }} />
                  <span className="gn-tabs-kind font-mono" style={{ color: TONE_HEX[r.tone] }}>{r.status.replace(/_/g, ' ').toUpperCase()}</span>
                  <span className="gn-tabs-site">{r.siteName}</span>
                  <span className="gn-tabs-agent">{r.agentName ?? '—'}</span>
                  <span className="gn-tabs-summary" title={r.summary ?? undefined}>{r.summary ?? '—'}</span>
                  <span className="gn-tabs-duration">{r.durationLabel ?? '—'}</span>
                  <span className="gn-tabs-time">{r.startedAt ? r.startedAt.slice(0, 16) : '—'}</span>
                </Link>
              ))}
            </div>
          )}

          {pageCount > 1 && (
            <div className="gn-tabs-pager">
              <button type="button" disabled={safePage === 0} onClick={() => setRunPage((p) => p - 1)} className="gn-zoom-btn">
                <i className="ri-arrow-left-s-line"></i>
              </button>
              <span className="gn-tabs-page">{safePage + 1} / {pageCount}</span>
              <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setRunPage((p) => p + 1)} className="gn-zoom-btn">
                <i className="ri-arrow-right-s-line"></i>
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}