import { Link } from 'react-router-dom';
import type { PortfolioProject } from '../portfolioTypes';
import {
  BUILD_STATE_LABELS,
  BUILD_STATE_STYLES,
  UAT_STATE_LABELS,
  UAT_STATE_STYLES,
  LAUNCH_STATE_LABELS,
  LAUNCH_STATE_STYLES,
  HEALTH_STATE_LABELS,
  HEALTH_STATE_STYLES,
  BUDGET_STATE_LABELS,
  BUDGET_STATE_STYLES,
  TARGET_LAUNCH_LABELS,
  TARGET_LAUNCH_STYLES,
} from '../portfolioTypes';
import { statusColors, priorityColors } from '../detail/types';
import { formatRelative, formatDate } from '../detail/utils';

export default function PortfolioProjectCard({ pp }: { pp: PortfolioProject }) {
  const p = pp.project;
  const slug = p.project_slug;
  const hasAttention = pp.attention.length > 0;

  const types: string[] = [
    p.is_saas ? 'SaaS' : '',
    p.is_client_build ? 'Client Build' : '',
    p.is_internal_tool ? 'Internal Tool' : '',
    p.is_ai_powered ? 'AI' : '',
  ].filter(Boolean);

  return (
    <div
      className={`bg-background-100 border rounded-lg p-4 flex flex-col ${
        hasAttention ? 'border-red-500/30' : 'border-background-200/60'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <Link
            to={`/projects/${slug}`}
            className="text-base font-heading font-semibold text-foreground-100 hover:text-accent-400 transition-colors truncate block cursor-pointer"
          >
            {p.project_name}
          </Link>
          {p.description && (
            <p className="text-xs text-foreground-500 line-clamp-2 mt-0.5 leading-relaxed">{p.description}</p>
          )}
        </div>
        <span className={`text-[10px] font-label px-1.5 py-0.5 rounded uppercase whitespace-nowrap shrink-0 ${statusColors[p.status] ?? ''}`}>
          {p.status.replace('_', ' ')}
        </span>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap text-[11px] mb-3">
        <span className={`font-label capitalize ${priorityColors[p.priority] ?? 'text-foreground-500'}`}>
          {p.priority}
        </span>
        {p.owner && <span className="text-foreground-500 whitespace-nowrap">{p.owner}</span>}
        {types.map((t) => (
          <span key={t} className="text-foreground-500 bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">
            {t}
          </span>
        ))}
        {p.domain_live && (
          <span className="text-foreground-600 font-mono truncate max-w-[160px] whitespace-nowrap" title={p.domain_live}>
            {p.domain_live}
          </span>
        )}
      </div>

      {/* Status chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3">
        <Chip
          label="Build"
          state={BUILD_STATE_LABELS[pp.build.state]}
          detail={pp.build.detail}
          style={BUILD_STATE_STYLES[pp.build.state]}
          to={`/projects/${slug}?section=build`}
        />
        <Chip
          label="UAT"
          state={UAT_STATE_LABELS[pp.uat.state]}
          detail={pp.uat.detail}
          style={UAT_STATE_STYLES[pp.uat.state]}
          to={`/projects/${slug}?section=uat`}
        />
        <Chip
          label="Launch"
          state={LAUNCH_STATE_LABELS[pp.launch.state]}
          detail={pp.launch.detail}
          style={LAUNCH_STATE_STYLES[pp.launch.state]}
          to={`/projects/${slug}?section=launch`}
        />
        <Chip
          label="Ops"
          state={HEALTH_STATE_LABELS[pp.health.state]}
          detail={pp.health.detail}
          style={HEALTH_STATE_STYLES[pp.health.state]}
          to={`/projects/${slug}?section=operations`}
        />
        <Chip
          label="Budget"
          state={BUDGET_STATE_LABELS[pp.budget.state]}
          detail={pp.budget.detail}
          style={BUDGET_STATE_STYLES[pp.budget.state]}
          to={`/projects/${slug}?section=budget`}
        />
      </div>

      {/* Footer row */}
      <div className="mt-auto pt-3 border-t border-background-200/60 flex items-center justify-between gap-2 flex-wrap text-[11px]">
        <div className="flex items-center gap-2 flex-wrap">
          {p.target_launch_date && (
            <span className={`whitespace-nowrap ${TARGET_LAUNCH_STYLES[pp.targetLaunch]}`}>
              <i className="ri-calendar-line w-3 h-3 inline-flex items-center justify-center mr-1"></i>
              {formatDate(p.target_launch_date)}
              {TARGET_LAUNCH_LABELS[pp.targetLaunch] && (
                <span className="ml-1 opacity-80">· {TARGET_LAUNCH_LABELS[pp.targetLaunch]}</span>
              )}
            </span>
          )}
          <span className="text-foreground-500 whitespace-nowrap">
            <i className="ri-plug-line w-3 h-3 inline-flex items-center justify-center mr-1"></i>
            {pp.integrations.configured}/{pp.integrations.total}
          </span>
          {pp.criticalIssues > 0 && (
            <span className="text-red-400 whitespace-nowrap">
              <i className="ri-bug-line w-3 h-3 inline-flex items-center justify-center mr-1"></i>
              {pp.criticalIssues} critical
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {pp.stale && (
            <span className="text-amber-400 whitespace-nowrap" title="No recent activity">
              <i className="ri-time-line w-3 h-3 inline-flex items-center justify-center mr-1"></i>
              Stale
            </span>
          )}
          {pp.lastActivity && (
            <span className="text-foreground-600 whitespace-nowrap">
              {formatRelative(pp.lastActivity.timestamp) ?? formatDate(pp.lastActivity.timestamp)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({
  label,
  state,
  detail,
  style,
  to,
}: {
  label: string;
  state: string;
  detail: string;
  style: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-md px-2 py-1.5 transition-colors cursor-pointer min-w-0"
    >
      <p className="text-[9px] font-label text-foreground-500 uppercase tracking-wide leading-none">{label}</p>
      <p className="flex items-center gap-1 mt-1 text-[11px] leading-none min-w-0">
        <span className={`px-1 py-0.5 rounded text-[10px] font-label truncate whitespace-nowrap ${style}`}>{state}</span>
        {detail && <span className="text-foreground-600 truncate whitespace-nowrap">{detail}</span>}
      </p>
    </Link>
  );
}