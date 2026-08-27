import { Link } from 'react-router-dom';
import { siteActivation, activationOrder } from '@/mocks/ai-operations-readiness-2';
import type { SiteActivationReadiness } from '@/pages/ai-operations/readiness/readinessTypes';
import Section from '@/pages/ai-operations/readiness/components/Section';

const FIELDS: { key: keyof SiteActivationReadiness; label: string }[] = [
  { key: 'registryReady', label: 'Registry' },
  { key: 'databaseConnected', label: 'Database' },
  { key: 'siteApiConnected', label: 'Site API' },
  { key: 'agentsConfigured', label: 'Agents' },
  { key: 'toolsConfigured', label: 'Tools' },
  { key: 'knowledgeConfigured', label: 'Knowledge' },
  { key: 'monitoringConnected', label: 'Monitoring' },
  { key: 'uatComplete', label: 'UAT' },
  { key: 'securityReview', label: 'Security' },
];

function Flag({ value }: { value: boolean }) {
  return value ? (
    <i className="ri-check-line text-emerald-400 text-sm w-4 h-4 flex items-center justify-center"></i>
  ) : (
    <i className="ri-close-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center"></i>
  );
}

export default function SiteActivationPlan() {
  return (
    <Section
      icon="ri-global-line"
      title="Site Activation Plan"
      subtitle="Readiness matrix for all six sites. None are falsely marked as production-enabled."
    >
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-left text-[11px] font-label uppercase tracking-wide text-foreground-500 border-b border-background-200/60">
              <th className="py-2 pr-4 font-semibold">Site</th>
              {FIELDS.map((f) => (
                <th key={f.key} className="py-2 pr-3 font-semibold whitespace-nowrap">{f.label}</th>
              ))}
              <th className="py-2 font-semibold">Production</th>
            </tr>
          </thead>
          <tbody>
            {siteActivation.map((s) => (
              <tr key={s.siteId} className="border-b border-background-200/40 last:border-0 hover:bg-background-50/50 transition-colors">
                <td className="py-2.5 pr-4">
                  <Link to={`/ai-operations/sites/${s.siteId}`} className="font-label font-medium text-foreground-100 hover:text-accent-400 transition-colors whitespace-nowrap">
                    {s.name}
                  </Link>
                </td>
                {FIELDS.map((f) => (
                  <td key={f.key} className="py-2.5 pr-3">
                    <Flag value={Boolean(s[f.key])} />
                  </td>
                ))}
                <td className="py-2.5">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-label whitespace-nowrap border bg-secondary-500/15 text-secondary-300 border-secondary-500/25">
                    Not Started
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Activation order */}
      <h3 className="text-xs font-label font-semibold uppercase tracking-wide text-foreground-500 mt-5 mb-2">Recommended Activation Order</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {activationOrder.map((a) => (
          <div key={a.order} className="border border-background-200/60 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-full bg-primary-500/10 text-primary-400 flex items-center justify-center shrink-0">
                <span className="text-xs font-label font-bold">{a.order}</span>
              </div>
              <span className="text-sm font-label font-semibold text-foreground-100">{a.name}</span>
            </div>
            <p className="text-xs text-foreground-500">{a.note}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}