import { useState } from 'react';
import type { Project, Bug, ChangeRequest } from '../types';
import { priorityColors } from '../types';
import { formatDate } from '../utils';
import type { ProjectOperationsData } from '../useProjectOperations';
import {
  computeMaintenanceSummary,
  isMaintenanceOverdue,
  MAINTENANCE_STATUS_LABELS,
  MAINTENANCE_STATUS_STYLES,
  MAINTENANCE_TYPE_LABELS,
} from '../operationsTypes';
import PlanMaintenanceModal from './PlanMaintenanceModal';
import CreateBugModal, { type CreateBugDefaults } from './CreateBugModal';
import CreateChangeRequestModal from './CreateChangeRequestModal';

interface OperationsMaintenancePanelProps {
  project: Project;
  operations: ProjectOperationsData;
  bugs: Bug[];
  changeRequests: ChangeRequest[];
  onPlanMaintenance: () => void;
  onRefresh: () => void;
}

export default function OperationsMaintenancePanel({
  project,
  operations,
  bugs,
  changeRequests,
  onPlanMaintenance,
  onRefresh,
}: OperationsMaintenancePanelProps) {
  const [bugDefaults, setBugDefaults] = useState<CreateBugDefaults | null>(null);
  const [changeDefaults, setChangeDefaults] = useState<{
    title: string;
    description: string;
    priority: string;
    origin: string;
    maintenanceId: number | null;
  } | null>(null);

  const summary = computeMaintenanceSummary(operations.maintenance);

  const bugById = new Map<number, Bug>();
  for (const b of bugs) bugById.set(b.id, b);
  const changeById = new Map<number, ChangeRequest>();
  for (const c of changeRequests) changeById.set(c.id, c);

  const activeItems = operations.maintenance.filter(
    (m) => m.status !== 'COMPLETED' && m.status !== 'CANCELLED',
  );
  const nextPlanned = activeItems
    .filter((m) => m.planned_start)
    .sort((a, b) => new Date(a.planned_start as string).getTime() - new Date(b.planned_start as string).getTime())[0] ?? null;
  const lastCompleted = operations.maintenance
    .filter((m) => m.status === 'COMPLETED' && m.completed_at)
    .sort((a, b) => new Date(b.completed_at as string).getTime() - new Date(a.completed_at as string).getTime())[0] ?? null;

  const cards: { label: string; value: string; tone: string }[] = [
    { label: 'Open Actions', value: String(summary.openActions), tone: summary.openActions > 0 ? 'text-sky-400' : 'text-emerald-400' },
    { label: 'Overdue', value: String(summary.overdue), tone: summary.overdue > 0 ? 'text-red-400' : 'text-emerald-400' },
    { label: 'In Progress', value: String(operations.maintenance.filter((m) => m.status === 'IN_PROGRESS').length), tone: 'text-accent-400' },
    { label: 'Completed', value: String(summary.completed), tone: 'text-emerald-400' },
  ];

  return (
    <section>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h4 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
          <i className="ri-tools-line w-4 h-4 flex items-center justify-center text-foreground-400"></i>
          Maintenance
        </h4>
        <button
          type="button"
          onClick={onPlanMaintenance}
          className="flex items-center gap-1.5 text-sm text-accent-400 hover:text-accent-300 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3.5 py-2 transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-add-line w-4 h-4 flex items-center justify-center"></i>
          Plan Maintenance
        </button>
      </div>

      {operations.error && (
        <div className="text-xs text-foreground-500 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2 mb-3">
          {operations.error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-background-50 border border-background-200/60 rounded-lg p-3">
            <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap mb-1.5">{c.label}</p>
            <p className={`text-lg font-heading font-bold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* State strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        <StateCell
          label="Next Planned Maintenance"
          value={nextPlanned ? nextPlanned.title : 'None planned'}
          detail={nextPlanned?.planned_start ? formatDate(nextPlanned.planned_start) : undefined}
        />
        <StateCell
          label="Last Maintenance"
          value={lastCompleted ? lastCompleted.title : 'None recorded'}
          detail={lastCompleted?.completed_at ? formatDate(lastCompleted.completed_at) : undefined}
        />
        <StateCell
          label="Current State"
          value={summary.overdue > 0 ? 'Attention needed' : summary.active > 0 ? 'Active' : 'Idle'}
          tone={summary.overdue > 0 ? 'text-red-400' : 'text-foreground-200'}
        />
      </div>

      {/* Maintenance list */}
      {operations.maintenance.length === 0 ? (
        <div className="bg-background-50 border border-background-200/60 rounded-lg px-6 py-10 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-background-200/60 flex items-center justify-center">
            <i className="ri-tools-line text-xl text-foreground-500 w-6 h-6 flex items-center justify-center"></i>
          </div>
          <h5 className="text-sm font-heading font-semibold text-foreground-200 mb-1">No maintenance recorded</h5>
          <p className="text-sm text-foreground-500 mb-4">No planned or completed maintenance exists for this project.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {operations.maintenance.map((m) => {
            const relBug = m.related_bug_id != null ? bugById.get(m.related_bug_id) ?? null : null;
            const relChange = m.related_change_id != null ? changeById.get(m.related_change_id) ?? null : null;
            return (
              <div key={m.id} className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-sm font-medium text-foreground-100">{m.title}</span>
                      {isMaintenanceOverdue(m) && (
                        <span className="text-[10px] font-label px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 whitespace-nowrap">OVERDUE</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap ${MAINTENANCE_STATUS_STYLES[m.status]}`}>
                        {MAINTENANCE_STATUS_LABELS[m.status]}
                      </span>
                      {m.maintenance_type && (
                        <span className="text-[10px] text-foreground-500 bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap">
                          {MAINTENANCE_TYPE_LABELS[m.maintenance_type]}
                        </span>
                      )}
                      {m.priority && (
                        <span className={`text-[10px] font-label capitalize whitespace-nowrap ${priorityColors[m.priority] ?? ''}`}>{m.priority}</span>
                      )}
                      {m.owner && <span className="text-[11px] text-foreground-500 whitespace-nowrap">@{m.owner}</span>}
                    </div>

                    {(m.planned_start || m.planned_end) && (
                      <p className="text-[11px] text-foreground-500 mt-1.5">
                        Window: {m.planned_start ? formatDate(m.planned_start) : '—'} → {m.planned_end ? formatDate(m.planned_end) : '—'}
                      </p>
                    )}
                    {m.notes && <p className="text-xs text-foreground-500 line-clamp-1 mt-1.5">{m.notes}</p>}

                    {(relBug || relChange || m.related_incident_id) && (
                      <div className="flex items-center gap-2 flex-wrap mt-1.5">
                        {relBug && <span className="text-[10px] text-red-400 bg-red-500/10 rounded px-1.5 py-0.5 whitespace-nowrap">Bug: {relBug.title}</span>}
                        {relChange && <span className="text-[10px] text-sky-400 bg-sky-500/10 rounded px-1.5 py-0.5 whitespace-nowrap">Change: {relChange.title}</span>}
                        {m.related_incident_id && <span className="text-[10px] text-orange-400 bg-orange-500/10 rounded px-1.5 py-0.5 whitespace-nowrap">Related Incident</span>}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {m.status === 'PLANNED' && (
                      <button
                        type="button"
                        onClick={() => operations.startMaintenance(m.id)}
                        className="text-[11px] text-accent-400 hover:text-accent-300 whitespace-nowrap cursor-pointer"
                      >
                        Start
                      </button>
                    )}
                    {m.status === 'IN_PROGRESS' && (
                      <button
                        type="button"
                        onClick={() => operations.completeMaintenance(m.id)}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 whitespace-nowrap cursor-pointer"
                      >
                        Complete
                      </button>
                    )}
                    {m.status !== 'COMPLETED' && m.status !== 'CANCELLED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setBugDefaults({ title: `Defect: ${m.title}`, description: m.notes || '', severity: 'medium', source: 'maintenance', maintenanceId: m.id })}
                          className="text-[11px] text-red-400 hover:text-red-300 whitespace-nowrap cursor-pointer"
                        >
                          Create Bug
                        </button>
                        <button
                          type="button"
                          onClick={() => setChangeDefaults({ title: `Improvement: ${m.title}`, description: m.notes || '', priority: m.priority || 'medium', origin: 'maintenance', maintenanceId: m.id })}
                          className="text-[11px] text-sky-400 hover:text-sky-300 whitespace-nowrap cursor-pointer"
                        >
                          Create Change
                        </button>
                        <button
                          type="button"
                          onClick={() => operations.cancelMaintenance(m.id)}
                          className="text-[11px] text-foreground-500 hover:text-foreground-300 whitespace-nowrap cursor-pointer"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {bugDefaults && (
        <CreateBugModal
          open
          onClose={() => setBugDefaults(null)}
          onCreated={() => {
            setBugDefaults(null);
            onRefresh();
          }}
          projectId={project.id}
          projectName={project.project_name}
          defaults={bugDefaults}
          originLabel="Maintenance"
        />
      )}
      {changeDefaults && (
        <CreateChangeRequestModal
          open
          onClose={() => setChangeDefaults(null)}
          onCreated={() => {
            setChangeDefaults(null);
            onRefresh();
          }}
          projectId={project.id}
          projectName={project.project_name}
          defaults={{ ...changeDefaults, origin: 'maintenance' }}
          originLabel="Maintenance"
        />
      )}
    </section>
  );
}

function StateCell({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: string }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-2.5">
      <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap mb-1">{label}</p>
      <p className={`text-sm font-medium truncate ${tone ?? 'text-foreground-100'}`}>{value}</p>
      {detail && <p className="text-[10px] text-foreground-500 mt-0.5">{detail}</p>}
    </div>
  );
}