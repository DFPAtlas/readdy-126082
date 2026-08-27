// ============================================================================
// AI Operations — Tasks & Runs — task database ↔ frontend mapper.
//
// A single, clean mapping between the Supabase `ai_tasks` row and the task
// metadata the run registry/detail needs. Tasks are resolved into their runs
// (a run belongs to exactly one task), so the primary purpose here is building
// a fast lookup (task UUID → name/type/site key) used by the run mapper — not
// rendering tasks standalone.
//
// ID strategy:
//   * `task_key` (text, unique) is the stable application identifier.
//   * The database `id` (UUID) is the internal primary key and is never exposed
//     as a route identifier.
// ============================================================================

import type { AiTaskRow, AiTaskUpsertInput } from '@/lib/ai-operations';

// Resolved task metadata used to enrich runs (no UUIDs leak to the UI).
export interface TaskLookup {
  nameById: Map<string, string>;
  typeById: Map<string, string>;
  keyById: Map<string, string>;
  descriptionById: Map<string, string>;
  /** Resolved stable site key ('group' when site_id is null). */
  siteKeyById: Map<string, string>;
  requestedById: Map<string, string>;
  triggerSourceById: Map<string, string>;
}

/**
 * Build fast lookup maps from live `ai_tasks` rows. `siteKeyById` resolves the
 * task's `site_id` UUID back to a stable site key (or 'group').
 */
export function buildTaskLookup(
  tasks: AiTaskRow[],
  siteKeyById: Map<string, string>,
): TaskLookup {
  const nameById = new Map<string, string>();
  const typeById = new Map<string, string>();
  const keyById = new Map<string, string>();
  const descriptionById = new Map<string, string>();
  const siteKeyResolved = new Map<string, string>();
  const requestedById = new Map<string, string>();
  const triggerSourceById = new Map<string, string>();

  for (const t of tasks) {
    nameById.set(t.id, t.name);
    typeById.set(t.id, t.task_type ?? 'other');
    keyById.set(t.id, t.task_key);
    descriptionById.set(t.id, t.description ?? '');
    siteKeyResolved.set(t.id, t.site_id ? (siteKeyById.get(t.site_id) ?? 'group') : 'group');
    requestedById.set(t.id, t.requested_by ?? '');
    triggerSourceById.set(t.id, t.trigger_source ?? 'user');
  }

  return {
    nameById,
    typeById,
    keyById,
    descriptionById,
    siteKeyById: siteKeyResolved,
    requestedById,
    triggerSourceById,
  };
}

// Input shape for a new (non-executing) task, assembled by the Create Task form.
export interface TaskCreateInput {
  taskKey: string;
  name: string;
  description: string;
  taskType: string;
  siteId: string | null;
  requestedBy: string;
  triggerSource: string;
  priority: string;
  riskLevel: string;
  environment: string;
  status: string;
  approvalRequired: boolean;
  verificationRequired: boolean;
  uatRequired: boolean;
  auditRequired: boolean;
  notes: string;
}

/** Map a Create Task form input to the database upsert shape. */
export function toAiTaskInput(input: TaskCreateInput): AiTaskUpsertInput {
  return {
    task_key: input.taskKey,
    name: input.name,
    description: input.description,
    task_type: input.taskType,
    site_id: input.siteId,
    requested_by: input.requestedBy,
    trigger_source: input.triggerSource,
    priority: input.priority,
    risk_level: input.riskLevel,
    environment: input.environment,
    status: input.status,
    approval_required: input.approvalRequired,
    verification_required: input.verificationRequired,
    uat_required: input.uatRequired,
    audit_required: input.auditRequired,
    notes: input.notes,
  };
}