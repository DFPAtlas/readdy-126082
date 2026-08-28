// ============================================================================
// AI Operations — Local Ollama catalogue relay + model registry comparison
// (Phase 3 Prompt 09C).
//
// The HAL private runtime bridge relays a SANITISED local Ollama `/api/tags`
// catalogue (model name, family, parameter size, quantisation, local/remote
// classification, modified timestamp) into the `ai_runtime_bridge_messages`
// ledger as an `ollama_catalogue_response` message with `source=local_bridge`.
//
// The browser NEVER contacts Ollama directly and NEVER performs inference —
// it only SELECTs the relayed catalogue and compares it deterministically
// against the live `ai_operations_models` registry. No registry row is ever
// mutated by this module.
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';
import type { AiOperationsModelRow } from '@/lib/ai-operations/types';
import {
  freshnessOf,
  type FreshnessState,
} from './runtimeHealthSource';

// --- Catalogue types -----------------------------------------------------------

export type OllamaModelClassification = 'local' | 'remote';

export interface OllamaCatalogueModel {
  /** Ollama model name, e.g. "qwen2.5:14b" or "nemotron-3-ultra:cloud". */
  name: string;
  family: string | null;
  parameterSize: string | null;
  quantization: string | null;
  classification: OllamaModelClassification;
  modifiedAt: string | null;
}

export interface OllamaCatalogue {
  source: 'local_bridge';
  catalogueAt: string | null;
  modelCount: number;
  models: OllamaCatalogueModel[];
}

// --- Registry comparison --------------------------------------------------------

export type CatalogueMatchState =
  | 'registered_present'
  | 'registered_missing'
  | 'present_not_registered'
  | 'remote_cloud'
  | 'registry_disabled'
  | 'needs_review';

export interface CatalogueMatchEntry {
  /** Stable reference key — model_key for registry rows, model name for catalogue rows. */
  key: string;
  name: string;
  state: CatalogueMatchState;
  /** Registry model_key when this entry maps to a registry row, else null. */
  modelKey: string | null;
  family: string | null;
  parameterSize: string | null;
  quantization: string | null;
  classification: OllamaModelClassification;
  detail: string;
}

export interface CatalogueComparison {
  source: 'local_bridge';
  catalogueAt: string | null;
  freshness: FreshnessState;
  totalCatalogueModels: number;
  localModels: number;
  remoteCloudModels: number;
  registeredPresent: number;
  registeredMissing: number;
  presentNotRegistered: number;
  remoteCloud: number;
  registryDisabled: number;
  needsReview: number;
  entries: CatalogueMatchEntry[];
}

// --- Sanitisation ----------------------------------------------------------------

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Reduce a raw relayed model object to the safe field set only. */
function sanitiseCatalogueModel(raw: unknown): OllamaCatalogueModel | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name);
  if (!name) return null;
  const classification: OllamaModelClassification =
    r.classification === 'remote' ? 'remote' : 'local';
  return {
    name,
    family: str(r.family) || null,
    parameterSize: str(r.parameter_size) || null,
    quantization: str(r.quantization) || null,
    classification,
    modifiedAt: str(r.modified_at) || null,
  };
}

// --- Data access -----------------------------------------------------------------

interface CatalogueMessageRow {
  id: string;
  message_type: string;
  safe_payload: Record<string, unknown> | null;
  created_at: string;
}

export async function getLatestOllamaCatalogue(): Promise<AiOpsResult<OllamaCatalogue | null>> {
  try {
    const { data, error } = await supabase
      .from('ai_runtime_bridge_messages')
      .select('id, message_type, safe_payload, created_at')
      .eq('message_type', 'ollama_catalogue_response')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) {
      return { data: null, error: 'Unable to read the relayed Ollama catalogue.' };
    }
    const row: CatalogueMessageRow | undefined = data?.[0];
    if (!row) return { data: null, error: null };

    const payload = row.safe_payload as Record<string, unknown> | null;
    const rawModels = Array.isArray(payload?.models) ? (payload.models as unknown[]) : [];
    const models = rawModels
      .map(sanitiseCatalogueModel)
      .filter((m): m is OllamaCatalogueModel => m !== null);
    const modelCount =
      typeof payload?.model_count === 'number' ? (payload.model_count as number) : models.length;

    return {
      data: {
        source: 'local_bridge',
        catalogueAt: str(payload?.catalogue_at) || row.created_at || null,
        modelCount,
        models,
      },
      error: null,
    };
  } catch {
    return { data: null, error: 'Unable to read the relayed Ollama catalogue.' };
  }
}

// --- Deterministic matching helpers ---------------------------------------------

/** Normalise a model name for deterministic comparison (lowercase, trimmed). */
function normalise(s: string): string {
  return s.trim().toLowerCase();
}

/** Alphanumeric-only normalisation for deterministic family-prefix detection. */
function alnum(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Strip a `:tag` suffix (e.g. "qwen2.5:14b" → "qwen2.5"). */
function baseName(name: string): string {
  const i = name.indexOf(':');
  return i >= 0 ? name.slice(0, i) : name;
}

/** A catalogue entry is remote/cloud when the name carries a `:cloud` tag. */
function isRemoteCloud(name: string): boolean {
  return /:cloud$/i.test(name);
}

// --- Comparison ------------------------------------------------------------------

function registryNames(row: AiOperationsModelRow): string[] {
  const keys = [row.name, row.model_reference, row.display_name]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map(normalise);
  return [...new Set(keys)];
}

/**
 * Deterministic comparison between the relayed local Ollama catalogue and the
 * live `ai_operations_models` registry.
 *
 * Matching is exact (normalised name / model_reference / display_name) only —
 * never fuzzy/AI. A family-prefix match (same base, ambiguous tag) is surfaced
 * as `needs_review`, never guessed. Registry rows are never mutated.
 */
export function compareCatalogueToRegistry(
  catalogue: OllamaCatalogue | null,
  registry: AiOperationsModelRow[],
): CatalogueComparison | null {
  if (!catalogue) return null;

  const models = catalogue.models;
  const localModels = models.filter((m) => m.classification === 'local');
  const remoteModels = models.filter((m) => m.classification === 'remote');

  // Registry rows split by hosting + active state.
  const localRegistry = registry.filter((r) => r.hosting_type === 'local' && r.is_active === true);
  const disabledRegistry = registry.filter((r) => r.hosting_type === 'local' && r.is_active !== true);

  // Exact full-name set + alnum base set for local catalogue entries.
  const localFullNames = new Set(localModels.map((m) => normalise(m.name)));
  const localBaseNames = new Map<string, string[]>(); // alnum(base) → original base names
  for (const m of localModels) {
    const base = baseName(m.name);
    const k = alnum(base);
    const arr = localBaseNames.get(k) ?? [];
    arr.push(base);
    localBaseNames.set(k, arr);
  }

  const entries: CatalogueMatchEntry[] = [];
  const matchedCatalogueNames = new Set<string>();

  // 1. Local, active registry models → registered_present / registered_missing / needs_review.
  for (const row of localRegistry) {
    const names = registryNames(row);
    const exactMatch = names.some((n) => localFullNames.has(n));

    let state: CatalogueMatchState = 'registered_missing';
    let detail = 'Registered but not present in the relayed local catalogue.';
    let family: string | null = null;
    let parameterSize: string | null = null;
    let quantization: string | null = null;

    if (exactMatch) {
      const matched = localModels.find((m) => names.includes(normalise(m.name)));
      state = 'registered_present';
      detail = 'Present locally and registered.';
      family = matched?.family ?? null;
      parameterSize = matched?.parameterSize ?? null;
      quantization = matched?.quantization ?? null;
      if (matched) matchedCatalogueNames.add(normalise(matched.name));
    } else {
      // Deterministic family-prefix check (same base, ambiguous tag → review).
      const rowAlnum = names.map(alnum);
      const ambiguous = [...localBaseNames.keys()].some((baseKey) =>
        baseKey.length >= 3 && rowAlnum.some((r) => r.startsWith(baseKey) || baseKey.startsWith(r)),
      );
      if (ambiguous) {
        state = 'needs_review';
        detail = 'A local catalogue entry shares a family name but the tag is ambiguous — manual review required (no guessing).';
      }
    }

    entries.push({
      key: row.model_key,
      name: row.name,
      state,
      modelKey: row.model_key,
      family,
      parameterSize,
      quantization,
      classification: 'local',
      detail,
    });
  }

  // 2. Local catalogue models not matched to any registry → present_not_registered / needs_review.
  for (const m of localModels) {
    if (matchedCatalogueNames.has(normalise(m.name))) continue;
    const base = baseName(m.name);
    const baseKey = alnum(base);
    const registryAlnum = localRegistry.flatMap((r) => registryNames(r).map(alnum));
    const ambiguous = baseKey.length >= 3 && registryAlnum.some((r) => r.startsWith(baseKey) || baseKey.startsWith(r));

    entries.push({
      key: m.name,
      name: m.name,
      state: ambiguous ? 'needs_review' : 'present_not_registered',
      modelKey: null,
      family: m.family,
      parameterSize: m.parameterSize,
      quantization: m.quantization,
      classification: 'local',
      detail: ambiguous
        ? 'Present locally but the registry mapping is ambiguous — manual review required (no guessing).'
        : 'Present locally but not registered in the model registry.',
    });
  }

  // 3. Remote/cloud catalogue entries (e.g. nemotron-3-ultra:cloud).
  for (const m of remoteModels) {
    entries.push({
      key: m.name,
      name: m.name,
      state: 'remote_cloud',
      modelKey: null,
      family: m.family,
      parameterSize: m.parameterSize,
      quantization: m.quantization,
      classification: 'remote',
      detail: 'Remote/cloud model reference surfaced via the Ollama catalogue — not locally hosted.',
    });
  }

  // 4. Disabled local registry rows.
  for (const row of disabledRegistry) {
    entries.push({
      key: row.model_key,
      name: row.name,
      state: 'registry_disabled',
      modelKey: row.model_key,
      family: null,
      parameterSize: null,
      quantization: null,
      classification: 'local',
      detail: 'Registry entry is disabled (is_active = false).',
    });
  }

  const count = (s: CatalogueMatchState) => entries.filter((e) => e.state === s).length;

  return {
    source: 'local_bridge',
    catalogueAt: catalogue.catalogueAt,
    freshness: freshnessOf(catalogue.catalogueAt),
    totalCatalogueModels: catalogue.modelCount,
    localModels: localModels.length,
    remoteCloudModels: remoteModels.length,
    registeredPresent: count('registered_present'),
    registeredMissing: count('registered_missing'),
    presentNotRegistered: count('present_not_registered'),
    remoteCloud: count('remote_cloud'),
    registryDisabled: count('registry_disabled'),
    needsReview: count('needs_review'),
    entries,
  };
}

/** Stable registry-presence lookup for a single model name (exact + family-prefix). */
export function cataloguePresenceForModel(
  comparison: CatalogueComparison | null,
  modelName: string,
): CatalogueMatchState | null {
  if (!comparison) return null;
  const n = normalise(modelName);
  const exact = comparison.entries.find(
    (e) => e.modelKey !== null && normalise(e.name) === n,
  );
  if (exact) return exact.state;

  const a = alnum(modelName);
  const ambiguous = comparison.entries.some(
    (e) => e.modelKey !== null && alnum(e.name).startsWith(a),
  );
  if (ambiguous) return 'needs_review';
  return null;
}

// --- Presentation helpers --------------------------------------------------------

export const CATALOGUE_MATCH_META: Record<
  CatalogueMatchState,
  { label: string; tone: 'emerald' | 'amber' | 'red' | 'accent' | 'secondary' }
> = {
  registered_present: { label: 'Registered + Present Locally', tone: 'emerald' },
  registered_missing: { label: 'Registered + Missing Locally', tone: 'amber' },
  present_not_registered: { label: 'Present Locally + Not Registered', tone: 'amber' },
  remote_cloud: { label: 'Remote/Cloud Reference', tone: 'accent' },
  registry_disabled: { label: 'Registry Disabled', tone: 'secondary' },
  needs_review: { label: 'Needs Review', tone: 'red' },
};

export function describeCatalogueFreshness(
  comparison: CatalogueComparison | null,
): { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' } {
  if (!comparison) return { label: 'Not Reported', tone: 'secondary' };
  if (comparison.freshness === 'offline') return { label: 'Catalogue Verification Stale', tone: 'red' };
  if (comparison.freshness === 'stale') return { label: 'Catalogue Verification Stale', tone: 'amber' };
  return { label: 'Verified', tone: 'emerald' };
}