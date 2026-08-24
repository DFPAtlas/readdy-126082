import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import usePermissions from '@/hooks/usePermissions';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import type { KnowledgeArticle, KnowledgeStatus, ResolutionRecord } from '@/types/support-tickets';
import { useSupportSites } from '@/pages/support-teams/hooks';
import { categoryLabels, CATEGORY_OPTIONS } from '@/pages/support-tickets/constants';
import { useKnowledgeArticles, useResolutions, friendlyRpcError, type KnowledgeFilters, type ResolutionFilters } from './hooks';
import {
  KNOWLEDGE_STATUS_LABELS,
  KNOWLEDGE_STATUS_COLORS,
  KNOWLEDGE_VISIBILITY_LABELS,
  RESOLUTION_OUTCOME_LABELS,
  RESOLUTION_OUTCOME_COLORS,
} from './constants';
import ArticleFormModal from './components/ArticleFormModal';

type Tab = 'articles' | 'resolutions';

const selectCls =
  'bg-background-50 border border-background-300/60 rounded-lg px-2.5 py-1.5 text-sm text-foreground-100 outline-none cursor-pointer';

export default function SupportKnowledgePage() {
  const perms = usePermissions();
  const { sites } = useSupportSites();
  const [tab, setTab] = useState<Tab>('articles');

  const [kFilters, setKFilters] = useState<KnowledgeFilters>({
    site_id: '',
    category: '',
    status: '',
    visibility: '',
    search: '',
  });
  const [rFilters, setRFilters] = useState<ResolutionFilters>({ site_id: '', category: '', outcome: '' });

  const { articles, loading, error, refresh } = useKnowledgeArticles(kFilters);
  const { resolutions, loading: rLoading, error: rError, refresh: rRefresh } = useResolutions(rFilters);

  const [formOpen, setFormOpen] = useState(false);
  const [formTarget, setFormTarget] = useState<KnowledgeArticle | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<KnowledgeArticle | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3600);
  };

  const setStatus = async (article: KnowledgeArticle, status: KnowledgeStatus) => {
    setActionLoading(true);
    const { error: e } = await supabase.rpc('support_set_knowledge_status', {
      p_id: article.id,
      p_status: status,
    });
    setActionLoading(false);
    if (e) {
      showToast(friendlyRpcError(e), 'error');
      return;
    }
    showToast(
      status === 'approved' ? 'Article approved' : status === 'archived' ? 'Article archived' : 'Submitted for review',
      'success',
    );
    refresh();
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setActionLoading(true);
    const { error: e } = await supabase.rpc('support_set_knowledge_status', {
      p_id: archiveTarget.id,
      p_status: 'archived',
    });
    setActionLoading(false);
    setArchiveTarget(null);
    if (e) {
      showToast(friendlyRpcError(e), 'error');
      return;
    }
    showToast('Article archived', 'success');
    refresh();
  };

  const approveResolution = async (r: ResolutionRecord) => {
    setActionLoading(true);
    const { error: e } = await supabase.rpc('support_approve_resolution', { p_id: r.id });
    setActionLoading(false);
    if (e) {
      showToast(friendlyRpcError(e), 'error');
      return;
    }
    showToast('Resolution approved', 'success');
    rRefresh();
  };

  if (!perms.canViewKnowledge) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-heading font-bold text-foreground-50">Knowledge Base</h1></div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-lock-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">Restricted</h3>
          <p className="text-sm text-foreground-500">You do not have access to the knowledge base.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Knowledge Base</h1>
          <p className="text-sm text-foreground-500 mt-1">
            Reusable support content and approved resolution memory for faster, consistent replies.
          </p>
        </div>
        {perms.canCreateKnowledge && (
          <button
            type="button"
            onClick={() => {
              setFormTarget(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-5 py-2.5 rounded-full transition-all duration-200 whitespace-nowrap cursor-pointer"
          >
            <i className="ri-add-line text-base w-4 h-4 flex items-center justify-center"></i>
            New Article
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center p-1 rounded-full bg-background-100 border border-background-200/60">
        <button
          type="button"
          onClick={() => setTab('articles')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
            tab === 'articles' ? 'bg-background-50 text-foreground-50' : 'text-foreground-500 hover:text-foreground-200'
          }`}
        >
          Articles
        </button>
        <button
          type="button"
          onClick={() => setTab('resolutions')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
            tab === 'resolutions' ? 'bg-background-50 text-foreground-50' : 'text-foreground-500 hover:text-foreground-200'
          }`}
        >
          Resolutions
        </button>
      </div>

      {tab === 'articles' ? (
        <>
          {/* Article filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={kFilters.search}
              onChange={(e) => setKFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Search title or content…"
              className="bg-background-100 border border-background-300/60 rounded-lg px-3 py-1.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none min-w-[200px]"
            />
            <select
              value={kFilters.site_id}
              onChange={(e) => setKFilters((f) => ({ ...f, site_id: e.target.value }))}
              className={selectCls}
            >
              <option value="">All sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.site_name}</option>
              ))}
            </select>
            <select
              value={kFilters.category}
              onChange={(e) => setKFilters((f) => ({ ...f, category: e.target.value }))}
              className={selectCls}
            >
              <option value="">All categories</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{categoryLabels[c]}</option>
              ))}
            </select>
            <select
              value={kFilters.status}
              onChange={(e) => setKFilters((f) => ({ ...f, status: e.target.value }))}
              className={selectCls}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="review">In Review</option>
              <option value="approved">Approved</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={kFilters.visibility}
              onChange={(e) => setKFilters((f) => ({ ...f, visibility: e.target.value }))}
              className={selectCls}
            >
              <option value="">All visibility</option>
              <option value="customer_safe">Customer-safe</option>
              <option value="internal_only">Internal only</option>
            </select>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-sm text-red-400">{error}</p>
              <button onClick={refresh} className="text-sm text-red-300 underline cursor-pointer whitespace-nowrap">Retry</button>
            </div>
          )}

          <section className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-6 animate-pulse space-y-3">
                <div className="h-12 bg-background-200/50 rounded-lg"></div>
                <div className="h-12 bg-background-200/50 rounded-lg"></div>
              </div>
            ) : articles.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
                  <i className="ri-book-open-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
                </div>
                <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">No articles yet</h3>
                <p className="text-sm text-foreground-500 max-w-md mx-auto">
                  Create your first support article to help staff answer tickets faster.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-foreground-500 text-xs uppercase tracking-wider">
                      <th className="px-5 py-3 font-label">Title</th>
                      <th className="px-5 py-3 font-label">Site</th>
                      <th className="px-5 py-3 font-label">Category</th>
                      <th className="px-5 py-3 font-label">Visibility</th>
                      <th className="px-5 py-3 font-label">Status</th>
                      <th className="px-5 py-3 font-label">Ver.</th>
                      <th className="px-5 py-3 font-label">Last reviewed</th>
                      <th className="px-5 py-3 font-label text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-background-200/60">
                    {articles.map((a) => (
                      <tr key={a.id} className="hover:bg-background-200/30 transition-colors align-top">
                        <td className="px-5 py-3">
                          <p className="text-foreground-100 font-medium max-w-[260px]">{a.title}</p>
                          {a.summary && <p className="text-xs text-foreground-500 max-w-[260px] truncate">{a.summary}</p>}
                        </td>
                        <td className="px-5 py-3 text-foreground-400 whitespace-nowrap">
                          {a.site_name ?? <span className="text-foreground-600 italic">Global</span>}
                        </td>
                        <td className="px-5 py-3 text-foreground-400 whitespace-nowrap">
                          {a.category ? (categoryLabels[a.category as keyof typeof categoryLabels] ?? a.category) : '—'}
                        </td>
                        <td className="px-5 py-3 text-foreground-400 whitespace-nowrap">
                          {KNOWLEDGE_VISIBILITY_LABELS[a.visibility]}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-label px-2 py-0.5 rounded whitespace-nowrap ${KNOWLEDGE_STATUS_COLORS[a.status]}`}>
                            {a.review_due && a.status === 'approved' && (
                              <i className="ri-alarm-warning-line w-3 h-3 flex items-center justify-center"></i>
                            )}
                            {KNOWLEDGE_STATUS_LABELS[a.status]}
                            {a.review_due && a.status === 'approved' ? ' · Review due' : ''}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-foreground-500 whitespace-nowrap">v{a.version}</td>
                        <td className="px-5 py-3 text-foreground-500 whitespace-nowrap">
                          {a.last_reviewed_at ? new Date(a.last_reviewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {a.status === 'draft' && perms.canCreateKnowledge && (
                              <button
                                type="button"
                                onClick={() => setStatus(a, 'review')}
                                title="Submit for review"
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-400 hover:text-accent-400 hover:bg-background-200/60 transition-colors cursor-pointer"
                              >
                                <i className="ri-send-plane-line text-base w-4 h-4 flex items-center justify-center"></i>
                              </button>
                            )}
                            {(a.status === 'draft' || a.status === 'review') && perms.canApproveKnowledge && (
                              <button
                                type="button"
                                onClick={() => setStatus(a, 'approved')}
                                title="Approve"
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-400 hover:text-emerald-400 hover:bg-background-200/60 transition-colors cursor-pointer"
                              >
                                <i className="ri-check-double-line text-base w-4 h-4 flex items-center justify-center"></i>
                              </button>
                            )}
                            {perms.canEditKnowledge && (
                              <button
                                type="button"
                                onClick={() => {
                                  setFormTarget(a);
                                  setFormOpen(true);
                                }}
                                title="Edit article"
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-400 hover:text-accent-400 hover:bg-background-200/60 transition-colors cursor-pointer"
                              >
                                <i className="ri-edit-line text-base w-4 h-4 flex items-center justify-center"></i>
                              </button>
                            )}
                            {a.status !== 'archived' && perms.canArchiveKnowledge && (
                              <button
                                type="button"
                                onClick={() => setArchiveTarget(a)}
                                title="Archive article"
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-400 hover:text-red-400 hover:bg-background-200/60 transition-colors cursor-pointer"
                              >
                                <i className="ri-archive-line text-base w-4 h-4 flex items-center justify-center"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          {/* Resolution filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={rFilters.site_id}
              onChange={(e) => setRFilters((f) => ({ ...f, site_id: e.target.value }))}
              className={selectCls}
            >
              <option value="">All sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.site_name}</option>
              ))}
            </select>
            <select
              value={rFilters.category}
              onChange={(e) => setRFilters((f) => ({ ...f, category: e.target.value }))}
              className={selectCls}
            >
              <option value="">All categories</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{categoryLabels[c]}</option>
              ))}
            </select>
            <select
              value={rFilters.outcome}
              onChange={(e) => setRFilters((f) => ({ ...f, outcome: e.target.value }))}
              className={selectCls}
            >
              <option value="">All outcomes</option>
              <option value="resolved">Resolved</option>
              <option value="partially_resolved">Partially Resolved</option>
              <option value="workaround">Workaround</option>
              <option value="escalated">Escalated</option>
              <option value="known_issue">Known Issue</option>
            </select>
          </div>

          {rError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-sm text-red-400">{rError}</p>
              <button onClick={rRefresh} className="text-sm text-red-300 underline cursor-pointer whitespace-nowrap">Retry</button>
            </div>
          )}

          <section className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
            {rLoading ? (
              <div className="p-6 animate-pulse space-y-3">
                <div className="h-12 bg-background-200/50 rounded-lg"></div>
                <div className="h-12 bg-background-200/50 rounded-lg"></div>
              </div>
            ) : resolutions.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
                  <i className="ri-lightbulb-flash-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
                </div>
                <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">No resolutions yet</h3>
                <p className="text-sm text-foreground-500 max-w-md mx-auto">
                  Save resolutions from resolved tickets to build up resolution memory.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-foreground-500 text-xs uppercase tracking-wider">
                      <th className="px-5 py-3 font-label">Problem</th>
                      <th className="px-5 py-3 font-label">Site</th>
                      <th className="px-5 py-3 font-label">Category</th>
                      <th className="px-5 py-3 font-label">Resolution</th>
                      <th className="px-5 py-3 font-label">Outcome</th>
                      <th className="px-5 py-3 font-label">Status</th>
                      <th className="px-5 py-3 font-label text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-background-200/60">
                    {resolutions.map((r) => (
                      <tr key={r.id} className="hover:bg-background-200/30 transition-colors align-top">
                        <td className="px-5 py-3">
                          <p className="text-foreground-100 font-medium max-w-[260px]">{r.symptom ?? '—'}</p>
                        </td>
                        <td className="px-5 py-3 text-foreground-400 whitespace-nowrap">
                          {r.site_name ?? <span className="text-foreground-600 italic">Global</span>}
                        </td>
                        <td className="px-5 py-3 text-foreground-400 whitespace-nowrap">
                          {r.category ? (categoryLabels[r.category as keyof typeof categoryLabels] ?? r.category) : '—'}
                        </td>
                        <td className="px-5 py-3 text-foreground-400 max-w-[280px]">
                          <span className="block truncate">{r.resolution_action ?? r.root_cause ?? '—'}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-[10px] font-label px-2 py-0.5 rounded whitespace-nowrap ${RESOLUTION_OUTCOME_COLORS[r.outcome]}`}>
                            {RESOLUTION_OUTCOME_LABELS[r.outcome]}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-[10px] font-label px-2 py-0.5 rounded whitespace-nowrap ${r.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                            {r.status === 'approved' ? 'Approved' : 'Draft'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {r.status === 'draft' && perms.canApproveResolutions && (
                              <button
                                type="button"
                                onClick={() => approveResolution(r)}
                                disabled={actionLoading}
                                title="Approve resolution"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border border-background-300/60 text-foreground-300 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                              >
                                <i className="ri-check-double-line w-4 h-4 flex items-center justify-center"></i>
                                Approve
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <ArticleFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        article={formTarget}
        sites={sites}
        onSaved={() => {
          refresh();
          setFormTarget(null);
        }}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        title="Archive article"
        message={`Archive "${archiveTarget?.title ?? ''}"? It will no longer appear in related knowledge or be used for AI replies.`}
        confirmLabel="Archive"
        onConfirm={confirmArchive}
        loading={actionLoading}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-[120]">
          <div
            className={`px-4 py-3 rounded-lg border text-sm flex items-center gap-2 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.4)] ${
              toast.type === 'success'
                ? 'bg-background-200 border-emerald-500/40 text-emerald-300'
                : 'bg-background-200 border-red-500/40 text-red-300'
            }`}
          >
            <i className={`${toast.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'} text-base w-4 h-4 flex items-center justify-center`}></i>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}