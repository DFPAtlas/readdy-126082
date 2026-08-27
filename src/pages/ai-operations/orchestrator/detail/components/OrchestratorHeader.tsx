import { Link } from 'react-router-dom';
import type { AiOrchestration } from '@/pages/ai-operations/types';
import {
  ORCHESTRATION_STATUS,
  ORCHESTRATION_STAGE,
  RISK_LEVEL,
  RUN_PRIORITY,
  RISK_CLASS,
  ENVIRONMENT_LABELS,
} from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function OrchestratorHeader({ orchestration }: { orchestration: AiOrchestration }) {
  const status = ORCHESTRATION_STATUS[orchestration.status];
  const risk = RISK_LEVEL[orchestration.risk];
  const priority = RUN_PRIORITY[orchestration.priority];
  const riskClass = RISK_CLASS[orchestration.riskClass];

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs font-label text-foreground-600 flex-wrap" aria-label="Breadcrumb">
        <Link to="/ai-operations" className="hover:text-foreground-300 transition-colors cursor-pointer whitespace-nowrap">AI Operations</Link>
        <i className="ri-arrow-right-s-line w-4 h-4 flex items-center justify-center"></i>
        <Link to="/ai-operations/orchestrator" className="hover:text-foreground-300 transition-colors cursor-pointer whitespace-nowrap">Orchestrator</Link>
        <i className="ri-arrow-right-s-line w-4 h-4 flex items-center justify-center"></i>
        <span className="text-foreground-300 whitespace-nowrap">{orchestration.id}</span>
      </nav>

      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-label text-foreground-500">{orchestration.id}</span>
              <StatusPill tone={status.tone} label={status.label} pulse={['analysing', 'planning', 'selecting_agent', 'executing', 'verifying', 'uat'].includes(orchestration.status)} />
              <StatusPill tone={risk.tone} label={`Risk: ${risk.label}`} />
            </div>
            <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground-50 mt-2">{orchestration.title}</h1>
            <p className="text-sm text-foreground-500 mt-1 max-w-3xl">{orchestration.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {orchestration.siteId !== 'group' && (
              <Link
                to={`/ai-operations/sites/${orchestration.siteId}`}
                className="inline-flex items-center gap-2 text-xs font-label text-foreground-300 bg-background-50 border border-background-200/60 rounded-md px-3 py-2 hover:border-background-300/60 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-global-line text-sm w-4 h-4 flex items-center justify-center"></i>
                Open Site
              </Link>
            )}
            <Link
              to={`/ai-operations/agents/${orchestration.primaryAgentId}`}
              className="inline-flex items-center gap-2 text-xs font-label text-foreground-300 bg-background-50 border border-background-200/60 rounded-md px-3 py-2 hover:border-background-300/60 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-robot-2-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Open Agent
            </Link>
            {orchestration.rootRunId && (
              <Link
                to={`/ai-operations/runs/${orchestration.rootRunId}`}
                className="inline-flex items-center gap-2 text-xs font-label text-foreground-300 bg-background-50 border border-background-200/60 rounded-md px-3 py-2 hover:border-background-300/60 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-list-check-3 text-sm w-4 h-4 flex items-center justify-center"></i>
                Open Run
              </Link>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-background-50 border border-background-200/40 rounded-lg p-3">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Site</p>
            <p className="text-sm text-foreground-100 mt-1">{orchestration.siteName}</p>
          </div>
          <div className="bg-background-50 border border-background-200/40 rounded-lg p-3">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Current Stage</p>
            <p className="text-sm text-foreground-100 mt-1">{ORCHESTRATION_STAGE[orchestration.currentStage]}</p>
          </div>
          <div className="bg-background-50 border border-background-200/40 rounded-lg p-3">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Priority</p>
            <p className="text-sm text-foreground-100 mt-1">{priority.label}</p>
          </div>
          <div className="bg-background-50 border border-background-200/40 rounded-lg p-3">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Risk Class</p>
            <p className="text-sm text-foreground-100 mt-1">{riskClass.label}</p>
          </div>
          <div className="bg-background-50 border border-background-200/40 rounded-lg p-3">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Environment</p>
            <p className="text-sm text-foreground-100 mt-1">{ENVIRONMENT_LABELS[orchestration.environment]}</p>
          </div>
          <div className="bg-background-50 border border-background-200/40 rounded-lg p-3">
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Root Run</p>
            <p className="text-sm text-foreground-100 mt-1">{orchestration.rootRunId ?? '—'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}