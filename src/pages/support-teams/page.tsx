import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import usePermissions from '@/hooks/usePermissions';
import ConfirmDialog from '@/components/base/ConfirmDialog';
import type { SupportTeam } from '@/types/support-tickets';
import {
  useSupportTeams,
  useTeamWorkload,
  useSupportSites,
  useTeamStaff,
  friendlyRpcError,
} from './hooks';
import {
  routingStrategyLabels,
  teamStatusLabels,
  teamStatusColors,
} from './constants';
import TeamFormModal from './components/TeamFormModal';
import TeamMembersModal from './components/TeamMembersModal';
import TeamSitesModal from './components/TeamSitesModal';

export default function SupportTeamsPage() {
  const { canManageStaff } = usePermissions();
  const { teams, loading, error, refresh } = useSupportTeams();
  const { workload } = useTeamWorkload();
  const { sites } = useSupportSites();
  const { staff } = useTeamStaff();

  const [formOpen, setFormOpen] = useState(false);
  const [formTarget, setFormTarget] = useState<SupportTeam | null>(null);
  const [membersTarget, setMembersTarget] = useState<SupportTeam | null>(null);
  const [sitesTarget, setSitesTarget] = useState<SupportTeam | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<SupportTeam | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3600);
  };

  const workloadById = (teamId: string) => workload.find((w) => w.team_id === teamId);

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setActionLoading(true);
    const { error: e } = await supabase.rpc('internal_archive_support_team', {
      p_team_id: archiveTarget.id,
    });
    setActionLoading(false);
    setArchiveTarget(null);
    if (e) {
      showToast(friendlyRpcError(e), 'error');
      return;
    }
    showToast('Team archived', 'success');
    refresh();
  };

  if (!canManageStaff) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Support Teams</h1>
        </div>
        <div className="bg-background-100 border border-background-200/60 rounded-lg px-6 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-lock-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">Restricted</h3>
          <p className="text-sm text-foreground-500">Only owners and admins can manage support teams.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Support Teams</h1>
          <p className="text-sm text-foreground-500 mt-1">
            Route tickets to the right team, set membership and site coverage.
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
          New Team
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={refresh} className="text-sm text-red-300 underline cursor-pointer whitespace-nowrap">Retry</button>
        </div>
      )}

      {/* Team table */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-background-200/60">
          <h2 className="text-base font-heading font-semibold text-foreground-50">Teams</h2>
          <p className="text-xs text-foreground-500 mt-0.5">{teams.length} team(s)</p>
        </div>

        {loading ? (
          <div className="p-6 animate-pulse space-y-3">
            <div className="h-12 bg-background-200/50 rounded-lg"></div>
            <div className="h-12 bg-background-200/50 rounded-lg"></div>
          </div>
        ) : teams.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-foreground-500">No teams yet. Create one to start routing tickets.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-foreground-500 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 font-label">Team</th>
                  <th className="px-5 py-3 font-label">Manager</th>
                  <th className="px-5 py-3 font-label">Members</th>
                  <th className="px-5 py-3 font-label">Sites</th>
                  <th className="px-5 py-3 font-label">Open</th>
                  <th className="px-5 py-3 font-label">Strategy</th>
                  <th className="px-5 py-3 font-label">Status</th>
                  <th className="px-5 py-3 font-label text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-background-200/60">
                {teams.map((t) => {
                  const wl = workloadById(t.id);
                  return (
                    <tr key={t.id} className="hover:bg-background-200/30 transition-colors align-top">
                      <td className="px-5 py-3">
                        <p className="text-foreground-100 font-medium whitespace-nowrap">{t.name}</p>
                        {t.description && (
                          <p className="text-xs text-foreground-500 max-w-[240px] truncate">{t.description}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-foreground-400 whitespace-nowrap">
                        {t.manager_name ?? <span className="text-foreground-600 italic">—</span>}
                      </td>
                      <td className="px-5 py-3 text-foreground-300 whitespace-nowrap">{t.member_count}</td>
                      <td className="px-5 py-3 text-foreground-400 max-w-[220px]">
                        {t.site_names.length > 0 ? (
                          <span className="truncate block">{t.site_names.join(', ')}</span>
                        ) : (
                          <span className="text-foreground-600 italic">All / none assigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-foreground-300 whitespace-nowrap">
                        {t.open_tickets}
                        {wl && wl.urgent_tickets > 0 && (
                          <span className="ml-1.5 text-[10px] text-orange-400 whitespace-nowrap">({wl.urgent_tickets} urgent)</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-foreground-400 whitespace-nowrap">
                        {routingStrategyLabels[t.routing_strategy]}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] font-label px-2 py-0.5 rounded uppercase whitespace-nowrap ${teamStatusColors[t.status]}`}>
                          {teamStatusLabels[t.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setFormTarget(t);
                              setFormOpen(true);
                            }}
                            title="Edit team"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-400 hover:text-accent-400 hover:bg-background-200/60 transition-colors cursor-pointer"
                          >
                            <i className="ri-edit-line text-base w-4 h-4 flex items-center justify-center"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => setMembersTarget(t)}
                            title="Manage members"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-400 hover:text-accent-400 hover:bg-background-200/60 transition-colors cursor-pointer"
                          >
                            <i className="ri-group-line text-base w-4 h-4 flex items-center justify-center"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSitesTarget(t)}
                            title="Manage sites"
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-400 hover:text-accent-400 hover:bg-background-200/60 transition-colors cursor-pointer"
                          >
                            <i className="ri-earth-line text-base w-4 h-4 flex items-center justify-center"></i>
                          </button>
                          {t.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => setArchiveTarget(t)}
                              title="Archive team"
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-400 hover:text-red-400 hover:bg-background-200/60 transition-colors cursor-pointer"
                            >
                              <i className="ri-archive-line text-base w-4 h-4 flex items-center justify-center"></i>
                            </button>
                          )}
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

      {/* Workload */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-background-200/60">
          <h2 className="text-base font-heading font-semibold text-foreground-50">Team Workload</h2>
          <p className="text-xs text-foreground-500 mt-0.5">Current operational load per team (excludes resolved/closed).</p>
        </div>
        {workload.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-foreground-500">No workload data yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5">
            {workload.map((w) => (
              <div key={w.team_id} className="bg-background-50 border border-background-200/60 rounded-lg p-4">
                <p className="text-sm font-medium text-foreground-100 truncate">{w.name}</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground-500">Open</span>
                    <span className="text-sm font-semibold text-foreground-100">{w.open_tickets}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground-500">Urgent</span>
                    <span className="text-sm font-semibold text-orange-400">{w.urgent_tickets}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground-500">SLA risk</span>
                    <span className="text-sm font-semibold text-amber-400">{w.sla_risk}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground-500">Escalated</span>
                    <span className="text-sm font-semibold text-red-400">{w.escalated_tickets}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <TeamFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        team={formTarget}
        staff={staff}
        onSaved={refresh}
      />
      <TeamMembersModal
        open={membersTarget !== null}
        onClose={() => setMembersTarget(null)}
        team={membersTarget}
        staff={staff}
        onSaved={refresh}
      />
      <TeamSitesModal
        open={sitesTarget !== null}
        onClose={() => setSitesTarget(null)}
        team={sitesTarget}
        sites={sites}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        title="Archive team"
        message={`Archive "${archiveTarget?.name ?? ''}"? It will stop receiving new tickets. Existing ticket history is preserved.`}
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