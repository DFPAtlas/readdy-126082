import { getPoliciesForKnowledge } from '@/pages/ai-operations/security/selectors';
import PolicyLinkList from '@/pages/ai-operations/security/components/PolicyLinkList';

export default function ApplicablePolicies({ sourceId }: { sourceId: string }) {
  const policies = getPoliciesForKnowledge(sourceId);

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Applicable Policies</h3>
        <span className="text-[11px] font-label text-foreground-600">{policies.length} policies</span>
      </div>
      <div className="px-4 py-3">
        <PolicyLinkList
          policies={policies}
          emptyMessage="No policies explicitly target this knowledge source. Classification and scope rules still apply group-wide."
        />
      </div>
    </section>
  );
}