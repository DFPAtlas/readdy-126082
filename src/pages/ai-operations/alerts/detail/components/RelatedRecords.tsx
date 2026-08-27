import { Link } from 'react-router-dom';
import type { AiAlert } from '@/pages/ai-operations/types';

function RelLink({ label, value, to, mono = false }: { label: string; value: string; to: string; mono?: boolean }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-background-200/30 transition-colors duration-150 cursor-pointer"
    >
      <span className="text-xs font-label text-foreground-500 uppercase tracking-wide">{label}</span>
      <span className={`text-sm text-foreground-100 flex items-center gap-1.5 ${mono ? 'font-mono' : ''}`}>
        {value}
        <i className="ri-arrow-right-line text-accent-400 w-4 h-4 flex items-center justify-center"></i>
      </span>
    </Link>
  );
}

export default function RelatedRecords({ alert }: { alert: AiAlert }) {
  const hasSite = alert.siteId !== 'group';
  const links: { label: string; value: string; to: string; mono?: boolean }[] = [];
  if (hasSite) links.push({ label: 'Site', value: alert.siteName, to: `/ai-operations/sites/${alert.siteId}` });
  if (alert.agentId) links.push({ label: 'Agent', value: alert.agentName, to: `/ai-operations/agents/${alert.agentId}` });
  if (alert.runId) links.push({ label: 'Run', value: alert.runId, to: `/ai-operations/runs/${alert.runId}`, mono: true });
  if (alert.orchestrationId) links.push({ label: 'Orchestration', value: alert.orchestrationId, to: `/ai-operations/orchestrator/${alert.orchestrationId}`, mono: true });
  if (alert.approvalId) links.push({ label: 'Approval', value: alert.approvalId, to: `/ai-operations/approvals/${alert.approvalId}`, mono: true });
  if (alert.toolId) links.push({ label: 'Tool', value: alert.toolId, to: `/ai-operations/tools/${alert.toolId}`, mono: true });
  if (alert.modelId) links.push({ label: 'Model', value: alert.modelId, to: `/ai-operations/models/${alert.modelId}`, mono: true });
  if (alert.policyId) links.push({ label: 'Security Policy', value: alert.governance.policyName || alert.policyId, to: `/ai-operations/security/policies/${alert.policyId}` });
  if (alert.knowledgeId) links.push({ label: 'Knowledge Source', value: alert.knowledgeId, to: `/ai-operations/knowledge/${alert.knowledgeId}`, mono: true });

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h4 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Related Records</h4>
      </div>
      {links.length === 0 ? (
        <p className="px-4 py-4 text-sm text-foreground-500">No linked records.</p>
      ) : (
        <div className="divide-y divide-background-200/40">
          {links.map((l) => (
            <RelLink key={l.label} label={l.label} value={l.value} to={l.to} mono={l.mono} />
          ))}
        </div>
      )}
    </section>
  );
}