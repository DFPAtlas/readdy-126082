import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Project, statusColors, priorityColors } from '../types';

interface ProjectHeaderProps {
  project: Project;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  buildStatusLabel?: string;
  buildStatusDetail?: string;
  uatStatusLabel?: string;
  uatStatusDetail?: string;
  budgetStatusLabel?: string;
  budgetStatusDetail?: string;
  supportStatusLabel?: string;
  supportStatusDetail?: string;
  monitoringStatusLabel?: string;
  monitoringStatusDetail?: string;
}

const operationalStatus: { label: string; state: string; icon: string }[] = [
  { label: 'BUILD', state: 'Not configured', icon: 'ri-hammer-line' },
  { label: 'UAT', state: 'Not configured', icon: 'ri-clipboard-line' },
  { label: 'BUDGET', state: 'No Budget', icon: 'ri-money-pound-circle-line' },
  { label: 'SUPPORT', state: 'Not configured', icon: 'ri-lifebuoy-line' },
  { label: 'AI OPS', state: 'Not connected', icon: 'ri-robot-2-line' },
  { label: 'GITHUB', state: 'Not connected', icon: 'ri-github-line' },
  { label: 'MONITORING', state: 'No data', icon: 'ri-pulse-line' },
];

export default function ProjectHeader({ project, onEdit, onArchive, onDelete, buildStatusLabel, buildStatusDetail, uatStatusLabel, uatStatusDetail, budgetStatusLabel, budgetStatusDetail, supportStatusLabel, supportStatusDetail, monitoringStatusLabel, monitoringStatusDetail }: ProjectHeaderProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const typeBadges: string[] = [];
  if (project.is_saas) typeBadges.push('SaaS');
  if (project.is_client_build) typeBadges.push('Client Build');
  if (project.is_internal_tool) typeBadges.push('Internal Tool');
  if (project.is_ai_powered) typeBadges.push('AI-Powered');

  const monthlyProfit = (project.monthly_revenue || 0) - (project.monthly_costs || 0);

  const displayStatus = operationalStatus.map((item) => {
    if (item.label === 'BUILD') return { ...item, state: buildStatusLabel ?? item.state, detail: buildStatusDetail };
    if (item.label === 'UAT') return { ...item, state: uatStatusLabel ?? item.state, detail: uatStatusDetail };
    if (item.label === 'BUDGET') return { ...item, state: budgetStatusLabel ?? item.state, detail: budgetStatusDetail };
    if (item.label === 'SUPPORT') return { ...item, state: supportStatusLabel ?? item.state, detail: supportStatusDetail };
    if (item.label === 'MONITORING') return { ...item, state: monitoringStatusLabel ?? item.state, detail: monitoringStatusDetail };
    return { ...item, detail: undefined as string | undefined };
  });

  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
      <div className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-2xl font-heading font-bold text-foreground-50">{project.project_name}</h1>

              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-pencil-line w-3.5 h-3.5 flex items-center justify-center"></i>
                Edit
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMoreOpen(!moreOpen)}
                  className="flex items-center justify-center w-8 h-8 text-foreground-400 hover:text-foreground-200 bg-background-50 border border-background-200/60 hover:border-background-300/60 rounded-full transition-colors cursor-pointer"
                >
                  <i className="ri-more-2-fill w-4 h-4 flex items-center justify-center"></i>
                </button>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)}></div>
                    <div className="absolute right-0 top-full mt-1.5 w-44 bg-background-50 border border-background-200/60 rounded-lg shadow-lg z-40 py-1.5 overflow-hidden">
                      {project.status !== 'archived' && (
                        <button
                          type="button"
                          onClick={() => { setMoreOpen(false); onArchive(); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground-300 hover:bg-background-100 hover:text-foreground-100 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <i className="ri-archive-line w-4 h-4 flex items-center justify-center text-foreground-400"></i>
                          Archive
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setMoreOpen(false); onDelete(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-delete-bin-line w-4 h-4 flex items-center justify-center"></i>
                        Delete Project
                      </button>
                    </div>
                  </>
                )}
              </div>

              <span className={`text-[10px] font-label px-1.5 py-0.5 rounded uppercase whitespace-nowrap ${statusColors[project.status] ?? 'text-foreground-500'}`}>
                {project.status.replace('_', ' ')}
              </span>
              <span className={`text-xs font-label ${priorityColors[project.priority] ?? ''} uppercase whitespace-nowrap`}>
                {project.priority}
              </span>
            </div>

            {project.description && (
              <p className="text-sm text-foreground-400 leading-relaxed max-w-3xl">{project.description}</p>
            )}

            {/* Meta strip */}
            <div className="flex items-center gap-x-4 gap-y-2 flex-wrap mt-4 text-xs text-foreground-500">
              {project.owner && (
                <span className="flex items-center gap-1.5">
                  <i className="ri-user-line w-3.5 h-3.5 flex items-center justify-center text-foreground-400"></i>
                  {project.owner}
                </span>
              )}
              {project.target_launch_date && (
                <span className="flex items-center gap-1.5">
                  <i className="ri-flag-line w-3.5 h-3.5 flex items-center justify-center text-foreground-400"></i>
                  Launch {new Date(project.target_launch_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
              {project.domain_live && (
                <a
                  href={`https://${project.domain_live}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-foreground-400 hover:text-accent-400 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                  <span className="font-mono">{project.domain_live}</span>
                </a>
              )}
              {project.domain_staging && (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                  <span className="font-mono text-foreground-400">{project.domain_staging}</span>
                </span>
              )}
              {project.tech_stack && (
                <span className="flex items-center gap-1.5">
                  <i className="ri-stack-line w-3.5 h-3.5 flex items-center justify-center text-foreground-400"></i>
                  <span className="font-mono text-foreground-400">{project.tech_stack}</span>
                </span>
              )}
            </div>
          </div>

          {/* Financial summary */}
          {(project.monthly_revenue > 0 || project.monthly_costs > 0) && (
            <div className="shrink-0 bg-background-50 border border-background-200/60 rounded-lg p-4 min-w-[200px]">
              <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-2">Monthly Financials</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-foreground-500">Revenue</span>
                <span className="text-emerald-400 text-right font-semibold">&pound;{project.monthly_revenue.toLocaleString()}</span>
                <span className="text-foreground-500">Costs</span>
                <span className="text-red-400 text-right font-semibold">&pound;{project.monthly_costs.toLocaleString()}</span>
                <span className="text-foreground-500 pt-1 border-t border-background-200/60">Profit</span>
                <span className={`text-right font-semibold pt-1 border-t border-background-200/60 ${monthlyProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  &pound;{monthlyProfit.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Type badges */}
        {typeBadges.length > 0 && (
          <div className="flex items-center gap-2 mt-5 flex-wrap">
            {typeBadges.map((badge) => (
              <span key={badge} className="text-[10px] font-label text-foreground-400 bg-background-50 border border-background-200/60 rounded-full px-2.5 py-1 whitespace-nowrap">
                {badge}
              </span>
            ))}
          </div>
        )}

        {/* Operational status strip */}
        <div className="mt-5 pt-5 border-t border-background-200/60">
          <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-3">Operational Status</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {displayStatus.map((item) => (
              <div key={item.label} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <i className={`${item.icon} w-3.5 h-3.5 flex items-center justify-center text-foreground-400`}></i>
                  <span className="text-[10px] font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">{item.label}</span>
                </div>
                <span className="text-xs text-foreground-600 whitespace-nowrap">{item.state}</span>
                {item.detail && <span className="block text-[10px] text-foreground-600 whitespace-nowrap mt-0.5">{item.detail}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="border-t border-background-200/60 bg-background-50/50 px-6 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-label text-foreground-500 uppercase tracking-wide mr-1">Quick Actions</span>

          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-pencil-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Edit Project
          </button>

          {project.domain_live && (
            <a
              href={`https://${project.domain_live}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-external-link-line w-3.5 h-3.5 flex items-center justify-center"></i>
              Open Live Site
            </a>
          )}

          {project.domain_staging && (
            <a
              href={`https://${project.domain_staging}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-external-link-line w-3.5 h-3.5 flex items-center justify-center"></i>
              Open Staging
            </a>
          )}

          <Link
            to="/build-process"
            className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-hammer-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Open Build Process
          </Link>

          <Link
            to="/ai-operations"
            className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-robot-2-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Open AI Operations
          </Link>

          <Link
            to="/admin/website-uat"
            className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-clipboard-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Open UAT
          </Link>

          <Link
            to="/github"
            className="flex items-center gap-1.5 text-xs font-label text-foreground-400 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-github-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Open GitHub
          </Link>
        </div>
      </div>
    </div>
  );
}