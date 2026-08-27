// ============================================================================
// AI Operations — Models & AI Providers reference resolver.
//
// Maps the loose model names already present in the Agent Registry model
// configuration (primary/fallback) back to the canonical model IDs in the
// central Models Registry. This lets the Agent detail "Model Configuration"
// surface an "Open Model" link without duplicating model metadata or storing
// model IDs across multiple registries.
// ============================================================================

const NAME_TO_ID: Record<string, string> = {
  'claude sonnet': 'MOD-CLAUDE-SONNET',
  'claude opus': 'MOD-CLAUDE-OPUS',
  'claude haiku': 'MOD-CLAUDE-HAIKU',
  'claude 3.5 vision': 'MOD-VISION',
  'gpt-4o': 'MOD-GPT4O',
  'gpt-4o mini': 'MOD-GPT4O-MINI',
  'gpt-3.5 turbo': 'MOD-LEGACY',
  'text-embedding-3-small': 'MOD-EMBED',
  'llama 3.1 70b': 'MOD-LLAMA-70B',
  'llama 3.1 8b': 'MOD-LLAMA-8B',
  'mistral 7b': 'MOD-MISTRAL',
  'codestral 22b': 'MOD-CODESTRAL',
};

export function resolveModelId(name: string): string | null {
  const key = name.trim().toLowerCase();
  return NAME_TO_ID[key] ?? null;
}