// ============================================================================
// AI Operations — n8n runtime connector (Phase 3 Prompt 06).
//
// Read-only / DRY-RUN n8n metadata adapter that sits behind the trusted runtime
// gateway. The `n8n-runtime-connector` Edge Function verifies connectivity,
// discovers workflow metadata, maintains the approved workflow allowlist,
// validates mappings, and produces a dispatch preview — but NEVER executes an
// n8n workflow, calls a webhook, activates/deactivates/edits workflows, or
// changes credentials.
//
// The browser can only SELECT the approved workflow registry (internal staff)
// and invoke the connector's allowlisted read-only operations. n8n credentials,
// auth headers, and raw workflow JSON never reach the browser.
// ============================================================================

import { supabase } from '@/lib/supabase';
import type { AiOpsResult } from '@/lib/ai-operations/types';

// --- Row types -----------------------------------------------------------------

export type N8nExecutionMode = 'disabled' | 'dry_run' | 'future_pilot';
export type N8nRiskLevel = 'green' | 'amber' | 'red';

export interface AiN8nWorkflowRegistryRow {
  id: string;
  workflow_key: string;
  n8n_workflow_id: string | null;
  name: string | null;
  description: string | null;
  purpose: string | null;
  site_id: string | null;
  agent_id: string | null;
  environment: string;
  workflow_type: string | null;
  allowed_request_types: string[];
  risk_level: string | null;
  approval_required: boolean;
  runtime_status: string;
  execution_mode: N8nExecutionMode;
  connector_key: string;
  last_verified_at: string | null;
  last_seen_updated_at: string | null;
  node_count: number | null;
  trigger_types: string[];
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// --- Connector contracts -------------------------------------------------------

export interface N8nConnectionState {
  configured: boolean;
  reachable: boolean;
  authenticated: boolean | null;
  error: string | null;
}

export interface N8nWorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  tags: string[];
  updatedAt: string | null;
  nodeCount: number;
  triggers: string[];
  hasWebhook: boolean;
  hasSchedule: boolean;
  risk: N8nRiskLevel;
}

export interface N8nConnectorStatus {
  operation: 'status';
  connection: N8nConnectionState;
  approvedWorkflows: number;
  verifiedMappings: number;
  mappingsNeedingReview: number;
  dispatchMode: string;
}

export interface N8nListWorkflowsResult {
  operation: 'list_workflows';
  ok: boolean;
  workflows: N8nWorkflowSummary[];
  error: string | null;
}

export interface N8nInspectWorkflowResult {
  operation: 'inspect_workflow';
  ok: boolean;
  workflow: N8nWorkflowSummary | null;
  error: string | null;
}

export interface N8nValidateMappingResult {
  operation: 'validate_mapping';
  verified: boolean;
  driftDetected: boolean;
  driftReasons: string[];
  workflow: N8nWorkflowSummary | null;
  error: string | null;
}

export interface N8nPreviewGate {
  key: string;
  label: string;
  state: 'pass' | 'block' | 'not_required' | 'not_ready';
  note: string;
}

export interface N8nDispatchPreviewResult {
  operation: 'dispatch_preview';
  decision: string;
  executionAllowed: boolean;
  workflow: {
    workflowKey: string;
    name: string | null;
    executionMode: string;
    mappingVerified: boolean;
    n8nState: string;
  };
  requestType: string | null;
  siteKey: string | null;
  agentKey: string | null;
  orchestrationKey: string | null;
  riskLevel: string | null;
  approvalRequired: boolean;
  gates: N8nPreviewGate[];
  reasons: string[];
  blockedReasons: string[];
  evaluatedAt: string;
  message: string;
}

export interface N8nDispatchPreviewPayload {
  workflow_key: string;
  request_type?: string;
  site_key?: string;
  agent_key?: string;
  orchestration_key?: string;
  risk_level?: 'green' | 'amber' | 'red';
}

// --- Data access --------------------------------------------------------------

function sanitiseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string }).message ?? '';
    if (/row-level security|permission denied|not authorized|not authorised|policy/i.test(msg)) {
      return 'You do not have permission to read the n8n workflow registry.';
    }
    if (/network|fetch|failed to fetch/i.test(msg)) {
      return 'Unable to reach the n8n connector.';
    }
  }
  return 'Unable to load n8n connector data.';
}

async function runQuery<T>(builder: Promise<{ data: T | null; error: unknown }>): Promise<AiOpsResult<T>> {
  try {
    const { data, error } = await builder;
    if (error) return { data: null, error: sanitiseError(error) };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

export function getAiN8nWorkflowRegistry(): Promise<AiOpsResult<AiN8nWorkflowRegistryRow[]>> {
  return runQuery<AiN8nWorkflowRegistryRow[]>(
    supabase.from('ai_n8n_workflow_registry').select('*').order('workflow_key', { ascending: true }),
  );
}

// --- Connector invoke (read-only allowlisted operations) -----------------------

async function invokeConnector<T>(operation: string, body: Record<string, unknown>): Promise<AiOpsResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke<T>('n8n-runtime-connector', {
      body: { operation, ...body },
    });
    if (error) {
      const context = (error as { context?: { message?: string; error?: string } }).context;
      const msg = context?.error ?? context?.message ?? error.message;
      return { data: null, error: sanitiseError({ message: msg ?? '' }) };
    }
    if (!data) return { data: null, error: 'The n8n connector returned no result.' };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: sanitiseError(err) };
  }
}

export function getN8nConnectorStatus(): Promise<AiOpsResult<N8nConnectorStatus>> {
  return invokeConnector<N8nConnectorStatus>('status', {});
}

export function listN8nWorkflows(): Promise<AiOpsResult<N8nListWorkflowsResult>> {
  return invokeConnector<N8nListWorkflowsResult>('list_workflows', {});
}

export function inspectN8nWorkflow(n8nWorkflowId: string): Promise<AiOpsResult<N8nInspectWorkflowResult>> {
  return invokeConnector<N8nInspectWorkflowResult>('inspect_workflow', { n8n_workflow_id: n8nWorkflowId });
}

export function validateN8nMapping(workflowKey: string): Promise<AiOpsResult<N8nValidateMappingResult>> {
  return invokeConnector<N8nValidateMappingResult>('validate_mapping', { workflow_key: workflowKey });
}

export function previewN8nDispatch(payload: N8nDispatchPreviewPayload): Promise<AiOpsResult<N8nDispatchPreviewResult>> {
  return invokeConnector<N8nDispatchPreviewResult>('dispatch_preview', payload);
}

// --- Selectors -----------------------------------------------------------------

export interface N8nConnectorSummary {
  /** Whether the connector infrastructure + registry are provisioned/readable. */
  ready: boolean;
  /** Always disabled/dry-run in this phase — execution never enabled. */
  dispatchMode: 'disabled' | 'dry_run';
  approvedWorkflows: number;
  verifiedMappings: number;
  mappingsNeedingReview: number;
}

export function deriveN8nSummary(registry: AiN8nWorkflowRegistryRow[]): N8nConnectorSummary {
  const approved = registry.filter((r) => r.is_active === true).length;
  const verified = registry.filter((r) => r.runtime_status === 'verified').length;
  const review = registry.filter((r) => r.runtime_status === 'review_required').length;
  const anyExecution = registry.some((r) => r.execution_mode === 'future_pilot');
  return {
    ready: true,
    dispatchMode: anyExecution ? 'dry_run' : 'disabled',
    approvedWorkflows: approved,
    verifiedMappings: verified,
    mappingsNeedingReview: review,
  };
}