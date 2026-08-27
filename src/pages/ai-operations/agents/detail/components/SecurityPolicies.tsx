import { getPoliciesForAgent } from '@/pages/ai-operations/security/selectors';
import PolicyLinkList from '@/pages/ai-operations/security/components/PolicyLinkList';

export default function SecurityPolicies({ agentId }: { agentId: string }) {
  const policies = getPoliciesForAgent(agentId);

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Security &amp; Policies</h3>
        <span className="text-[11px] font-label text-foreground-600">{policies.length} policies</span>
      </div>
      <div className="px-4 py-3">
        <PolicyLinkList policies={policies} emptyMessage="No policies explicitly target this agent (group-wide defaults still apply)." />
      </div>
    </section>
  );
}