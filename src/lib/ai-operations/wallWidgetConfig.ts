// ============================================================================
// AI Operations — Operations Wall widget configuration (typed data access).
//
// Persistent, per-site wall-widget configuration backed by `ai_site_widgets`
// (one widget per `ai_sites.id`). This module provides typed READ + WRITE
// helpers with clear validation and sanitised error handling — it does NOT
// render anything and does NOT change the visible wall layout.
//
// Safety guarantees:
//   * No credentials are read or written (display metadata only).
//   * Every function returns a structured { data, error } result and never
//     throws, so importing this module can never crash the app.
//   * Raw SQL / connection details are never surfaced to callers.
//   * Writes are validated before they reach the database.
//   * Duplicate-site and multiple-hub constraints are enforced by the database
//     and surfaced here as friendly messages.
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// --- Brand colour palette (matches the wallboard brand tokens) ---------------

export type WallWidgetBrandColor =
  | 'cyan'
  | 'blue'
  | 'teal'
  | 'orange'
  | 'purple'
  | 'yellow'
  | 'pink'
  | 'violet';

export const WALL_WIDGET_BRAND_COLORS: readonly WallWidgetBrandColor[] = [
  'cyan',
  'blue',
  'teal',
  'orange',
  'purple',
  'yellow',
  'pink',
  'violet',
];

// --- Row shape ---------------------------------------------------------------

export interface WallWidgetConfigRow {
  id: string;
  site_id: string;
  display_name: string;
  initials: string;
  subtitle: string | null;
  brand_color: string;
  visible_on_wall: boolean;
  display_order: number;
  visible_in_autonomous: boolean;
  is_hub: boolean;
  created_at: string;
  updated_at: string;
}

// --- Input shape -------------------------------------------------------------

// `site_id` is the resolved `ai_sites.id` UUID (resolution from the stable
// `site_key` happens in the caller via the live Sites registry, never here).
export interface WallWidgetConfigUpsertInput {
  site_id: string;
  display_name: string;
  initials: string;
  subtitle?: string | null;
  brand_color: WallWidgetBrandColor;
  visible_on_wall?: boolean;
  display_order?: number;
  visible_in_autonomous?: boolean;
  is_hub?: boolean;
}

// --- Validation --------------------------------------------------------------

/** Returns a user-safe error message, or null when the input is valid. */
export function validateWallWidgetConfig(input: WallWidgetConfigUpsertInput): string | null {
  if (!input.site_id || typeof input.site_id !== 'string') {
    return 'A site is required.';
  }
  if (!input.display_name || input.display_name.trim().length === 0) {
    return 'A display name is required.';
  }
  if (!input.initials || input.initials.trim().length === 0) {
    return 'Initials are required.';
  }
  if (input.initials.trim().length > 4) {
    return 'Initials must be 4 characters or fewer.';
  }
  if (!WALL_WIDGET_BRAND_COLORS.includes(input.brand_color)) {
    return 'The brand colour is not recognised.';
  }
  if (
    input.display_order != null &&
    (!Number.isInteger(input.display_order) || input.display_order < 0)
  ) {
    return 'Display order must be a non-negative whole number.';
  }
  return null;
}

// --- Error sanitisation ------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string }).message ?? '';

    if (/duplicate key|unique constraint|already exists|single_hub/i.test(msg)) {
      return 'This configuration conflicts with an existing widget (duplicate site or a second central hub).';
    }
    if (/row-level security|permission denied|not authorized|not authorised|policy/i.test(msg)) {
      return 'You do not have permission to change widget configuration.';
    }
    if (/network|fetch|failed to fetch|ECONN|ENOTFOUND/i.test(msg)) {
      return 'Unable to reach the database. Please try again.';
    }
    if (/relation .* does not exist|column .* does not exist/i.test(msg)) {
      return 'The widget configuration model is not ready yet.';
    }
  }
  return 'Unable to load widget configuration.';
}

// --- Generic query runner ----------------------------------------------------

async function runWidgetQuery<T>(
  builder: Promise<{ data: T | null; error: unknown }>,
): Promise<AiOpsResult<T>> {
  try {
    const { data, error } = await builder;
    if (error) {
      return { data: null, error: sanitiseError(error) };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

// --- Read helpers ------------------------------------------------------------

/** All widgets, ordered by display order (stable for the wall/rail). */
export function getWallWidgetConfigs(): Promise<AiOpsResult<WallWidgetConfigRow[]>> {
  return runWidgetQuery<WallWidgetConfigRow[]>(
    supabase.from('ai_site_widgets').select('*').order('display_order', { ascending: true }),
  );
}

/** A single widget by its resolved `ai_sites.id` UUID. */
export function getWallWidgetConfigBySiteId(
  siteId: string,
): Promise<AiOpsResult<WallWidgetConfigRow>> {
  return runWidgetQuery<WallWidgetConfigRow>(
    supabase.from('ai_site_widgets').select('*').eq('site_id', siteId).maybeSingle(),
  );
}

// --- Write helpers -----------------------------------------------------------

/** Create a widget for a site (fails cleanly if that site already has one). */
export function createWallWidgetConfig(
  input: WallWidgetConfigUpsertInput,
): Promise<AiOpsResult<WallWidgetConfigRow>> {
  const invalid = validateWallWidgetConfig(input);
  if (invalid) return Promise.resolve({ data: null, error: invalid });

  return runWidgetQuery<WallWidgetConfigRow>(
    supabase.from('ai_site_widgets').insert(input).select().single(),
  );
}

/** Update an existing widget, resolved by its `ai_sites.id` UUID. */
export function updateWallWidgetConfig(
  siteId: string,
  input: Partial<Omit<WallWidgetConfigUpsertInput, 'site_id'>>,
): Promise<AiOpsResult<WallWidgetConfigRow>> {
  // Validate the fields actually being changed (site_id is the lookup key).
  const probe: WallWidgetConfigUpsertInput = {
    site_id: siteId,
    display_name: input.display_name ?? 'x',
    initials: input.initials ?? 'x',
    brand_color: input.brand_color ?? 'cyan',
    display_order: input.display_order,
  };
  const invalid = validateWallWidgetConfig(probe);
  if (invalid) return Promise.resolve({ data: null, error: invalid });

  return runWidgetQuery<WallWidgetConfigRow>(
    supabase.from('ai_site_widgets').update(input).eq('site_id', siteId).select().single(),
  );
}