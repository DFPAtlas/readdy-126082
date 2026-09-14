import { Link } from 'react-router-dom';
import type { DeploymentsExec } from '../executiveTypes';
import {
  DEPLOYMENT_STATUS_LABELS,
  DEPLOYMENT_STATUS_STYLES,
  type DeploymentStatus,
} from '@/pages/projects/detail/deploymentTypes';
import { SectionHeading, Unavailable, EmptyNote, Metric } from './shared';

export default function DeploymentsPanel({ data }: { data: DeploymentsExec }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-5">
      <SectionHeading
        icon="ri-git-commit-line"
        title="Deployments"
        action={{ label: 'View Deployments', to: '/projects' }}
      />

      {!data.available ? (
        <Unavailable label="Deployment data unavailable" />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
            <Metric label="Active" value={data.active} />
            <Metric label="Verifying" value={data.verifying} />
            <Metric label="Failed" value={data.failed} tone="text-red-400" />
            <Metric label="Rollback Required" value={data.rollbackRequired} tone="text-orange-400" />
            <Metric label="Recently Completed" value={data.recentlyCompleted} tone="text-emerald-400" />
          </div>

          {data.rows.length === 0 ? (
            <EmptyNote>No recent deployment activity.</EmptyNote>
          ) : (
            <div className="space-y-1.5">
              {data.rows.slice(0, 8).map((r) => (
                <Link
                  key={r.id}
                  to={r.projectSlug ? `/projects/${r.projectSlug}?section=deployment` : '/projects'}
                  className="flex items-center gap-3 bg-background-50 border border-background-200/50 hover:border-accent-500/30 rounded-md px-3 py-2 transition-colors cursor-pointer"
                >
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-label whitespace-nowrap shrink-0 ${DEPLOYMENT_STATUS_STYLES[r.statusKey as DeploymentStatus] ?? ''}`}>
                    {DEPLOYMENT_STATUS_LABELS[r.statusKey as DeploymentStatus] ?? r.status}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground-100 truncate">{r.projectName}</p>
                    <p className="text-[10px] text-foreground-500 truncate">
                      {r.sha ? `SHA ${r.sha}` : 'No SHA'} · {r.environment}
                      {r.operator ? ` · ${r.operator}` : ''}
                    </p>
                  </div>
                  <span className="text-[10px] text-foreground-600 whitespace-nowrap shrink-0">
                    {r.startedAt ? new Date(r.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}