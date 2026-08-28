import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { AiOrchestration } from '@/pages/ai-operations/types';
import { AGENT_HEALTH, CAPACITY_STATE } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import {
  useOllamaCatalogue,
  refreshOllamaCatalogue,
} from '@/pages/ai-operations/models/ollamaCatalogueStore';

export default function CandidateAgents({ orchestration }: { orchestration: AiOrchestration }) {
  const { candidates } = orchestration;
  const catalogue = useOllamaCatalogue();

  useEffect(() => {
    void refreshOllamaCatalogue();
  }, []);

  const comparison = catalogue.comparison;
  const hasMissing = comparison ? comparison.registeredMissing > 0 : false;

  const missingBanner = hasMissing ? (
    <div className="mt-3 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2.5 flex items-center gap-2">
      <i className="ri-error-warning-line text-red-400 text-sm w-4 h-4 flex items-center justify-center shrink-0"></i>
      <p className="text-[11px] text-foreground-500">
        <strong className="text-red-400">BLOCKED — Model not present on HAL catalogue.</strong>{' '}
        {comparison?.registeredMissing} required local model(s) are registered but missing locally. This is a planning/governance check only — no inference or pull is issued.
      </p>
    </div>
  ) : null;

  if (candidates.length === 0) {
    return (
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Candidate Agents</h3>
        <p className="text-sm text-foreground-500">No candidate agents were evaluated for this orchestration.</p>
      </section>
    );
  }

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Candidate Agents</h3>
      <div className="space-y-3">
        {candidates.map((c) => (
          <div key={c.agentId} className="bg-background-50 border border-background-200/40 rounded-lg p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`text-sm text-foreground-100 font-medium ${c.selected ? '' : 'text-foreground-300'}`}>
                  {c.agentName}
                </span>
                {c.selected && (
                  <span className="text-[10px] font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-full px-2 py-0.5 whitespace-nowrap">
                    Selected
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <StatusPill tone={AGENT_HEALTH[c.health].tone} label={AGENT_HEALTH[c.health].label} />
                <StatusPill tone={CAPACITY_STATE[c.capacity].tone} label={CAPACITY_STATE[c.capacity].label} />
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
              <div>
                <p className="text-foreground-600">Score</p>
                <p className="text-foreground-100 mt-0.5">{c.score}</p>
              </div>
              <div>
                <p className="text-foreground-600">Eligibility</p>
                <p className="text-foreground-300 mt-0.5">{c.eligibility}</p>
              </div>
              <div>
                <p className="text-foreground-600">Capability</p>
                <p className="text-foreground-300 mt-0.5">{c.capabilityMatch}</p>
              </div>
              <div>
                <p className="text-foreground-600">Permission</p>
                <p className="text-foreground-300 mt-0.5">{c.permissionMatch}</p>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs text-foreground-500">{c.reason}</span>
              {c.selected ? (
                <Link
                  to={`/ai-operations/agents/${c.agentId}`}
                  className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Open Agent
                  <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
                </Link>
              ) : (
                <Link
                  to={`/ai-operations/agents/${c.agentId}`}
                  className="inline-flex items-center gap-1 text-xs font-label text-foreground-500 hover:text-foreground-300 transition-colors cursor-pointer whitespace-nowrap"
                >
                  View
                  <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
      {missingBanner}
    </section>
  );
}