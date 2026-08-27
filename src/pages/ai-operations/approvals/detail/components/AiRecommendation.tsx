import type { ApprovalRecommendation } from '@/pages/ai-operations/types';

function Row({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-background-200/40 last:border-0">
      <i className={`${icon} text-sm text-accent-400 w-4 h-4 flex items-center justify-center mt-0.5 shrink-0`}></i>
      <div className="min-w-0">
        <p className="text-xs font-label text-foreground-600">{label}</p>
        <p className="text-sm text-foreground-300 mt-0.5">{value || '—'}</p>
      </div>
    </div>
  );
}

export default function AiRecommendation({ recommendation }: { recommendation: ApprovalRecommendation }) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">AI Recommendation</h3>
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm font-medium text-foreground-100">{recommendation.recommendation}</p>
          <span className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 whitespace-nowrap">
            <i className="ri-flashlight-line w-4 h-4 flex items-center justify-center"></i>
            {recommendation.confidence} confidence
          </span>
        </div>
        <Row label="Reasoning summary" value={recommendation.reasoningSummary} icon="ri-brain-line" />
        <Row label="Expected outcome" value={recommendation.expectedOutcome} icon="ri-arrow-right-line" />
        <Row label="Alternative considered" value={recommendation.alternativeConsidered} icon="ri-git-branch-line" />
        <Row label="Why approval is required" value={recommendation.whyApprovalRequired} icon="ri-shield-check-line" />
        <Row label="Risk if approved" value={recommendation.riskIfApproved} icon="ri-error-warning-line" />
        <Row label="Risk if rejected" value={recommendation.riskIfRejected} icon="ri-close-circle-line" />
        <Row label="Risk if delayed" value={recommendation.riskIfDelayed} icon="ri-time-line" />
      </div>
    </section>
  );
}