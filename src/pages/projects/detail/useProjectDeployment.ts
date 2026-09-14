// ============================================================================
// DFP COMMAND 13A/13B/13C/18F — PROJECT DEPLOYMENT CONTROL — DATA HOOK
// ============================================================================
// Reads internal_project_deployments and drives the deployment lifecycle.
//
// Command 18F: all lifecycle mutations now flow through protected SECURITY
// DEFINER RPCs (deployment_start / _complete / _fail / _start_verification /
// _complete_verification / _accept / _start_rollback / _enter_rollback_sha /
// _complete_rollback). The server enforces the state machine, the authoritative
// SHA, acceptance and the atomic live transition — this hook only presents
// confirmations and surfaces the server's decision. It never performs direct
// INSERT/UPDATE on the deployment ledger (those are neutralised at RLS).
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Project } from './types';
import type { ProjectDeployment } from './deploymentTypes';
import { isActiveDeploymentStatus } from './deploymentTypes';
import type { VerificationSnapshot } from './verificationTypes';

const SELECT =
  'id,project_id,launch_approval_id,environment,status,github_sha,deployed_sha,previous_production_sha,last_known_good_sha,deployment_method,provider,production_url,started_at,started_by,completed_at,verifying_at,verified_at,verified_by,verification_snapshot,accepted_at,accepted_by,acceptance_notes,production_accepted,rollback_of_deployment_id,rollback_sha,rollback_reason,rolled_back_at,failed_at,failure_reason,notes,created_at,updated_at';

export interface StartDeploymentInput {
  launchApprovalId: string;
  // Current authoritative repository SHA. The server fails closed when this is
  // null/unavailable and rejects drift when it differs from the approved SHA.
  headSha: string | null;
  lastKnownGoodSha: string | null;
  productionUrl: string | null;
  deploymentMethod: string;
  provider: string | null;
}

export interface StartRollbackInput {
  // The failed deployment being rolled back. The rollback target SHA is derived
  // server-side from trusted history — never supplied by the client.
  ofDeploymentId: string;
  reason: string;
}

export interface ProjectDeploymentData {
  deployments: ProjectDeployment[];
  active: ProjectDeployment | null;
  loading: boolean;
  error: string | null;
  configured: boolean;
  saving: boolean;
  refresh: () => void;
  startDeployment: (input: StartDeploymentInput) => Promise<string | null>;
  markCompleted: (
    deploymentId: string,
    deployedSha: string,
    notes: string,
    providerRef?: string,
  ) => Promise<string | null>;
  markFailed: (deploymentId: string, reason: string, activityAction?: string) => Promise<string | null>;
  startVerification: (deploymentId: string) => Promise<string | null>;
  markVerified: (deploymentId: string, snapshot: VerificationSnapshot) => Promise<string | null>;
  acceptProduction: (deploymentId: string, notes: string) => Promise<string | null>;
  startRollback: (input: StartRollbackInput) => Promise<string | null>;
  enterRollbackDeployedSha: (deploymentId: string, sha: string) => Promise<string | null>;
  markRolledBack: (deploymentId: string, snapshot: VerificationSnapshot) => Promise<string | null>;
}

export function useProjectDeployment(
  projectId: number | undefined,
  _projectName: string | null | undefined,
  _project: Project | null | undefined,
  onProjectChanged?: () => void,
): ProjectDeploymentData {
  const [deployments, setDeployments] = useState<ProjectDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const configured = Boolean(
    import.meta.env.VITE_PUBLIC_SUPABASE_URL && import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
  );

  const load = useCallback(async () => {
    if (!projectId) {
      setDeployments([]);
      setLoading(false);
      setError(null);
      return;
    }
    if (!configured) {
      setError('Deployment data unavailable — backend is not connected.');
      setLoading(false);
      return;
    }
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('internal_project_deployments')
        .select(SELECT)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (id !== requestIdRef.current) return;
      if (dbError) throw dbError;
      setDeployments((data ?? []) as ProjectDeployment[]);
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Deployments could not be loaded.');
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [projectId, configured]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  // Invoke a protected deployment RPC and surface the server's deterministic
  // error code (e.g. SHA_DRIFT, DEPLOYMENT_ALREADY_ACTIVE, VERIFICATION_FAILED).
  const callRpc = useCallback(
    async (fn: string, args: Record<string, unknown>): Promise<string | null> => {
      const { error: rpcError } = await supabase.rpc(fn, args);
      if (rpcError) return rpcError.message;
      return null;
    },
    [],
  );

  const startDeployment = useCallback(
    async (input: StartDeploymentInput): Promise<string | null> => {
      if (!projectId) return 'Project is not available.';
      setSaving(true);
      try {
        const err = await callRpc('deployment_start', {
          p_project_id: projectId,
          p_launch_approval_id: input.launchApprovalId,
          p_head_sha: input.headSha,
          p_last_known_good_sha: input.lastKnownGoodSha,
          p_production_url: input.productionUrl,
          p_deployment_method: input.deploymentMethod,
          p_provider: input.provider,
        });
        if (err) return err;
        await load();
        return null;
      } catch (e: unknown) {
        return e instanceof Error ? e.message : 'Failed to start deployment.';
      } finally {
        setSaving(false);
      }
    },
    [projectId, callRpc, load],
  );

  const markCompleted = useCallback(
    async (
      deploymentId: string,
      deployedSha: string,
      notes: string,
      providerRef?: string,
    ): Promise<string | null> => {
      setSaving(true);
      try {
        const err = await callRpc('deployment_complete', {
          p_deployment_id: deploymentId,
          p_deployed_sha: deployedSha.trim(),
          p_notes: notes || null,
          p_provider: providerRef?.trim() || null,
        });
        if (err) return err;
        await load();
        return null;
      } catch (e: unknown) {
        return e instanceof Error ? e.message : 'Failed to mark deployment completed.';
      } finally {
        setSaving(false);
      }
    },
    [callRpc, load],
  );

  const markFailed = useCallback(
    async (deploymentId: string, reason: string, _activityAction = 'Deployment failed'): Promise<string | null> => {
      setSaving(true);
      try {
        const err = await callRpc('deployment_fail', {
          p_deployment_id: deploymentId,
          p_reason: reason || null,
        });
        if (err) return err;
        await load();
        return null;
      } catch (e: unknown) {
        return e instanceof Error ? e.message : 'Failed to mark deployment as failed.';
      } finally {
        setSaving(false);
      }
    },
    [callRpc, load],
  );

  const startVerification = useCallback(
    async (deploymentId: string): Promise<string | null> => {
      setSaving(true);
      try {
        const err = await callRpc('deployment_start_verification', { p_deployment_id: deploymentId });
        if (err) return err;
        await load();
        return null;
      } catch (e: unknown) {
        return e instanceof Error ? e.message : 'Failed to start verification.';
      } finally {
        setSaving(false);
      }
    },
    [callRpc, load],
  );

  const markVerified = useCallback(
    async (deploymentId: string, snapshot: VerificationSnapshot): Promise<string | null> => {
      setSaving(true);
      try {
        const err = await callRpc('deployment_complete_verification', {
          p_deployment_id: deploymentId,
          p_snapshot: snapshot as unknown as Record<string, unknown>,
        });
        if (err) return err;
        await load();
        return null;
      } catch (e: unknown) {
        return e instanceof Error ? e.message : 'Failed to verify deployment.';
      } finally {
        setSaving(false);
      }
    },
    [callRpc, load],
  );

  // ── Command 13C/18F: Production acceptance (atomic live transition) ──────
  const acceptProduction = useCallback(
    async (deploymentId: string, notes: string): Promise<string | null> => {
      setSaving(true);
      try {
        const err = await callRpc('deployment_accept', {
          p_deployment_id: deploymentId,
          p_notes: notes || null,
        });
        if (err) return err;
        // The server atomically flips an un-launched project to live. Refresh the
        // parent project so its status reflects the server-side transition.
        onProjectChanged?.();
        await load();
        return null;
      } catch (e: unknown) {
        return e instanceof Error ? e.message : 'Failed to accept production deployment.';
      } finally {
        setSaving(false);
      }
    },
    [callRpc, load, onProjectChanged],
  );

  // ── Command 13C/18F: Rollback (target derived server-side) ───────────────
  const startRollback = useCallback(
    async (input: StartRollbackInput): Promise<string | null> => {
      setSaving(true);
      try {
        const err = await callRpc('deployment_start_rollback', {
          p_failed_deployment_id: input.ofDeploymentId,
          p_reason: input.reason,
        });
        if (err) return err;
        await load();
        return null;
      } catch (e: unknown) {
        return e instanceof Error ? e.message : 'Failed to start rollback.';
      } finally {
        setSaving(false);
      }
    },
    [callRpc, load],
  );

  const enterRollbackDeployedSha = useCallback(
    async (deploymentId: string, sha: string): Promise<string | null> => {
      setSaving(true);
      try {
        const err = await callRpc('deployment_enter_rollback_sha', {
          p_deployment_id: deploymentId,
          p_deployed_sha: sha.trim(),
        });
        if (err) return err;
        await load();
        return null;
      } catch (e: unknown) {
        return e instanceof Error ? e.message : 'Failed to record rollback SHA.';
      } finally {
        setSaving(false);
      }
    },
    [callRpc, load],
  );

  const markRolledBack = useCallback(
    async (deploymentId: string, snapshot: VerificationSnapshot): Promise<string | null> => {
      setSaving(true);
      try {
        const err = await callRpc('deployment_complete_rollback', {
          p_deployment_id: deploymentId,
          p_snapshot: snapshot as unknown as Record<string, unknown>,
        });
        if (err) return err;
        await load();
        return null;
      } catch (e: unknown) {
        return e instanceof Error ? e.message : 'Failed to complete rollback.';
      } finally {
        setSaving(false);
      }
    },
    [callRpc, load],
  );

  const active = deployments.find((d) => isActiveDeploymentStatus(d.status)) ?? null;

  return {
    deployments,
    active,
    loading,
    error,
    configured,
    saving,
    refresh,
    startDeployment,
    markCompleted,
    markFailed,
    startVerification,
    markVerified,
    acceptProduction,
    startRollback,
    enterRollbackDeployedSha,
    markRolledBack,
  };
}