import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Project, Bug, ChangeRequest, severityColors, priorityColors } from '../types';
import { formatDate } from '../utils';
import type { ProjectUatData } from '../useProjectUat';
import type { ProjectBuildData } from '../useProjectBuild';
import type { UatFeedback } from '@/pages/admin/website-uat/types';
import {
  buildUnifiedWorkItems,
  activeBlockers,
  computeBugsSummary,
  computeWorkstreamSummary,
  filterWorkItems,
  uatRetestState,
  SOURCE_LABELS,
  SOURCE_STYLES,
  NORMALIZED_STATUS_STYLES,
  BUG_FILTERS,
  logWorkstreamActivity,
  type BugFilter,
  type UnifiedWorkItem,
} from '../workstreamUtils';
import WorkstreamSummary from './WorkstreamSummary';
import CreateBugModal, { type CreateBugDefaults } from './CreateBugModal';
import CreateChangeRequestModal from './CreateChangeRequestModal';

interface BugsSectionProps {
  project: Project;
  bugs: Bug[];
  uat: ProjectUatData;
  build: ProjectBuildData;
  changeRequests: ChangeRequest[];
  onRefresh: () => void;
}

const BUG_STATUSES = ['open', 'investigating', 'in_progress', 'fixed', 'wont_fix', 'duplicate'];

function severityToPriority(severity: string): string {
  if (severity === 'critical') return 'critical';
  if (severity === 'high') return 'high';
  return 'medium';
}

export default function BugsSection({
  project,
  bugs,
  uat,
  build,
  changeRequests,
  onRefresh,
}: BugsSectionProps) {
  const [filter, setFilter] = useState<BugFilter>('all');
  const [createDefaults, setCreateDefaults] = useState<CreateBugDefaults | null>(null);
  const [crDefaults, setCrDefaults] = useState<{ title: string; description: string; priority: string; origin: 'bug'; sourceBugId: number } | null>(null);

  const activeRun = build.activeRun;
  const activeItems = activeRun ? (build.itemsByRun[activeRun.id] ?? []) : [];
  const blockers = activeBlockers(activeItems);
  const defects = uat.data.feedback;

  const unified = buildUnifiedWorkItems(bugs, defects, blockers);
  const summary = computeBugsSummary(bugs, defects, blockers);
  const workstream = computeWorkstreamSummary(bugs, defects, blockers, changeRequests);
  const filtered = filterWorkItems(unified, filter);

  // Linked-bug lookups (duplicate protection + provenance display).
  const bugByDefect = new Map<string, Bug>();
  const bugByItem = new Map<number, Bug>();
  for (const b of bugs) {
    if (b.uat_defect_id) bugByDefect.set(b.uat_defect_id, b);
    if (b.build_item_id != null) bugByItem.set(b.build_item_id, b);
  }

  const createCrFromBug = (bug: Bug) => {
    setCrDefaults({
      title: `Change: ${bug.title}`,
      description: bug.description || '',
      priority: severityToPriority(bug.severity),
      origin: 'bug',
      sourceBugId: bug.id,
    });
  };

  const handleStatusChange = async (bug: Bug, newStatus: string) => {
    await supabase.from('internal_bugs').update({ status: newStatus }).eq('id', bug.id);
    await logWorkstreamActivity(project.id, 'Bug status changed', `Changed bug "${bug.title}" status to ${newStatus.replace('_', ' ')}`);
    onRefresh();
  };

  const handleMarkRetest = async (bug: Bug) => {
    await supabase.from('internal_bugs').update({ retest_status: 'ready_for_retest' }).eq('id', bug.id);
    await logWorkstreamActivity(project.id, 'Bug marked ready for retest', `Bug "${bug.title}" marked ready for retest`);
    onRefresh();
  };

  const cards: { label: string; value: string; tone: string }[] = [
    { label: 'Open Bugs', value: String(summary.openBugs), tone: summary.openBugs > 0 ? 'text-red-400' : 'text-emerald-400' },
    { label: 'Critical', value: String(summary.critical), tone: summary.critical > 0 ? 'text-red-400' : 'text-emerald-400' },
    { label: 'High Priority', value: String(summary.highPriority), tone: summary.highPriority > 0 ? 'text-amber-400' : 'text-emerald-400' },
    { label: 'In Progress', value: String(summary.inProgress), tone: summary.inProgress > 0 ? 'text-sky-400' : 'text-emerald-400' },
    { label: 'Ready for Retest', value: String(summary.readyForRetest), tone: summary.readyForRetest > 0 ? 'text-violet-400' : 'text-emerald-400' },
    { label: 'UAT Defects', value: String(summary.uatDefects), tone: summary.uatDefects > 0 ? 'text-violet-400' : 'text-emerald-400' },
    { label: 'Build Blockers', value: String(summary.buildBlockers), tone: summary.buildBlockers > 0 ? 'text-orange-400' : 'text-emerald-400' },
    { label: 'Recently Resolved', value: String(summary.recentlyResolved), tone: 'text-foreground-200' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-heading font-semibold text-foreground-100">Project Bugs</h3>
          <p className="text-sm text-foreground-500 mt-1">Unified work view — project bugs, UAT defects and build blockers for {project.project_name}.</p>
        </div>
        <Link
          to="/bugs"
          className="flex items-center gap-1.5 text-sm text-foreground-400 hover:text-accent-400 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3.5 py-2 transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-external-link-line w-4 h-4 flex items-center justify-center"></i>
          Open Global Bugs
        </Link>
      </div>

      {/* Source availability notes (never silent zeroes) */}
      {uat.error && (
        <div className="text-xs text-foreground-500 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
          UAT defects unavailable — could not load linked UAT data.
        </div>
      )}
      {build.error && (
        <div className="text-xs text-foreground-500 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
          Build blockers unavailable — could not load Build Process data.
        </div>
      )}

      <WorkstreamSummary summary={workstream} />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-background-50 border border-background-200/60 rounded-lg p-4">
            <p className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap mb-2">{c.label}</p>
            <p className={`text-lg font-heading font-bold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {BUG_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-label transition-colors whitespace-nowrap cursor-pointer ${
              filter === f.value
                ? 'bg-accent-500/10 text-accent-400 font-semibold'
                : 'text-foreground-500 hover:text-foreground-300 hover:bg-background-200/40'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Issue list */}
      {filtered.length === 0 ? (
        <div className="bg-background-50 border border-background-200/60 rounded-lg px-6 py-14 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-bug-line text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center"></i>
          </div>
          <h4 className="text-sm font-heading font-semibold text-foreground-200 mb-1">
            {unified.length === 0 ? 'No work items yet' : 'No items match this filter'}
          </h4>
          <p className="text-sm text-foreground-500">
            {unified.length === 0 ? 'No bugs, UAT defects or build blockers exist for this project.' : 'Try a different filter.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((item) => (
            <IssueRow
              key={item.key}
              item={item}
              bug={item.bugId != null ? bugs.find((b) => b.id === item.bugId) ?? null : null}
              linkedBug={item.source === 'uat_defect' && item.uatDefectId ? bugByDefect.get(item.uatDefectId) ?? null : null}
              linkedBlockerBug={item.source === 'build_blocker' && item.buildItemId != null ? bugByItem.get(item.buildItemId) ?? null : null}
              defects={defects}
              onStatusChange={handleStatusChange}
              onMarkRetest={handleMarkRetest}
              onCreateCr={createCrFromBug}
              onOpenCreateBug={setCreateDefaults}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {createDefaults && (
        <CreateBugModal
          open
          onClose={() => setCreateDefaults(null)}
          onCreated={() => {
            setCreateDefaults(null);
            onRefresh();
          }}
          projectId={project.id}
          projectName={project.project_name}
          defaults={createDefaults}
          originLabel={createDefaults.source === 'uat' ? 'UAT Defect' : createDefaults.source === 'build' ? 'Build Blocker' : 'Manual'}
        />
      )}
      {crDefaults && (
        <CreateChangeRequestModal
          open
          onClose={() => setCrDefaults(null)}
          onCreated={() => {
            setCrDefaults(null);
            onRefresh();
          }}
          projectId={project.id}
          projectName={project.project_name}
          defaults={{ ...crDefaults, origin: 'bug' as const }}
          originLabel="Bug"
        />
      )}
    </div>
  );
}

// ─── Issue row ──────────────────────────────────────────────────────────────

interface IssueRowProps {
  item: UnifiedWorkItem;
  bug: Bug | null;
  linkedBug: Bug | null;
  linkedBlockerBug: Bug | null;
  defects: UatFeedback[];
  onStatusChange: (bug: Bug, status: string) => void;
  onMarkRetest: (bug: Bug) => void;
  onCreateCr: (bug: Bug) => void;
  onOpenCreateBug: (defaults: CreateBugDefaults) => void;
}

function IssueRow({
  item,
  bug,
  linkedBug,
  linkedBlockerBug,
  defects,
  onStatusChange,
  onMarkRetest,
  onCreateCr,
  onOpenCreateBug,
}: IssueRowProps) {
  const isBug = item.source === 'project_bug';
  const isDefect = item.source === 'uat_defect';
  const isBlocker = item.source === 'build_blocker';
  const verified = bug ? uatRetestState(bug, defects) : null;

  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          {/* Source + title */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`text-[10px] font-label px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${SOURCE_STYLES[item.source]}`}>
              {SOURCE_LABELS[item.source]}
            </span>
            {isBug ? (
              <Link to="/bugs" className="text-sm font-medium text-foreground-100 hover:text-accent-400 transition-colors line-clamp-1 cursor-pointer">
                {item.title}
              </Link>
            ) : (
              <span className="text-sm font-medium text-foreground-100 line-clamp-1">{item.title}</span>
            )}
          </div>

          {/* Status / severity / priority */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap ${NORMALIZED_STATUS_STYLES[item.normalizedStatus]}`}>
              {item.normalizedStatus}
            </span>
            {item.severity && (
              <span className={`text-[10px] font-label px-1.5 py-0.5 rounded capitalize whitespace-nowrap ${severityColors[item.severity] ?? ''}`}>
                {item.severity}
              </span>
            )}
            {item.priority && (
              <span className={`text-[10px] font-label capitalize whitespace-nowrap ${priorityColors[item.priority] ?? ''}`}>
                {item.priority}
              </span>
            )}
            {verified && (
              <span className="text-[10px] font-label px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 whitespace-nowrap">
                {verified}
              </span>
            )}
            {item.owner && <span className="text-[11px] text-foreground-500 whitespace-nowrap">@{item.owner}</span>}
          </div>

          {/* Cross-system context */}
          {(item.buildStage || item.uatDefectId) && (
            <div className="flex items-center gap-3 text-[11px] text-foreground-500 mt-1.5 flex-wrap">
              {item.buildPhase && <span>{item.buildPhase}</span>}
              {item.buildStage && <span>{item.buildStage}</span>}
              {item.uatDefectId && <span>Related UAT Defect</span>}
            </div>
          )}

          <p className="text-[11px] text-foreground-600 mt-1">
            {item.created ? `Created ${formatDate(item.created)}` : item.updated ? `Updated ${formatDate(item.updated)}` : ''}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {isBug && bug && (
            <>
              <select
                value={bug.status}
                onChange={(e) => onStatusChange(bug, e.target.value)}
                className="text-[10px] font-label px-1.5 py-1 rounded border border-background-300/60 bg-background-50 text-foreground-300 outline-none cursor-pointer capitalize whitespace-nowrap"
              >
                {BUG_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
              {bug.retest_status !== 'ready_for_retest' && ['fixed', 'resolved'].includes(bug.status) && (
                <button
                  type="button"
                  onClick={() => onMarkRetest(bug)}
                  className="text-[11px] text-violet-400 hover:text-violet-300 whitespace-nowrap cursor-pointer"
                >
                  Mark Ready for Retest
                </button>
              )}
              <button
                type="button"
                onClick={() => onCreateCr(bug)}
                className="text-[11px] text-sky-400 hover:text-sky-300 whitespace-nowrap cursor-pointer"
              >
                Create Change Request
              </button>
              {bug.source === 'uat' && (
                <Link to="/admin/website-uat?tab=defects" className="text-[11px] text-accent-400 hover:text-accent-300 whitespace-nowrap no-underline">
                  Open UAT Defect
                </Link>
              )}
              {bug.source === 'build' && (
                <Link to="/build-process" className="text-[11px] text-accent-400 hover:text-accent-300 whitespace-nowrap no-underline">
                  Open Build
                </Link>
              )}
            </>
          )}

          {isDefect && (
            <>
              {linkedBug ? (
                <Link to="/bugs" className="text-[11px] text-emerald-400 hover:text-emerald-300 whitespace-nowrap no-underline">
                  Project Bug Already Exists
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onOpenCreateBug({
                      title: item.title,
                      description: '',
                      severity: item.severity || 'medium',
                      source: 'uat',
                      uatDefectId: item.uatDefectId,
                    })
                  }
                  className="text-[11px] text-accent-400 hover:text-accent-300 whitespace-nowrap cursor-pointer"
                >
                  Create Project Bug
                </button>
              )}
              <Link to="/admin/website-uat?tab=defects" className="text-[11px] text-foreground-400 hover:text-foreground-200 whitespace-nowrap no-underline">
                Open UAT Defect
              </Link>
            </>
          )}

          {isBlocker && (
            <>
              {linkedBlockerBug ? (
                <Link to="/bugs" className="text-[11px] text-emerald-400 hover:text-emerald-300 whitespace-nowrap no-underline">
                  Project Bug Already Exists
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onOpenCreateBug({
                      title: item.title,
                      description: '',
                      severity: 'medium',
                      source: 'build',
                      buildRunId: item.buildRunId,
                      buildItemId: item.buildItemId,
                    })
                  }
                  className="text-[11px] text-accent-400 hover:text-accent-300 whitespace-nowrap cursor-pointer"
                >
                  Create Bug From Blocker
                </button>
              )}
              <Link to="/build-process" className="text-[11px] text-foreground-400 hover:text-foreground-200 whitespace-nowrap no-underline">
                Open Build
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Shared empty state (used by Activity/Files sections too) ──────────────

export function EmptyState({ icon, title, message }: { icon: string; title: string; message: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-background-200/60 flex items-center justify-center">
        <i className={`${icon} text-2xl text-foreground-500 w-7 h-7 flex items-center justify-center`}></i>
      </div>
      <h3 className="text-base font-heading font-semibold text-foreground-200 mb-1">{title}</h3>
      <p className="text-sm text-foreground-500">{message}</p>
    </div>
  );
}