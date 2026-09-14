import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Project, Bug, ChangeRequest, priorityColors } from '../types';
import { formatDate } from '../utils';
import type { ProjectUatData } from '../useProjectUat';
import type { ProjectBuildData } from '../useProjectBuild';
import {
  activeBlockers,
  computeChangesSummary,
  computeWorkstreamSummary,
  changeRequestBuildState,
  logWorkstreamActivity,
  type BuildLinkState,
} from '../workstreamUtils';
import WorkstreamSummary from './WorkstreamSummary';
import CreateChangeRequestModal, { type CreateChangeRequestDefaults } from './CreateChangeRequestModal';

interface ChangesSectionProps {
  project: Project;
  changeRequests: ChangeRequest[];
  bugs: Bug[];
  build: ProjectBuildData;
  uat: ProjectUatData;
  onRefresh: () => void;
}

const CR_STATUSES = ['requested', 'approved', 'in_progress', 'testing', 'completed', 'rejected'];

const CR_STATUS_COLORS: Record<string, string> = {
  requested: 'bg-secondary-500/10 text-secondary-300',
  approved: 'bg-sky-500/10 text-sky-400',
  in_progress: 'bg-accent-500/10 text-accent-400',
  testing: 'bg-yellow-500/10 text-yellow-400',
  completed: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-foreground-500/10 text-foreground-500',
};

const ORIGIN_LABELS: Record<string, string> = {
  manual: 'Manual',
  bug: 'Bug',
  uat: 'UAT',
};

const BUILD_STATE_STYLES: Record<BuildLinkState, string> = {
  'NOT PLANNED': 'bg-foreground-500/10 text-foreground-500',
  PLANNED: 'bg-sky-500/10 text-sky-400',
  'IN BUILD': 'bg-amber-500/10 text-amber-400',
  IMPLEMENTED: 'bg-emerald-500/10 text-emerald-400',
  UNKNOWN: 'bg-foreground-500/10 text-foreground-500',
};

export default function ChangesSection({
  project,
  changeRequests,
  bugs,
  build,
  uat,
  onRefresh,
}: ChangesSectionProps) {
  const [createDefaults, setCreateDefaults] = useState<CreateChangeRequestDefaults | null>(null);

  const activeRun = build.activeRun;
  const activeItems = activeRun ? (build.itemsByRun[activeRun.id] ?? []) : [];
  const blockers = activeBlockers(activeItems);

  const summary = computeChangesSummary(changeRequests);
  const workstream = computeWorkstreamSummary(bugs, uat.data.feedback, blockers, changeRequests);

  const handleStatusChange = async (cr: ChangeRequest, newStatus: string) => {
    await supabase.from('internal_change_requests').update({ status: newStatus }).eq('id', cr.id);
    await logWorkstreamActivity(
      project.id,
      'Change request status changed',
      `Changed "${cr.title}" status to ${newStatus.replace('_', ' ')}`,
    );
    onRefresh();
  };

  const bugById = new Map<number, Bug>();
  for (const b of bugs) bugById.set(b.id, b);

  const cards: { label: string; value: string; tone: string }[] = [
    { label: 'Open Requests', value: String(summary.openRequests), tone: summary.openRequests > 0 ? 'text-sky-400' : 'text-emerald-400' },
    { label: 'Pending Review', value: String(summary.pendingReview), tone: summary.pendingReview > 0 ? 'text-secondary-300' : 'text-emerald-400' },
    { label: 'Approved', value: String(summary.approved), tone: summary.approved > 0 ? 'text-sky-400' : 'text-emerald-400' },
    { label: 'In Progress', value: String(summary.inProgress), tone: summary.inProgress > 0 ? 'text-accent-400' : 'text-emerald-400' },
    { label: 'Implemented', value: String(summary.implemented), tone: summary.implemented > 0 ? 'text-emerald-400' : 'text-foreground-200' },
    { label: 'Rejected', value: String(summary.rejected), tone: summary.rejected > 0 ? 'text-foreground-500' : 'text-emerald-400' },
    { label: 'High Impact', value: String(summary.highImpact), tone: summary.highImpact > 0 ? 'text-red-400' : 'text-emerald-400' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-heading font-semibold text-foreground-100">Project Changes</h3>
          <p className="text-sm text-foreground-500 mt-1">Change requests scoped to {project.project_name}.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setCreateDefaults({ title: '', description: '', priority: 'medium', origin: 'manual' })}
            className="flex items-center gap-1.5 text-sm text-accent-400 hover:text-accent-300 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3.5 py-2 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-add-line w-4 h-4 flex items-center justify-center"></i>
            New Request
          </button>
          <Link
            to="/change-requests"
            className="flex items-center gap-1.5 text-sm text-foreground-400 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3.5 py-2 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-external-link-line w-4 h-4 flex items-center justify-center"></i>
            Open Global Change Requests
          </Link>
        </div>
      </div>

      <WorkstreamSummary summary={workstream} />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-background-50 border border-background-200/60 rounded-lg p-4">
            <p className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap mb-2">{c.label}</p>
            <p className={`text-lg font-heading font-bold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Request list */}
      {changeRequests.length === 0 ? (
        <div className="bg-background-50 border border-background-200/60 rounded-lg px-6 py-14 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-git-pull-request-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h4 className="text-sm font-heading font-semibold text-foreground-200 mb-1">No change requests yet</h4>
          <p className="text-sm text-foreground-500 mb-4">No change requests have been linked to this project.</p>
          <button
            type="button"
            onClick={() => setCreateDefaults({ title: '', description: '', priority: 'medium', origin: 'manual' })}
            className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            Create First Request
          </button>
        </div>
      ) : (
        <div className="grid gap-2">
          {changeRequests.map((cr) => {
            const srcBug = cr.source_bug_id != null ? bugById.get(cr.source_bug_id) ?? null : null;
            const buildState = changeRequestBuildState(cr, bugs, activeItems);
            return (
              <div key={cr.id} className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <Link to="/change-requests" className="text-sm font-medium text-foreground-100 hover:text-accent-400 transition-colors line-clamp-1 cursor-pointer">
                        {cr.title}
                      </Link>
                      {cr.origin && (
                        <span className="text-[10px] font-label px-2 py-0.5 rounded-full bg-foreground-500/10 text-foreground-400 uppercase whitespace-nowrap">
                          {ORIGIN_LABELS[cr.origin] || cr.origin}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${CR_STATUS_COLORS[cr.status] ?? 'bg-foreground-500/10 text-foreground-500'}`}>
                        {cr.status.replace('_', ' ')}
                      </span>
                      <span className={`text-[10px] font-label capitalize whitespace-nowrap ${priorityColors[cr.priority] ?? ''}`}>
                        {cr.priority}
                      </span>
                      {cr.type && (
                        <span className="text-[10px] text-foreground-500 bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">
                          {cr.type.replace('_', ' ')}
                        </span>
                      )}
                      <span className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap ${BUILD_STATE_STYLES[buildState]}`}>
                        {buildState === 'NOT PLANNED' ? 'Not linked to Build Process' : buildState}
                      </span>
                    </div>

                    {cr.description && <p className="text-xs text-foreground-500 line-clamp-1 mt-1.5">{cr.description}</p>}

                    <div className="flex items-center gap-3 text-[11px] text-foreground-500 mt-1.5 flex-wrap">
                      {cr.requested_by && <span>Requested by {cr.requested_by}</span>}
                      {cr.estimated_hours != null && <span>{cr.estimated_hours}h est.</span>}
                      {srcBug && (
                        <Link to="/bugs" className="text-accent-400 hover:text-accent-300 no-underline">
                          Related Bug: {srcBug.title}
                        </Link>
                      )}
                      {cr.created_at && <span>Created {formatDate(cr.created_at)}</span>}
                    </div>
                  </div>

                  <select
                    value={cr.status}
                    onChange={(e) => handleStatusChange(cr, e.target.value)}
                    className="text-[10px] font-label px-1.5 py-1 rounded border border-background-300/60 bg-background-50 text-foreground-300 outline-none cursor-pointer capitalize whitespace-nowrap shrink-0"
                  >
                    {CR_STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {createDefaults && (
        <CreateChangeRequestModal
          open
          onClose={() => setCreateDefaults(null)}
          onCreated={() => {
            setCreateDefaults(null);
            onRefresh();
          }}
          projectId={project.id}
          projectName={project.project_name}
          defaults={createDefaults}
          originLabel={createDefaults.origin === 'manual' ? 'Manual' : createDefaults.origin === 'bug' ? 'Bug' : 'UAT'}
        />
      )}
    </div>
  );
}