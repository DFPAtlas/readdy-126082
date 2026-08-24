import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import usePermissions from '@/hooks/usePermissions';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import type { SupportRoutingRule } from '@/types/support-tickets';
import { useRoutingRules, useSupportTeams, useSupportSites, friendlyRpcError } from '@/pages/support-teams/hooks';
import { categoryLabels, priorityLabels } from '@/pages/support-tickets/constants';
import RoutingRuleFormModal from './components/RoutingRuleFormModal';

export default function SupportRoutingPage() {
  const { canManageStaff } = usePermissions();
  const { rules, loading, error, refresh } = useRoutingRules();
  const { teams } = useSupportTeams();
  const { sites } = useSupportSites();

  const [formOpen, setFormOpen] = useState(false);
  const [formTarget, setFormTarget] = useState<SupportRoutingRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupportRoutingRule | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3600);
  };

  const toggleActive = async (rule: SupportRoutingRule) => {
    const { error: e } = await supabase.rpc('internal_upsert_routing_rule', {
      p_rule_id: rule.id,
      p_name: rule.name,
      p_rule_order: rule.rule_order,
      p_is_active: !rule.is_active,
      p_site_id: rule.site_id,
      p_category: rule.category,
      p_priority: rule.priority,
      p_keywords: rule.keywords,
      p_match_security: rule.match_security,
      p_match_billing: rule.match_billing,
      p_team_id: rule.team_id,
      p_suggested_priority: rule.suggested_priority,
      p_requires_escalation: rule.requires_escalation,
    });
    if (e) {
      showToast(friendlyRpcError(e), 'error');
      return;
    }
    showToast(rule.is_active ? 'Rule disabled' : 'Rule enabled', 'success');
    refresh();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    const { error: e } = await supabase.rpc('internal_delete_routing_rule', {
      p_rule_id: deleteTarget.id,
    });
    setActionLoading(false);
    setDeleteTarget(null);
    if (e) {
      showToast(friendlyRpcError(e), 'error');
      return;
    }
    showToast('Rule deleted', 'success');
    refresh();
  };

  if (!canManageStaff) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Routing Rules</h1>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-lock-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">Restricted</h3>
          <p className="text-sm text-foreground-500">Only owners and admins can manage routing rules.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Routing Rules</h1>
          <p className="text-sm text-foreground-500 mt-1">
            Deterministic rules that route incoming tickets to the right team. Lower order runs first.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormTarget(null);
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-5 py-2.5 rounded-full transition-all duration-200 whitespace-nowrap cursor-pointer"
        >
          <i className="ri-add-line text-base w-4 h-4 flex items-center justify-center"></i>
          New Rule
        </button>
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
        ) : rules.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
              <i className="ri-git-branch-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
            </div>
            <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">No routing rules yet</h3>
            <p className="text-sm text-foreground-500 max-w-md mx-auto mb-5">
              Without rules, tickets fall back to each site&apos;s default team — or Needs Review if none is set.
            </p>
            <button
              type="button"
              onClick={() => {
                setFormTarget(null);
                setFormOpen(true);
              }}
              className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              Create your first rule
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-foreground-500 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 font-label">#</th>
                  <th className="px-5 py-3 font-label">Rule</th>
                  <th className="px-5 py-3 font-label">When</th>
                  <th className="px-5 py-3 font-label">Then</th>
                  <th className="px-5 py-3 font-label">Active</th>
                  <th className="px-5 py-3 font-label text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-background-200/60">
                {rules.map((r) => {
                  const conditions: string[] = [];
                  if (r.site_name) conditions.push(`Site: ${r.site_name}`);
                  if (r.category) conditions.push(categoryLabels[r.category as keyof typeof categoryLabels] ?? r.category);
                  if (r.priority) conditions.push(priorityLabels[r.priority as keyof typeof priorityLabels] ?? r.priority);
                  if (r.keywords) conditions.push(`Keywords: ${r.keywords}`);
                  if (r.match_security) conditions.push('Security');
                  if (r.match_billing) conditions.push('Billing');

                  const results: string[] = [`Team: ${r.team_name ?? '—'}`];
                  if (r.suggested_priority) results.push(`Priority: ${priorityLabels[r.suggested_priority as keyof typeof priorityLabels] ?? r.suggested_priority}`);
                  if (r.requires_escalation) results.push('Escalate');

                  return (
                    <tr key={r.id} className={`hover:bg-background-200/30 transition-colors align-top ${!r.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3 text-foreground-500 whitespace-nowrap">{r.rule_order}</td>
                      <td className="px-5 py-3 text-foreground-100 font-medium whitespace-nowrap">{r.name}</td>
                      <td className="px-5 py-3 text-foreground-400 max-w-[260px]">
                        <span className="block truncate">{conditions.length ? conditions.join(' · ') : 'Any ticket'}</span>
                      </td>
                      <td className="px-5 py-3 text-foreground-300 max-w-[220px]">
                        <span className="block truncate">{results.join(' · ')}</span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => toggleActive(r)}
                          aria-pressed={r.is_active}
                          title={r.is_active ? 'Disable rule' : 'Enable rule'}
                          className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                            r.is_active ? 'bg-accent-500' : 'bg-background-300/70'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                              r.is_active ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          ></span>
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setFormTarget(r);
                              setFormOpen(true);
                            }}
                            title="Edit rule"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-400 hover:text-accent-400 hover:bg-background-200/60 transition-colors cursor-pointer"
                          >
                            <i className="ri-edit-line text-base w-4 h-4 flex items-center justify-center"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(r)}
                            title="Delete rule"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-400 hover:text-red-400 hover:bg-background-200/60 transition-colors cursor-pointer"
                          >
                            <i className="ri-delete-bin-line text-base w-4 h-4 flex items-center justify-center"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RoutingRuleFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        rule={formTarget}
        teams={teams}
        sites={sites}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete routing rule"
        message={`Delete "${deleteTarget?.name ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
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