import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Project, Bug, ChangeRequest } from '../types';
import { priorityColors } from '../types';
import { formatRelative } from '../utils';
import type { MaintenanceItem } from '../operationsTypes';
import {
  computeTechnicalDebtSummary,
  buildImprovementBacklog,
  IMPROVEMENT_SOURCE_LABELS,
  IMPROVEMENT_SOURCE_STYLES,
  BUILD_INCORPORATION_LABELS,
  BUILD_INCORPORATION_STYLES,
} from '../operationsTypes';
import CreateChangeRequestModal from './CreateChangeRequestModal';

interface OperationsImprovementPanelProps {
  project: Project;
  changeRequests: ChangeRequest[];
  bugs: Bug[];
  maintenance: MaintenanceItem[];
  onRefresh: () => void;
}

export default function OperationsImprovementPanel({
  project,
  changeRequests,
  bugs,
  maintenance,
  onRefresh,
}: OperationsImprovementPanelProps) {
  const [createDefaults, setCreateDefaults] = useState<{
    title: string;
    description: string;
    priority: string;
    origin: string;
    type: string | null;
  } | null>(null);

  const debt = computeTechnicalDebtSummary(changeRequests);
  const backlog = buildImprovementBacklog(changeRequests, bugs, maintenance);

  const debtCards: { label: string; value: string; tone: string }[] = [
    { label: 'Open Technical Debt', value: String(debt.open), tone: debt.open > 0 ? 'text-sky-400' : 'text-emerald-400' },
    { label: 'Critical / High', value: String(debt.criticalHigh), tone: debt.criticalHigh > 0 ? 'text-red-400' : 'text-emerald-400' },
    { label: 'Approved', value: String(debt.approved), tone: debt.approved > 0 ? 'text-sky-400' : 'text-foreground-200' },
    { label: 'In Progress', value: String(debt.inProgress), tone: debt.inProgress > 0 ? 'text-accent-400' : 'text-foreground-200' },
  ];

  return (
    <div className="space-y-6">
      {/* ── Technical Debt ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h4 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            <i className="ri-git-commit-line w-4 h-4 flex items-center justify-center text-foreground-400"></i>
            Technical Debt
          </h4>
          <Link
            to="/change-requests"
            className="flex items-center gap-1.5 text-sm text-foreground-400 hover:text-accent-400 whitespace-nowrap cursor-pointer"
          >
            Open Changes
            <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {debtCards.map((c) => (
            <div key={c.label} className="bg-background-50 border border-background-200/60 rounded-lg p-3">
              <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap mb-1.5">{c.label}</p>
              <p className={`text-lg font-heading font-bold ${c.tone}`}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-0.5">Oldest Item</p>
            <p className="text-sm text-foreground-200">{debt.oldest ? debt.oldest.title : 'No technical debt'}</p>
          </div>
          {debt.oldest && (
            <span className="text-xs text-foreground-500 whitespace-nowrap">{formatRelative(debt.oldest.createdAt)}</span>
          )}
        </div>
      </section>

      {/* ── Improvement Backlog ────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h4 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">
            <i className="ri-lightbulb-line w-4 h-4 flex items-center justify-center text-foreground-400"></i>
            Improvement Backlog
            <span className="text-foreground-500">({backlog.length})</span>
          </h4>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setCreateDefaults({ title: '', description: '', priority: 'medium', origin: 'manual', type: null })}
              className="flex items-center gap-1.5 text-sm text-accent-400 hover:text-accent-300 bg-background-50 border border-background-200/60 hover:border-accent-500/30 rounded-full px-3.5 py-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-add-line w-4 h-4 flex items-center justify-center"></i>
              Create Improvement
            </button>
            <button
              type="button"
              onClick={() => setCreateDefaults({ title: '', description: '', priority: 'medium', origin: 'manual', type: 'technical_debt' })}
              className="text-sm text-foreground-400 hover:text-foreground-200 whitespace-nowrap cursor-pointer"
            >
              Log Technical Debt
            </button>
          </div>
        </div>

        {backlog.length === 0 ? (
          <div className="bg-background-50 border border-background-200/60 rounded-lg px-6 py-10 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-background-200/60 flex items-center justify-center">
              <i className="ri-lightbulb-line text-xl text-foreground-500 w-6 h-6 flex items-center justify-center"></i>
            </div>
            <h5 className="text-sm font-heading font-semibold text-foreground-200 mb-1">No improvement backlog</h5>
            <p className="text-sm text-foreground-500">No improvement change requests or open maintenance follow-ups exist yet.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {backlog.map((item) => (
              <div key={item.key} className="bg-background-50 border border-background-200/60 rounded-lg px-4 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-sm font-medium text-foreground-100">{item.title}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap ${IMPROVEMENT_SOURCE_STYLES[item.source]}`}>
                        {IMPROVEMENT_SOURCE_LABELS[item.source]}
                      </span>
                      {item.priority && (
                        <span className={`text-[10px] font-label capitalize whitespace-nowrap ${priorityColors[item.priority] ?? ''}`}>{item.priority}</span>
                      )}
                      <span className="text-[10px] text-foreground-500 bg-background-200/60 rounded px-1.5 py-0.5 whitespace-nowrap capitalize">
                        {item.status.replace('_', ' ')}
                      </span>
                      <span className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap ${BUILD_INCORPORATION_STYLES[item.buildState]}`}>
                        {BUILD_INCORPORATION_LABELS[item.buildState]}
                      </span>
                    </div>
                    {item.createdAt && <p className="text-[11px] text-foreground-600 mt-1.5">Created {formatRelative(item.createdAt)}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
          defaults={{ ...createDefaults, origin: createDefaults.origin }}
          originLabel={createDefaults.type === 'technical_debt' ? 'Technical Debt' : 'Manual'}
        />
      )}
    </div>
  );
}