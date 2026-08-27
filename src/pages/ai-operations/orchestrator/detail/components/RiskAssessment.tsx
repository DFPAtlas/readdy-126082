import type { AiOrchestration } from '@/pages/ai-operations/types';
import { RISK_LEVEL, RISK_CLASS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function RiskAssessment({ orchestration }: { orchestration: AiOrchestration }) {
  const r = orchestration.riskAssessment;

  const impacts = [
    { label: 'Data impact', value: r.dataImpact },
    { label: 'Customer impact', value: r.customerImpact },
    { label: 'Financial impact', value: r.financialImpact },
    { label: 'Security impact', value: r.securityImpact },
    { label: 'Compliance impact', value: r.complianceImpact },
    { label: 'Reversibility', value: r.reversibility },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Risk Assessment</h3>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <StatusPill tone={RISK_LEVEL[r.overallRisk].tone} label={`Risk: ${RISK_LEVEL[r.overallRisk].label}`} />
        <StatusPill tone={RISK_CLASS[r.riskClass].tone} label={RISK_CLASS[r.riskClass].label} />
        {r.approvalRequired ? (
          <StatusPill tone="amber" label="Approval Required" />
        ) : (
          <StatusPill tone="emerald" label="No Approval Required" />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
        {impacts.map((impact) => (
          <div key={impact.label}>
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">{impact.label}</p>
            <p className="text-sm text-foreground-300 mt-0.5">{impact.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}