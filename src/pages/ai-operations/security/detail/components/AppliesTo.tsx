import { Link } from 'react-router-dom';
import type { AiSecurityPolicy } from '@/pages/ai-operations/types';
import { ENVIRONMENT_LABELS, RISK_CLASS } from '@/pages/ai-operations/constants';
import { demoAgents } from '@/mocks/ai-operations-agents';
import { demoConnections } from '@/mocks/ai-operations-tools';
import { demoModels } from '@/mocks/ai-operations-models';
import { getAllKnowledgeSources } from '@/pages/ai-operations/knowledge/selectors';

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-50 border border-background-200/60 rounded-full px-2.5 py-1 whitespace-nowrap">
      {children}
    </span>
  );
}

function LinkChip({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-background-50 border border-background-200/60 rounded-full px-2.5 py-1 hover:text-accent-300 hover:border-background-300/60 transition-colors cursor-pointer whitespace-nowrap">
      {label}
      <i className="ri-arrow-right-line w-3 h-3 flex items-center justify-center"></i>
    </Link>
  );
}

export default function AppliesTo({ policy }: { policy: AiSecurityPolicy }) {
  const agents = demoAgents.filter((a) => policy.agentIds.includes(a.id));
  const tools = demoConnections.filter((t) => policy.toolIds.includes(t.id));
  const models = demoModels.filter((m) => policy.modelIds.includes(m.id));
  const knowledge = getAllKnowledgeSources().filter((k) => policy.knowledgeIds.includes(k.id));

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Applies To</h3>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
        <Group label="Sites">
          {policy.siteId ? (
            <LinkChip to={`/ai-operations/sites/${policy.siteId}`} label={policy.siteName} />
          ) : (
            <Chip>{policy.siteName}</Chip>
          )}
        </Group>

        <Group label="Environments">
          <Chip>{ENVIRONMENT_LABELS[policy.environment]}</Chip>
        </Group>

        <Group label="Risk classes">
          <Chip>{RISK_CLASS[policy.riskClass].label}</Chip>
        </Group>

        <Group label="Agents">
          {agents.length === 0 ? (
            <Chip>All agents (group-wide)</Chip>
          ) : (
            agents.map((a) => <LinkChip key={a.id} to={`/ai-operations/agents/${a.id}`} label={a.name} />)
          )}
        </Group>

        <Group label="Tools">
          {tools.length === 0 ? (
            <Chip>—</Chip>
          ) : (
            tools.map((t) => <LinkChip key={t.id} to={`/ai-operations/tools/${t.id}`} label={t.name} />)
          )}
        </Group>

        <Group label="Models">
          {models.length === 0 ? (
            <Chip>—</Chip>
          ) : (
            models.map((m) => <LinkChip key={m.id} to={`/ai-operations/models/${m.id}`} label={m.name} />)
          )}
        </Group>

        <Group label="Knowledge sources">
          {knowledge.length === 0 ? (
            <Chip>—</Chip>
          ) : (
            knowledge.map((k) => <LinkChip key={k.id} to={`/ai-operations/knowledge/${k.id}`} label={k.title} />)
          )}
        </Group>
      </div>
    </section>
  );
}