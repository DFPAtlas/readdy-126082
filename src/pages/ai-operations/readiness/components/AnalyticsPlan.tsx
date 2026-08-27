import { analyticsSources } from '@/mocks/ai-operations-readiness-2';
import Section from '@/pages/ai-operations/readiness/components/Section';

export default function AnalyticsPlan() {
  return (
    <Section
      icon="ri-bar-chart-2-line"
      title="Analytics Plan"
      subtitle="Future live data sources for the wallboard / overview, including Users Online Across Group."
    >
      <div className="mb-4 bg-background-50 border border-background-300/60 rounded-lg px-4 py-3">
        <div className="flex items-start gap-2">
          <i className="ri-information-line text-accent-400 text-sm w-4 h-4 flex items-center justify-center mt-0.5"></i>
          <p className="text-xs text-foreground-400">
            <span className="font-label font-semibold text-foreground-200">Users Online Across Group</span> requires a later analytics integration providing:
            total active users, per-site active users, timestamp, data source and freshness state.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[11px] font-label uppercase tracking-wide text-foreground-500 border-b border-background-200/60">
              <th className="py-2 pr-4 font-semibold">Metric</th>
              <th className="py-2 pr-3 font-semibold">Required Fields</th>
              <th className="py-2 pr-3 font-semibold">Source</th>
              <th className="py-2 pr-3 font-semibold">Freshness</th>
              <th className="py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {analyticsSources.map((a) => (
              <tr key={a.metric} className="border-b border-background-200/40 last:border-0 hover:bg-background-50/50 transition-colors">
                <td className="py-2.5 pr-4 font-label font-medium text-foreground-100">{a.metric}</td>
                <td className="py-2.5 pr-3 text-xs text-foreground-500">{a.requiredFields}</td>
                <td className="py-2.5 pr-3 text-xs text-foreground-500 whitespace-nowrap">{a.source}</td>
                <td className="py-2.5 pr-3 text-xs text-foreground-500 whitespace-nowrap">{a.freshness}</td>
                <td className="py-2.5 text-xs text-foreground-500 capitalize">{a.status.replace('_', ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-foreground-600 mt-3">Demo — live analytics connection not configured.</p>
    </Section>
  );
}