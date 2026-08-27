import { coreAgentRuntime, siteAgentRuntime } from '@/mocks/ai-operations-readiness-2';
import type { AgentRuntimeItem } from '@/pages/ai-operations/readiness/readinessTypes';
import Section from '@/pages/ai-operations/readiness/components/Section';

const CHECK_KEYS: { key: keyof AgentRuntimeItem['checks']; label: string }[] = [
  { key: 'identity', label: 'Identity exists' },
  { key: 'modelAssigned', label: 'Model assigned' },
  { key: 'toolsAssigned', label: 'Tools assigned' },
  { key: 'knowledgeAssigned', label: 'Knowledge assigned' },
  { key: 'permissionsDefined', label: 'Permissions defined' },
  { key: 'policiesApplied', label: 'Security policies applied' },
  { key: 'approvalDefined', label: 'Approval policy defined' },
  { key: 'runtimeConfigured', label: 'Runtime configured' },
  { key: 'testingComplete', label: 'Testing complete' },
];

function Check({ value }: { value: boolean }) {
  return value ? (
    <i className="ri-check-line text-emerald-400 text-sm w-4 h-4 flex items-center justify-center"></i>
  ) : (
    <i className="ri-close-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center"></i>
  );
}

function AgentBlock({ agent }: { agent: AgentRuntimeItem }) {
  return (
    <div className="border border-background-200/60 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div>
          <p className="text-sm font-label font-semibold text-foreground-100">{agent.agent}</p>
          <p className="text-[11px] text-foreground-500">{agent.category} · {agent.siteName}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
        {CHECK_KEYS.map((c) => (
          <div key={c.key} className="flex items-center gap-1.5 text-xs text-foreground-500">
            <Check value={agent.checks[c.key]} />
            <span className={agent.checks[c.key] ? 'text-foreground-300' : 'text-foreground-600'}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AgentRuntimePlan() {
  return (
    <Section
      icon="ri-robot-2-line"
      title="Agent Runtime Readiness"
      subtitle="Readiness checks per agent class. Identities exist as demo records; no runtime is configured."
    >
      <h3 className="text-xs font-label font-semibold uppercase tracking-wide text-foreground-500 mb-2">Core Agents</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        {coreAgentRuntime.map((a) => (
          <AgentBlock key={a.id} agent={a} />
        ))}
      </div>

      <h3 className="text-xs font-label font-semibold uppercase tracking-wide text-foreground-500 mb-2">Site Agents</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {siteAgentRuntime.map((a) => (
          <AgentBlock key={a.id} agent={a} />
        ))}
      </div>
    </Section>
  );
}