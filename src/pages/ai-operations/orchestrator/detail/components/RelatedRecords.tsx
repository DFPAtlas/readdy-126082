import { Link } from 'react-router-dom';
import type { AiOrchestration } from '@/pages/ai-operations/types';

export default function RelatedRecords({ orchestration }: { orchestration: AiOrchestration }) {
  const childRuns = Array.from(
    new Set(
      orchestration.plan
        .map((s) => s.runId)
        .filter((id): id is string => Boolean(id) && id !== orchestration.rootRunId),
    ),
  );

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Related Records</h3>
      <div className="space-y-2.5">
        {orchestration.siteId !== 'group' && (
          <RelatedLink label="Site" value={orchestration.siteName} to={`/ai-operations/sites/${orchestration.siteId}`} />
        )}
        <RelatedLink label="Primary Agent" value={orchestration.primaryAgentName} to={`/ai-operations/agents/${orchestration.primaryAgentId}`} />

        {orchestration.supportingAgentIds.map((id) => (
          <RelatedLink key={id} label="Supporting Agent" value={id} to={`/ai-operations/agents/${id}`} />
        ))}

        {orchestration.rootRunId && (
          <RelatedLink label="Root Run" value={orchestration.rootRunId} to={`/ai-operations/runs/${orchestration.rootRunId}`} />
        )}

        {childRuns.map((id) => (
          <RelatedLink key={id} label="Child Run" value={id} to={`/ai-operations/runs/${id}`} />
        ))}

        {orchestration.approvalId && (
          <RelatedLink label="Approval" value={orchestration.approvalId} to={`/ai-operations/approvals/${orchestration.approvalId}`} />
        )}
      </div>
    </section>
  );
}

function RelatedLink({ label, value, to }: { label: string; value: string; to: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 bg-background-50 border border-background-200/40 rounded-lg px-3 py-2.5 hover:border-background-300/60 transition-colors cursor-pointer"
    >
      <span className="text-xs font-label text-foreground-600 uppercase tracking-wide">{label}</span>
      <span className="inline-flex items-center gap-1.5 text-sm text-foreground-100 font-label">
        {value}
        <i className="ri-arrow-right-line text-accent-400 w-4 h-4 flex items-center justify-center"></i>
      </span>
    </Link>
  );
}