// Exact joins only. Instance-bound workflow keys originate in HAL's signed metadata.
interface RegistryIdentity {
  id: string; workflow_key: string; n8n_workflow_id: string | null; name: string | null;
  agent_id: string | null; site_id: string | null; environment: string; is_active: boolean; runtime_status: string;
}
interface AgentIdentity {
  id: string; name: string; site_id: string | null; environment: string; is_active: boolean; workflow_id?: string | null;
}
interface SiteIdentity { id: string; site_key?: string; name: string; environment: string; is_active: boolean }
export interface WorkflowMappingContext {
  registry: RegistryIdentity[]; agents: AgentIdentity[]; sites: SiteIdentity[];
  environment: string; available: boolean;
}
export function resolveHalWorkflowMapping(workflowId: string, registryWorkflowKey: string | null | undefined, context: WorkflowMappingContext) {
  const fallback = (label: string) => ({ title: `Workflow ${workflowId}`, agentName: null as string | null,
    siteName: null as string | null, label, mapped: false, registryVerified: false });
  if (!registryWorkflowKey) return fallback('UNMAPPED');
  if (!context.available || !context.environment) return fallback('MAPPING UNAVAILABLE');
  const matches = context.registry.filter(row => row.workflow_key === registryWorkflowKey && row.environment === context.environment && row.is_active);
  if (matches.length !== 1) return fallback(matches.length > 1 ? 'AMBIGUOUS MAPPING' : 'REGISTRY MAPPING MISSING');
  const row = matches[0];
  if (row.n8n_workflow_id !== workflowId) return fallback('WORKFLOW ID MISMATCH');
  const agentMatches = context.agents.filter(agent => agent.id === row.agent_id && agent.environment === context.environment && agent.is_active);
  if (row.agent_id && agentMatches.length !== 1) return fallback('AGENT MAPPING UNRESOLVED');
  const agent = agentMatches[0];
  if (agent?.workflow_id && agent.workflow_id !== row.id) return fallback('AGENT WORKFLOW CONFLICT');
  if (agent?.site_id && row.site_id && agent.site_id !== row.site_id) return fallback('SITE MAPPING CONFLICT');
  const siteId = row.site_id ?? agent?.site_id;
  const siteMatches = context.sites.filter(site => site.id === siteId && site.environment === context.environment && site.is_active);
  if (siteId && siteMatches.length !== 1) return fallback('SITE MAPPING UNRESOLVED');
  return { title: agent?.name || row.name || row.workflow_key, agentName: agent?.name ?? null,
    siteName: siteMatches[0]?.name ?? null, mapped: true,
    registryVerified: row.runtime_status === 'verified',
    label: row.runtime_status === 'verified' ? 'REGISTRY VERIFIED' : 'REGISTRY UNVERIFIED' };
}
