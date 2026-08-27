// ============================================================================
// AI Operations — Tools & Connections reference resolver.
//
// Maps the loose tool/provider names already present in the Agent Registry,
// Group Site Registry and Orchestrator "Required Tools" back to the canonical
// connection IDs in the central Tools & Connections Registry. This lets the
// existing modules surface an "Open Connection" link without duplicating tool
// metadata or storing connection IDs across multiple registries.
// ============================================================================

const NAME_TO_ID: Record<string, string> = {
  supabase: 'CON-SUPABASE',
  n8n: 'CON-N8N',
  stripe: 'CON-STRIPE',
  billing: 'CON-STRIPE',
  resend: 'CON-EMAIL',
  email: 'CON-EMAIL',
  github: 'CON-GITHUB',
  readdy: 'CON-READDY',
  model: 'CON-MODEL',
  'ai model': 'CON-MODEL',
  monitoring: 'CON-MONITORING',
  observability: 'CON-MONITORING',
  notification: 'CON-NOTIFY',
  'notification service': 'CON-NOTIFY',
  authentication: 'CON-AUTH',
  auth: 'CON-AUTH',
  'knowledge base': 'CON-KB',
  knowledge: 'CON-KB',
  'site api': 'CON-SITE-API',
  api: 'CON-SITE-API',
  storage: 'CON-STORAGE',
  search: 'CON-SEARCH',
  analytics: 'CON-ANALYTICS',
  hosting: 'CON-INFRA',
  vercel: 'CON-INFRA',
};

export function resolveConnectionId(name: string): string | null {
  const key = name.trim().toLowerCase();
  return NAME_TO_ID[key] ?? null;
}