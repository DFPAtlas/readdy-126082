import { Link } from 'react-router-dom';
import type { OrchestratorStatus } from '@/pages/ai-operations/types';
import { HEALTH_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function MasterOrchestrator({ orchestrator }: { orchestrator: OrchestratorStatus }) {
  const display = HEALTH_STATUS[orchestrator.status];

  return (
    <section className="bg-background-100 border border-accent-500/20 rounded-lg p-4 md:p-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-accent-500/15 flex items-center justify-center shrink-0">
            <i className="ri-robot-2-line text-lg text-accent-400 w-5 h-5 flex items-center justify-center"></i>
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-heading font-semibold text-foreground-100">DFP Group Master Orchestrator</h2>
            <p className="text-sm text-foreground-500 mt-1 max-w-2xl">
              Routes AI tasks to the correct group, site and specialist agent while enforcing permissions, approvals and audit controls.
            </p>
          </div>
        </div>
        <Link
          to="/ai-operations/orchestrator"
          className="inline-flex items-center gap-2 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-3 py-2 hover:bg-accent-500/20 transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start lg:self-center"
        >
          <i className="ri-external-link-line w-4 h-4 flex items-center justify-center"></i>
          Open Orchestrator
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-background-50 border border-background-200/40 rounded-lg p-3">
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Status</p>
          <div className="mt-1.5">
            <StatusPill tone={display.tone} label={display.label} />
          </div>
        </div>
        <div className="bg-background-50 border border-background-200/40 rounded-lg p-3">
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Active Jobs</p>
          <p className="text-lg font-heading font-bold text-foreground-100 mt-1">{orchestrator.activeJobs}</p>
        </div>
        <div className="bg-background-50 border border-background-200/40 rounded-lg p-3">
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Queue</p>
          <p className="text-lg font-heading font-bold text-foreground-100 mt-1">{orchestrator.queue}</p>
        </div>
        <div className="bg-background-50 border border-background-200/40 rounded-lg p-3">
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Success Rate</p>
          <p className="text-lg font-heading font-bold text-foreground-100 mt-1">{orchestrator.successRate}</p>
        </div>
        <div className="bg-background-50 border border-background-200/40 rounded-lg p-3">
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Last Run</p>
          <p className="text-lg font-heading font-bold text-foreground-100 mt-1">{orchestrator.lastRun}</p>
        </div>
      </div>
    </section>
  );
}