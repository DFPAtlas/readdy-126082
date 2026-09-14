import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Project,
  Idea,
  Bug,
  ChangeRequest,
  Note,
  FileLink,
  SectionKey,
  statusColors,
  priorityColors,
  noteCategoryIcons,
} from '../types';
import { formatDate, formatRelative } from '../utils';
import type { ProjectIntegration } from '../infrastructureTypes';
import { INTEGRATION_STATE_LABELS } from '../infrastructureTypes';
import { configured, integrationState } from '../infrastructureUtils';
import { computeBugsSummary, computeChangesSummary } from '../workstreamUtils';
import type { BudgetSummary } from '../budgetTypes';
import { formatMoney, statusLabel } from '../budgetUtils';
import type { ActivityEvent } from '../activityTypes';
import { SOURCE_LABELS, SOURCE_STYLES } from '../activityTypes';

interface OverviewSectionProps {
  project: Project;
  ideas: Idea[];
  bugs: Bug[];
  changeRequests: ChangeRequest[];
  notes: Note[];
  fileLinks: FileLink[];
  onNavigate: (key: SectionKey) => void;
  buildProgressLabel?: string;
  uatLabel?: string;
  integration?: ProjectIntegration | null;
  integrationUnavailable?: boolean;
  budgetSummary?: BudgetSummary | null;
  supportStatusLabel?: string;
  supportStatusDetail?: string;
  monitoringStatusLabel?: string;
  monitoringStatusDetail?: string;
  launchStatusLabel?: string;
  launchStatusDetail?: string;
  deploymentStatusLabel?: string;
  deploymentStatusDetail?: string;
  operationsStatusLabel?: string;
  operationsStatusDetail?: string;
  activityEvents?: ActivityEvent[];
}

interface Connection {
  label: string;
  icon: string;
  state: string;
  detail?: string;
}

function connectionsFor(integration: ProjectIntegration | null | undefined, unavailable: boolean): Connection[] {
  const st = (v: string | null | undefined) => INTEGRATION_STATE_LABELS[integrationState(v, unavailable)];
  const boolState = (configuredVal: boolean) =>
    unavailable
      ? INTEGRATION_STATE_LABELS.UNAVAILABLE
      : configuredVal
        ? INTEGRATION_STATE_LABELS.CONFIGURED
        : INTEGRATION_STATE_LABELS['NOT CONFIGURED'];
  const prodConfigured = configured(integration?.production_provider) || configured(integration?.production_url);
  const stagingConfigured = configured(integration?.staging_provider) || configured(integration?.staging_url);
  const supabaseRef = integration?.supabase_project_ref;
  return [
    { label: 'Readdy', icon: 'ri-cloud-line', state: st(integration?.readdy_project_id), detail: integration?.readdy_project_id ?? undefined },
    { label: 'GitHub', icon: 'ri-github-line', state: st(integration?.github_repository), detail: integration?.github_repository ?? undefined },
    { label: 'Supabase', icon: 'ri-database-2-line', state: st(supabaseRef), detail: supabaseRef ? [integration?.supabase_project_name, integration?.supabase_region].filter(Boolean).join(' · ') || supabaseRef : undefined },
    { label: 'Production', icon: 'ri-global-line', state: boolState(prodConfigured), detail: integration?.production_url ?? undefined },
    { label: 'Staging', icon: 'ri-stack-line', state: boolState(stagingConfigured), detail: integration?.staging_url ?? undefined },
    { label: 'AI Operations', icon: 'ri-robot-2-line', state: 'Managed in AI Ops', detail: 'Assigned in AI Operations' },
    { label: 'Monitoring', icon: 'ri-pulse-line', state: st(integration?.monitoring_provider), detail: integration?.monitoring_provider ? `${integration.monitoring_provider} · Verification Unknown` : undefined },
  ];
}

export default function OverviewSection({
  project,
  ideas,
  bugs,
  changeRequests,
  notes,
  fileLinks,
  onNavigate,
  buildProgressLabel,
  uatLabel,
  integration,
  integrationUnavailable,
  budgetSummary,
  supportStatusLabel,
  supportStatusDetail,
  monitoringStatusLabel,
  monitoringStatusDetail,
  launchStatusLabel,
  launchStatusDetail,
  deploymentStatusLabel,
  deploymentStatusDetail,
  operationsStatusLabel,
  operationsStatusDetail,
  activityEvents,
}: OverviewSectionProps) {
  const monthlyProfit = (project.monthly_revenue || 0) - (project.monthly_costs || 0);
  const connections = connectionsFor(integration, Boolean(integrationUnavailable));
  const bugsSummary = computeBugsSummary(bugs, [], []);
  const changesSummary = computeChangesSummary(changeRequests);

  const lastActivity = activityEvents?.[0] ?? null;
  const eventsThisWeek = activityEvents
    ? activityEvents.filter((e) => {
        const t = new Date(e.timestamp).getTime();
        return !Number.isNaN(t) && Date.now() - t <= 7 * 24 * 60 * 60 * 1000;
      }).length
    : 0;
  const lastActivityRelative = lastActivity ? formatRelative(lastActivity.timestamp) : null;
  const recentActivity = activityEvents?.slice(0, 5) ?? [];
  const lastActivityLabel = lastActivity
    ? lastActivity.title.length > 24
      ? `${lastActivity.title.slice(0, 24)}…`
      : lastActivity.title
    : 'No activity';

  const budgetValue = budgetSummary && budgetSummary.hasAnyBudget ? statusLabel(budgetSummary.status) : 'No Budget';
  const budgetDetail =
    budgetSummary && budgetSummary.hasAnyBudget
      ? `${formatMoney(budgetSummary.actualSpend)} spent · ${formatMoney(budgetSummary.remainingBudget)} remaining`
      : 'No approved budget';

  const classifications: { label: string; active: boolean }[] = [
    { label: 'SaaS', active: project.is_saas },
    { label: 'Client Build', active: project.is_client_build },
    { label: 'Internal Tool', active: project.is_internal_tool },
    { label: 'AI Powered', active: project.is_ai_powered },
  ];
  const hasClassification = classifications.some((c) => c.active);

  const workSummary: { key: SectionKey | null; label: string; value: string; detail?: string; icon: string; color: string }[] = [
    { key: 'build', label: 'Build', value: buildProgressLabel ?? 'Not Started', icon: 'ri-hammer-line', color: 'text-accent-400' },
    { key: 'uat', label: 'UAT', value: uatLabel ?? 'Not Configured', icon: 'ri-clipboard-line', color: 'text-violet-400' },
    { key: null, label: 'Ideas', value: String(ideas.length), icon: 'ri-lightbulb-line', color: 'text-amber-400' },
    { key: 'bugs', label: 'Bugs', value: `${bugsSummary.openBugs} open`, detail: `${bugsSummary.critical} critical · ${bugsSummary.readyForRetest} retest`, icon: 'ri-bug-line', color: 'text-red-400' },
    { key: 'changes', label: 'Change Requests', value: `${changesSummary.openRequests} open`, detail: `${changesSummary.approved} approved · ${changesSummary.inProgress} in progress`, icon: 'ri-git-pull-request-line', color: 'text-sky-400' },
    { key: 'budget', label: 'Budget', value: budgetValue, detail: budgetDetail, icon: 'ri-money-pound-circle-line', color: 'text-emerald-400' },
    { key: 'support', label: 'Support', value: supportStatusLabel ?? 'Not Configured', detail: supportStatusDetail, icon: 'ri-lifebuoy-line', color: 'text-sky-400' },
    { key: 'monitoring', label: 'Monitoring', value: monitoringStatusLabel ?? 'Not Configured', detail: monitoringStatusDetail, icon: 'ri-pulse-line', color: 'text-emerald-400' },
    { key: 'launch', label: 'Launch', value: launchStatusLabel ?? 'Not Configured', detail: launchStatusDetail, icon: 'ri-rocket-2-line', color: 'text-violet-400' },
    { key: 'deployment', label: 'Deployment', value: deploymentStatusLabel ?? 'Not Configured', detail: deploymentStatusDetail, icon: 'ri-send-plane-line', color: 'text-sky-400' },
    { key: 'operations', label: 'Operations', value: operationsStatusLabel ?? 'Not Configured', detail: operationsStatusDetail, icon: 'ri-settings-3-line', color: 'text-emerald-400' },
    { key: 'activity', label: 'Activity', value: lastActivityLabel, detail: lastActivityRelative ? `${lastActivityRelative} · ${eventsThisWeek} events this week` : `${eventsThisWeek} significant events this week`, icon: 'ri-history-line', color: 'text-foreground-400' },
    { key: null, label: 'Notes', value: String(notes.length), icon: 'ri-sticky-note-line', color: 'text-emerald-400' },
    { key: 'files', label: 'Files / Links', value: String(fileLinks.length), icon: 'ri-links-line', color: 'text-primary-400' },
  ];

  return (
    <div className="p-6 space-y-8">
      {/* A. Project Health Summary */}
      <section>
        <SectionHeading icon="ri-heart-pulse-line" title="Project Health Summary" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <HealthCard label="Status">
            <span className={`text-[10px] font-label px-1.5 py-0.5 rounded uppercase whitespace-nowrap ${statusColors[project.status] ?? ''}`}>
              {project.status.replace('_', ' ')}
            </span>
          </HealthCard>
          <HealthCard label="Priority">
            <span className={`text-sm font-heading font-semibold capitalize ${priorityColors[project.priority] ?? ''}`}>
              {project.priority}
            </span>
          </HealthCard>
          <HealthCard label="Target Launch">
            {project.target_launch_date ? (
              <span className="text-sm text-foreground-200">{formatDate(project.target_launch_date)}</span>
            ) : (
              <span className="text-sm text-foreground-600">Not set</span>
            )}
          </HealthCard>
          <HealthCard label="Live Domain">
            {project.domain_live ? (
              <a
                href={`https://${project.domain_live}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent-400 hover:text-accent-300 font-mono truncate transition-colors cursor-pointer"
              >
                {project.domain_live}
              </a>
            ) : (
              <span className="text-sm text-foreground-600">Not set</span>
            )}
          </HealthCard>
          <HealthCard label="Staging Domain">
            {project.domain_staging ? (
              <span className="text-sm text-foreground-300 font-mono truncate">{project.domain_staging}</span>
            ) : (
              <span className="text-sm text-foreground-600">Not set</span>
            )}
          </HealthCard>
          <HealthCard label="Owner">
            {project.owner ? (
              <span className="text-sm text-foreground-200">{project.owner}</span>
            ) : (
              <span className="text-sm text-foreground-600">Unassigned</span>
            )}
          </HealthCard>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* B + C. Classification & Commercial */}
        <div className="space-y-6">
          <section>
            <SectionHeading icon="ri-price-tag-3-line" title="Project Classification" />
            <div className="bg-background-50 border border-background-200/60 rounded-lg p-4">
              {hasClassification ? (
                <div className="flex items-center gap-2 flex-wrap">
                  {classifications.filter((c) => c.active).map((c) => (
                    <span key={c.label} className="text-[11px] font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-full px-2.5 py-1 whitespace-nowrap">
                      {c.label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-foreground-600 italic">No classification set.</p>
              )}
            </div>
          </section>

          <section>
            <SectionHeading icon="ri-money-pound-circle-line" title="Commercial Summary" />
            <div className="grid grid-cols-3 gap-3">
              <CommercialCard label="Revenue / mo" value={`&pound;${project.monthly_revenue.toLocaleString()}`} tone="emerald" />
              <CommercialCard label="Costs / mo" value={`&pound;${project.monthly_costs.toLocaleString()}`} tone="red" />
              <CommercialCard label="Profit / mo" value={`&pound;${monthlyProfit.toLocaleString()}`} tone={monthlyProfit >= 0 ? 'emerald' : 'red'} />
            </div>
          </section>
        </div>

        {/* D. Project Connections */}
        <section>
          <SectionHeading icon="ri-plug-line" title="Project Connections" />
          <div className="bg-background-50 border border-background-200/60 rounded-lg p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {connections.map((conn) => (
                <div key={conn.label} className="px-3 py-2.5 rounded-md bg-background-100 border border-background-200/60">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-background-200/60 flex items-center justify-center shrink-0">
                      <i className={`${conn.icon} text-xs text-foreground-400 w-3.5 h-3.5 flex items-center justify-center`}></i>
                    </div>
                    <span className="text-sm text-foreground-200 flex-1 truncate">{conn.label}</span>
                    <span className="text-[10px] font-label text-foreground-500 bg-foreground-500/10 rounded px-1.5 py-0.5 whitespace-nowrap">{conn.state}</span>
                  </div>
                  {conn.detail && (
                    <p className="text-[11px] text-foreground-500 truncate ml-9 mt-1" title={conn.detail}>{conn.detail}</p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-foreground-600 mt-3">
              Connections shown reflect available project information only — no live health is fabricated.
            </p>
          </div>
        </section>
      </div>

      {/* E. Work Summary */}
      <section>
        <SectionHeading icon="ri-stack-line" title="Work Summary" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {workSummary.map((item) => {
            const card = (
              <div className="bg-background-50 border border-background-200/60 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <i className={`${item.icon} ${item.color} w-4 h-4 flex items-center justify-center`}></i>
                  <span className="text-[10px] font-label text-foreground-400 uppercase tracking-wide truncate">{item.label}</span>
                </div>
                <span className="text-lg font-heading font-bold text-foreground-50 leading-tight">{item.value}</span>
                {item.detail && <p className="text-[10px] text-foreground-500 mt-0.5 truncate">{item.detail}</p>}
              </div>
            );
            if (!item.key) return <div key={item.label}>{card}</div>;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => onNavigate(item.key as SectionKey)}
                className="text-left cursor-pointer group"
              >
                <div className="bg-background-50 border border-background-200/60 group-hover:border-accent-500/30 rounded-lg p-3 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <i className={`${item.icon} ${item.color} w-4 h-4 flex items-center justify-center`}></i>
                    <span className="text-[10px] font-label text-foreground-400 uppercase tracking-wide truncate">{item.label}</span>
                    <i className="ri-arrow-right-line w-3 h-3 flex items-center justify-center text-foreground-600 ml-auto group-hover:text-accent-400 transition-colors"></i>
                  </div>
                  <span className="text-lg font-heading font-bold text-foreground-50 leading-tight">{item.value}</span>
                  {item.detail && <p className="text-[10px] text-foreground-500 mt-0.5 truncate">{item.detail}</p>}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* F. Recent Activity */}
      <section>
        <SectionHeading icon="ri-history-line" title="Recent Activity" />
        <div className="bg-background-50 border border-background-200/60 rounded-lg divide-y divide-background-200/60">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-foreground-500 px-4 py-8 text-center">No recent activity.</p>
          ) : (
            recentActivity.map((e) => (
              <div key={e.key} className="flex items-center gap-3 px-4 py-3">
                <span className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 ${SOURCE_STYLES[e.source]}`}>
                  {SOURCE_LABELS[e.source]}
                </span>
                <p className="text-sm text-foreground-200 flex-1 truncate">{e.title}</p>
                <span className="text-[10px] text-foreground-600 whitespace-nowrap shrink-0">
                  {formatRelative(e.timestamp) ?? formatDate(e.timestamp)}
                </span>
              </div>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={() => onNavigate('activity')}
          className="mt-3 text-sm font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
        >
          View Full Activity
          <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
        </button>
      </section>

      {/* G. Ideas & Notes (still accessible from Overview) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <SectionHeading icon="ri-lightbulb-line" title={`Ideas (${ideas.length})`} />
          <IdeasList ideas={ideas} />
        </section>
        <section>
          <SectionHeading icon="ri-sticky-note-line" title={`Notes (${notes.length})`} />
          <NotesList notes={notes} />
        </section>
      </div>
    </div>
  );
}

// ─── Small building blocks ───────────────────────────────

function SectionHeading({ icon, title }: { icon: string; title: string }) {
  return (
    <h4 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">
      <i className={`${icon} w-4 h-4 flex items-center justify-center text-foreground-400`}></i>
      {title}
    </h4>
  );
}

function HealthCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-3 min-w-0">
      <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1.5 whitespace-nowrap">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function CommercialCard({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'red' }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-3 text-center">
      <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1 whitespace-nowrap">{label}</p>
      <p className={`text-base font-heading font-bold ${tone === 'emerald' ? 'text-emerald-400' : 'text-red-400'}`}>{value}</p>
    </div>
  );
}

// ─── Ideas list ──────────────────────────────────────────

function IdeasList({ ideas }: { ideas: Idea[] }) {
  if (ideas.length === 0) {
    return (
      <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-8 text-center">
        <p className="text-sm text-foreground-500">No ideas linked to this project yet.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3">
      {ideas.map((idea) => (
        <Link
          key={idea.id}
          to="/ideas"
          className="bg-background-50 border border-background-200/60 rounded-lg p-4 hover:border-accent-500/30 transition-colors duration-150 group cursor-pointer"
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <h5 className="text-sm font-heading font-semibold text-foreground-100 group-hover:text-accent-400 transition-colors line-clamp-1">{idea.idea_name}</h5>
            {idea.ai_generated && (
              <span className="text-[10px] font-label text-accent-400 bg-accent-500/10 rounded px-1.5 py-0.5 whitespace-nowrap shrink-0">AI</span>
            )}
          </div>
          {idea.description && <p className="text-xs text-foreground-500 line-clamp-2 mb-3">{idea.description}</p>}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${statusColors[idea.status] ?? ''}`}>
              {idea.status.replace('_', ' ')}
            </span>
            <span className={`text-[10px] font-label capitalize whitespace-nowrap ${priorityColors[idea.priority] ?? ''}`}>{idea.priority}</span>
            {idea.category && <span className="text-[10px] text-foreground-500 bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">{idea.category}</span>}
            {idea.owner && <span className="text-[10px] text-foreground-600 whitespace-nowrap">{idea.owner}</span>}
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Notes list ──────────────────────────────────────────

function NotesList({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return (
      <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-8 text-center">
        <p className="text-sm text-foreground-500">No notes linked to this project yet.</p>
      </div>
    );
  }

  const pinned = notes.filter((n) => n.pinned);
  const unpinned = notes.filter((n) => !n.pinned);

  return (
    <div className="divide-y divide-background-200/60 bg-background-50 border border-background-200/60 rounded-lg overflow-hidden">
      {[...pinned, ...unpinned].map((note) => {
        const icon = noteCategoryIcons[note.category] ?? noteCategoryIcons.general;
        return (
          <div key={note.id} className={`px-4 py-3.5 ${note.pinned ? 'bg-accent-500/[0.03]' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-background-200/60 flex items-center justify-center shrink-0 mt-0.5">
                <i className={`${icon} text-sm text-foreground-400 w-4 h-4 flex items-center justify-center`}></i>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h5 className="text-sm font-heading font-semibold text-foreground-100">{note.title}</h5>
                  {note.pinned && <i className="ri-pushpin-2-fill text-accent-400 w-3 h-3 flex items-center justify-center"></i>}
                  <span className="text-[10px] font-label text-foreground-500 capitalize bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">{note.category}</span>
                </div>
                {note.content && <p className="text-xs text-foreground-500 leading-relaxed line-clamp-3 whitespace-pre-wrap">{note.content}</p>}
                <p className="text-[10px] text-foreground-600 mt-2">{formatDate(note.created_at)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}