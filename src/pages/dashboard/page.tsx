import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface DashboardStats {
  projects: { total: number; live: number; building: number; idea: number };
  ideas: { total: number; approved: number; new: number };
  changeRequests: { total: number; inProgress: number; approved: number };
  prompts: { total: number; worked: number };
  bugs: { total: number; open: number; critical: number };
  notes: { total: number; pinned: number };
  filesLinks: { total: number };
  roadmapItems: { total: number; inProgress: number };
  recentActivity: { id: number; description: string; entity_type: string; created_at: string; project_id: number | null }[];
  criticalBugs: { id: number; title: string; project_name: string }[];
  buildChecklists: number;
  buildBlockers: number;
  buildNextActions: { id: number; item_title: string; run_name: string; project_name: string; stage_title: string; is_launch_blocker: boolean }[];
  budgetTotal: number;
  budgetSpend: number;
  budgetMonthly: number;
  budgetBlockers: number;
  budgetWarnings: { project_name: string; budget_name: string; warning: string; type: string }[];
  upcomingPayments: { recurring_name: string; project_name: string; monthly_cost: number; next_payment_date: string }[];
}

function SkeletonCard() {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 animate-pulse">
      <div className="h-3 w-16 bg-background-300/40 rounded mb-3"></div>
      <div className="h-7 w-12 bg-background-300/40 rounded mb-1"></div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="animate-pulse flex items-center gap-4 py-3">
      <div className="w-2 h-2 rounded-full bg-background-300/40"></div>
      <div className="flex-1 h-3 bg-background-300/40 rounded"></div>
    </div>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: number; icon: string; accent: string }) {
  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 hover:border-background-300/60 transition-colors duration-150">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
          <i className={`${icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
        </div>
      </div>
      <p className="text-2xl font-heading font-bold text-foreground-100">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (!stats) return;
    loadBuildNextActions();
  }, [stats?.buildChecklists]);

  useEffect(() => {
    if (!stats || stats.budgetTotal === 0) return;
    resolveBudgetData();
  }, [stats?.budgetTotal]);

  const loadBuildNextActions = async () => {
    try {
      const { data: items } = await supabase
        .from('internal_build_process_run_items')
        .select('id,item_title,run_id,stage_title,is_launch_blocker')
        .eq('is_required', true)
        .eq('checked', false)
        .order('item_order')
        .limit(5);

      if (!items || items.length === 0) return;

      const runIds = [...new Set(items.map((i) => i.run_id))];
      const { data: runs } = await supabase
        .from('internal_build_process_runs')
        .select('id,run_name,project_id')
        .in('id', runIds);

      const runMap: Record<number, { run_name: string; project_id: number | null }> = {};
      runs?.forEach((r) => { runMap[r.id] = { run_name: r.run_name, project_id: r.project_id }; });

      const projectIds = [...new Set(runs?.map((r) => r.project_id).filter(Boolean) ?? [])] as number[];
      const { data: projects } = await supabase
        .from('internal_projects')
        .select('id,project_name')
        .in('id', projectIds);

      const projectMap: Record<number, string> = {};
      projects?.forEach((p) => { projectMap[p.id] = p.project_name; });

      const nextActions = items.map((item) => {
        const run = runMap[item.run_id];
        return {
          id: item.id,
          item_title: item.item_title,
          run_name: run?.run_name ?? 'Unknown',
          project_name: run?.project_id ? (projectMap[run.project_id] ?? 'Unknown') : '—',
          stage_title: item.stage_title,
          is_launch_blocker: item.is_launch_blocker,
        };
      });

      setStats((prev) => prev ? { ...prev, buildNextActions: nextActions } : prev);
    } catch { /* ignore */ }
  };

  const resolveBudgetData = async () => {
    try {
      const { data: budgets } = await supabase
        .from('internal_project_budgets')
        .select('id,budget_name,project_id,approved_budget,actual_spend,remaining_budget')
        .eq('budget_status', 'active');

      if (!budgets || budgets.length === 0) return;

      const projectIds = [...new Set(budgets.map((b) => b.project_id).filter(Boolean))] as number[];
      const { data: allProjects } = await supabase.from('internal_projects').select('id,project_name').in('id', projectIds);
      const projectMap: Record<number, string> = {};
      allProjects?.forEach((p) => { projectMap[p.id] = p.project_name; });

      let totalSpend = 0;
      let monthlyRun = 0;
      const warnings: { project_name: string; budget_name: string; warning: string; type: string }[] = [];

      budgets.forEach((b) => {
        totalSpend += b.actual_spend || 0;
        const name = projectMap[b.project_id] ?? 'Unknown';
        if (b.approved_budget > 0 && b.actual_spend > b.approved_budget) {
          warnings.push({ project_name: name, budget_name: b.budget_name, warning: `Over budget by £${(b.actual_spend - b.approved_budget).toLocaleString()}`, type: 'over_budget' });
        } else if (b.approved_budget > 0 && b.actual_spend / b.approved_budget >= 0.75) {
          warnings.push({ project_name: name, budget_name: b.budget_name, warning: 'At 75%+ of budget', type: 'warning' });
        }
        if (b.approved_budget <= 0) {
          warnings.push({ project_name: name, budget_name: b.budget_name, warning: 'No approved budget', type: 'no_budget' });
        }
      });

      const { data: recurring } = await supabase
        .from('internal_project_recurring_costs')
        .select('monthly_cost')
        .eq('status', 'active');
      monthlyRun = recurring?.reduce((s, r) => s + (r.monthly_cost || 0), 0) ?? 0;

      const { data: upcoming } = await supabase
        .from('internal_project_recurring_costs')
        .select('recurring_name,project_id,monthly_cost,next_payment_date')
        .eq('status', 'active')
        .order('next_payment_date')
        .limit(5);

      const upcomingPmts = (upcoming ?? []).map((u) => ({
        recurring_name: u.recurring_name,
        project_name: projectMap[u.project_id] ?? 'Unknown',
        monthly_cost: u.monthly_cost,
        next_payment_date: u.next_payment_date,
      }));

      setStats((prev) => prev ? { ...prev, budgetSpend: totalSpend, budgetMonthly: monthlyRun, budgetWarnings: warnings.slice(0, 5), upcomingPayments: upcomingPmts } : prev);
    } catch { /* ignore */ }
  };

  const loadStats = async () => {
    try {
      const [
        { count: projectsTotal }, { count: projectsLive }, { count: projectsBuilding }, { count: projectsIdea },
        { count: ideasTotal }, { count: ideasApproved }, { count: ideasNew },
        { count: crTotal }, { count: crInProgress }, { count: crApproved },
        { count: promptsTotal }, { count: promptsWorked },
        { count: bugsTotal }, { count: bugsOpen }, { count: bugsCritical },
        { count: notesTotal }, { count: notesPinned },
        { count: flTotal },
        { count: rmTotal }, { count: rmInProgress },
        { data: recentActivity },
        { data: criticalBugs },
        { count: buildChecklists },
        { count: buildBlockers },
        { data: buildNextActions },
        { count: budgetTotal },
        { count: budgetSpendCount },
        { count: budgetBlockers },
        { data: budgetActive },
        { data: upcomingPayments },
      ] = await Promise.all([
        supabase.from('internal_projects').select('*', { count: 'exact', head: true }),
        supabase.from('internal_projects').select('*', { count: 'exact', head: true }).eq('status', 'live'),
        supabase.from('internal_projects').select('*', { count: 'exact', head: true }).eq('status', 'building'),
        supabase.from('internal_projects').select('*', { count: 'exact', head: true }).eq('status', 'idea'),
        supabase.from('internal_ideas').select('*', { count: 'exact', head: true }),
        supabase.from('internal_ideas').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('internal_ideas').select('*', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('internal_change_requests').select('*', { count: 'exact', head: true }),
        supabase.from('internal_change_requests').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('internal_change_requests').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('internal_prompts').select('*', { count: 'exact', head: true }),
        supabase.from('internal_prompts').select('*', { count: 'exact', head: true }).eq('status', 'worked'),
        supabase.from('internal_bugs').select('*', { count: 'exact', head: true }),
        supabase.from('internal_bugs').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('internal_bugs').select('*', { count: 'exact', head: true }).eq('severity', 'critical'),
        supabase.from('internal_notes').select('*', { count: 'exact', head: true }),
        supabase.from('internal_notes').select('*', { count: 'exact', head: true }).eq('pinned', true),
        supabase.from('internal_files_links').select('*', { count: 'exact', head: true }),
        supabase.from('internal_roadmap').select('*', { count: 'exact', head: true }),
        supabase.from('internal_roadmap').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('internal_activity_log').select('id,description,entity_type,created_at,project_id').order('created_at', { ascending: false }).limit(10),
        supabase.from('internal_bugs').select('id,title,project_id').eq('severity', 'critical').eq('status', 'open').limit(5),
        supabase.from('internal_build_process_runs').select('*', { count: 'exact', head: true }).eq('run_status', 'active'),
        supabase.from('internal_build_process_run_items').select('*', { count: 'exact', head: true }).eq('is_launch_blocker', true).eq('checked', false),
        supabase.from('internal_build_process_run_items').select('id,item_title,run_id,stage_title,is_launch_blocker').eq('is_required', true).eq('checked', false).order('item_order').limit(5),
        supabase.from('internal_project_budgets').select('*', { count: 'exact', head: true }).eq('budget_status', 'active'),
        supabase.from('internal_project_cost_items').select('*', { count: 'exact', head: true }).eq('is_required_for_launch', true).eq('payment_status', 'unpaid').neq('cost_status', 'cancelled'),
        supabase.from('internal_project_cost_items').select('*', { count: 'exact', head: true }).eq('is_required_for_launch', true).neq('payment_status', 'paid').neq('cost_status', 'cancelled'),
        supabase.from('internal_project_budgets').select('id,budget_name,project_id,approved_budget,actual_spend,remaining_budget').eq('budget_status', 'active'),
        supabase.from('internal_project_recurring_costs').select('recurring_name,project_id,monthly_cost,next_payment_date').eq('status', 'active').order('next_payment_date').limit(5),
      ]);

      const projectNameMap: Record<number, string> = {};
      if (criticalBugs) {
        const projectIds = [...new Set(criticalBugs.map(b => b.project_id))];
        if (projectIds.length > 0) {
          const { data: projects } = await supabase.from('internal_projects').select('id,project_name').in('id', projectIds);
          projects?.forEach(p => { projectNameMap[p.id] = p.project_name; });
        }
      }

      setStats({
        projects: { total: projectsTotal ?? 0, live: projectsLive ?? 0, building: projectsBuilding ?? 0, idea: projectsIdea ?? 0 },
        ideas: { total: ideasTotal ?? 0, approved: ideasApproved ?? 0, new: ideasNew ?? 0 },
        changeRequests: { total: crTotal ?? 0, inProgress: crInProgress ?? 0, approved: crApproved ?? 0 },
        prompts: { total: promptsTotal ?? 0, worked: promptsWorked ?? 0 },
        bugs: { total: bugsTotal ?? 0, open: bugsOpen ?? 0, critical: bugsCritical ?? 0 },
        notes: { total: notesTotal ?? 0, pinned: notesPinned ?? 0 },
        filesLinks: { total: flTotal ?? 0 },
        roadmapItems: { total: rmTotal ?? 0, inProgress: rmInProgress ?? 0 },
        recentActivity: recentActivity ?? [],
        criticalBugs: (criticalBugs ?? []).map(b => ({ id: b.id, title: b.title, project_name: projectNameMap[b.project_id] ?? 'Unknown' })),
        buildChecklists: buildChecklists ?? 0,
        buildBlockers: buildBlockers ?? 0,
        buildNextActions: [],
        budgetTotal: budgetTotal ?? 0,
        budgetSpend: 0,
        budgetMonthly: 0,
        budgetBlockers: budgetBlockers ?? 0,
        budgetWarnings: [],
        upcomingPayments: [],
      });
    } catch {
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground-50">Dashboard</h1>
          <p className="text-sm text-foreground-500 mt-1">Overview of all projects and activity.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 18 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-foreground-400 text-sm mb-4">{error}</p>
        <button onClick={loadStats} className="bg-accent-500 text-background-950 px-4 py-2 rounded-full text-sm font-medium hover:bg-accent-400 transition-colors whitespace-nowrap cursor-pointer">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground-50">Dashboard</h1>
        <p className="text-sm text-foreground-500 mt-1">Overview of all projects and activity.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Projects" value={stats.projects.total} icon="ri-folder-3-line" accent="bg-primary-500/10 text-primary-400" />
        <StatCard label="Ideas" value={stats.ideas.total} icon="ri-lightbulb-line" accent="bg-yellow-500/10 text-yellow-400" />
        <StatCard label="Change Requests" value={stats.changeRequests.total} icon="ri-git-pull-request-line" accent="bg-accent-500/10 text-accent-400" />
        <StatCard label="Prompts" value={stats.prompts.total} icon="ri-terminal-box-line" accent="bg-emerald-500/10 text-emerald-400" />
        <StatCard label="Bugs" value={stats.bugs.total} icon="ri-bug-line" accent="bg-red-500/10 text-red-400" />
        <StatCard label="Open Bugs" value={stats.bugs.open} icon="ri-bug-2-line" accent="bg-red-500/10 text-red-400" />
        <StatCard label="Notes" value={stats.notes.total} icon="ri-sticky-note-line" accent="bg-secondary-500/10 text-secondary-300" />
        <StatCard label="Files & Links" value={stats.filesLinks.total} icon="ri-links-line" accent="bg-sky-500/10 text-sky-400" />
        <StatCard label="Roadmap Items" value={stats.roadmapItems.total} icon="ri-road-map-line" accent="bg-violet-500/10 text-violet-400" />
        <StatCard label="Active" value={stats.projects.building + stats.projects.live} icon="ri-flashlight-line" accent="bg-emerald-500/10 text-emerald-400" />
        <StatCard label="Critical Bugs" value={stats.bugs.critical} icon="ri-alert-line" accent="bg-red-500/10 text-red-400" />
        <StatCard label="Build Checklists" value={stats.buildChecklists} icon="ri-list-check-3" accent="bg-accent-500/10 text-accent-400" />
        <StatCard label="Open Build Blockers" value={stats.buildBlockers} icon="ri-shield-flash-line" accent="bg-red-500/10 text-red-400" />
        <StatCard label="Pinned Notes" value={stats.notes.pinned} icon="ri-pushpin-line" accent="bg-secondary-500/10 text-secondary-300" />
        <StatCard label="Total Budget" value={stats.budgetTotal} icon="ri-funds-line" accent="bg-accent-500/10 text-accent-400" />
        <StatCard label="Actual Spend" value={Math.round(stats.budgetSpend)} icon="ri-bank-card-line" accent="bg-amber-500/10 text-amber-400" />
        <StatCard label="Monthly Running" value={Math.round(stats.budgetMonthly)} icon="ri-repeat-line" accent="bg-violet-500/10 text-violet-400" />
        <StatCard label="Budget Blockers" value={stats.budgetBlockers} icon="ri-alert-line" accent="bg-red-500/10 text-red-400" />
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Activity */}
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-4">Recent Activity</h3>
          {stats.recentActivity.length === 0 ? (
            <p className="text-sm text-foreground-500">No activity yet.</p>
          ) : (
            <div className="space-y-1">
              {stats.recentActivity.map((a) => (
                <div key={a.id} className="flex items-start gap-3 py-2 border-b border-background-200/40 last:border-0">
                  <div className="w-2 h-2 mt-2 rounded-full bg-accent-400 shrink-0"></div>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground-200">{a.description}</p>
                    <p className="text-xs text-foreground-500 mt-0.5">
                      {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      <span className="mx-1.5">&middot;</span>
                      <span className="text-foreground-600">{a.entity_type.replace(/_/g, ' ')}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Critical Bugs */}
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-4">Critical Open Bugs</h3>
          {stats.criticalBugs.length === 0 ? (
            <p className="text-sm text-foreground-500">No critical bugs — nice!</p>
          ) : (
            <div className="space-y-1">
              {stats.criticalBugs.map((b) => (
                <div key={b.id} className="flex items-start gap-3 py-2 border-b border-background-200/40 last:border-0">
                  <div className="w-2 h-2 mt-2 rounded-full bg-red-400 shrink-0"></div>
                  <div className="min-w-0">
                    <p className="text-sm text-red-300 font-medium">{b.title}</p>
                    <p className="text-xs text-foreground-500 mt-0.5">{b.project_name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Build Process Next Actions */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Build Process — Next Actions</h3>
          <a href="/build-process" className="text-xs text-accent-400 hover:text-accent-300 transition-colors whitespace-nowrap">View All</a>
        </div>
        {stats.buildNextActions.length === 0 ? (
          <p className="text-sm text-foreground-500">All required build items are complete — nothing left to do!</p>
        ) : (
          <div className="space-y-1.5">
            {stats.buildNextActions.map((action) => (
              <div key={action.id} className="flex items-start gap-2.5 py-2 px-3 bg-background-50 rounded-lg border border-background-200/40">
                <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-accent-400 shrink-0"></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground-200 line-clamp-1">{action.item_title}</p>
                  <p className="text-[10px] text-foreground-600 mt-0.5">
                    {action.project_name} &middot; {action.run_name} &middot; {action.stage_title}
                    {action.is_launch_blocker && <span className="ml-1.5 text-red-400 font-medium">BLOCKER</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Budget Warnings + Upcoming Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Budget Warnings</h3>
            <a href="/project-budget" className="text-xs text-accent-400 hover:text-accent-300 transition-colors whitespace-nowrap">View All</a>
          </div>
          {stats.budgetWarnings.length === 0 ? (
            <p className="text-sm text-emerald-400">All budgets healthy!</p>
          ) : (
            <div className="space-y-1.5">
              {stats.budgetWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2.5 py-2 px-3 bg-background-50 rounded-lg border border-background-200/40">
                  <div className={`w-1.5 h-1.5 mt-1.5 rounded-full shrink-0 ${w.type === 'over_budget' ? 'bg-red-400' : w.type === 'warning' ? 'bg-amber-400' : 'bg-sky-400'}`}></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground-200 line-clamp-1">{w.project_name} — {w.budget_name}</p>
                    <p className="text-[10px] text-foreground-600 mt-0.5">{w.warning}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Upcoming Payments</h3>
            <a href="/project-budget" className="text-xs text-accent-400 hover:text-accent-300 transition-colors whitespace-nowrap">View All</a>
          </div>
          {stats.upcomingPayments.length === 0 ? (
            <p className="text-sm text-foreground-500">No upcoming payments in the near future.</p>
          ) : (
            <div className="space-y-1.5">
              {stats.upcomingPayments.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 bg-background-50 rounded-lg border border-background-200/40">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground-200 truncate">{p.recurring_name}</p>
                    <p className="text-[10px] text-foreground-600">{p.project_name} — {p.next_payment_date ? new Date(p.next_payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</p>
                  </div>
                  <span className="text-sm font-medium text-foreground-200 whitespace-nowrap ml-3">£{p.monthly_cost}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}