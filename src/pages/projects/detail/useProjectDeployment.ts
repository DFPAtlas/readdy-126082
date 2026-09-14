// ============================================================================
// DFP COMMAND 13A/13B/13C — PROJECT DEPLOYMENT CONTROL — DATA HOOK
// ============================================================================
// Reads/writes internal_project_deployments for the selected project and
// records significant deployment events into internal_activity_log.
//
// Safety: this hook ONLY creates and tracks deployment records through a
// manual, audited flow. It never deploys, never pushes, never touches DNS,
// and never marks a deployment VERIFIED without an explicit operator action.
// Command 13C adds: production acceptance (which may flip an un-launched
// project to Live) and a safe rollback flow (redeploy of a known-good SHA —
// never a Git history rewrite, never overwriting the failed record).
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Project } from './types';
import type { ProjectDeployment } from './deploymentTypes';
import { isActiveDeploymentStatus, blocksNewDeployment } from './deploymentTypes';
import type { VerificationSnapshot } from './verificationTypes';

const SELECT =
  'id,project_id,launch_approval_id,environment,status,github_sha,deployed_sha,previous_production_sha,last_known_good_sha,deployment_method,provider,production_url,started_at,started_by,completed_at,verifying_at,verified_at,verified_by,verification_snapshot,accepted_at,accepted_by,acceptance_notes,production_accepted,rollback_of_deployment_id,rollback_sha,rollback_reason,rolled_back_at,failed_at,failure_reason,notes,created_at,updated_at';

export interface StartDeploymentInput {
  launchApprovalId: string;
  lastKnownGoodSha: string | null;
  productionUrl: string | null;
  deploymentMethod: string;
  provider: string | null;
}

export interface StartRollbackInput {
  ofDeploymentId: string;
  launchApprovalId: string;
  rollbackSha: string;
  failedSha: string | null;
  reason: string;
  productionUrl: string | null;
  deploymentMethod: string;
  lastKnownGoodSha: string | null;
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
  markVerified: (deploymentId: string) => Promise<string | null>;
  acceptProduction: (deploymentId: string, notes: string) => Promise<string | null>;
  startRollback: (input: StartRollbackInput) => Promise<string | null>;
  enterRollbackDeployedSha: (deploymentId: string, sha: string) => Promise<string | null>;
  markRolledBack: (deploymentId: string, snapshot: VerificationSnapshot) => Promise<string | null>;
}

export function useProjectDeployment(
  projectId: number | undefined,
  projectName: string | null | undefined,
  project: Project | null | undefined,
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

  const logActivity = useCallback(
    async (action: string) => {
      if (!projectId) return;
      try {
        await supabase.from('internal_activity_log').insert({
          entity_type: 'project',
          entity_id: projectId,
          action,
          description: `${action}: ${projectName ?? 'project'}`,
        });
      } catch {
        // non-critical
      }
    },
    [projectId, projectName],
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

  const startDeployment = useCallback(
    async (input: StartDeploymentInput): Promise<string | null> => {
      if (!projectId) return 'Project is not available.';
      setSaving(true);
      try {
        // The current GitHub HEAD is resolved server-side by the deployment-start
        // Edge Function — the browser sends intent only, never a SHA claim.
        const { data, error: fnErr } = await supabase.functions.invoke('deployment-start', {
          body: {
            projectId,
            launchApprovalId: input.launchApprovalId,
            lastKnownGoodSha: input.lastKnownGoodSha,
            productionUrl: input.productionUrl,
            deploymentMethod: input.deploymentMethod,
            provider: input.provider,
          },
        });
        if (fnErr) return fnErr.message || 'Failed to start deployment.';
        const code = data?.code;
        if (code && code !== 'OK') return data?.message || code;

        await logActivity('Deployment workflow started');
        await load();
        return null;
      } catch (err: unknown) {
        return err instanceof Error ? err.message : 'Failed to start deployment.';
      } finally {
        setSaving(false);
      }
    },
    [projectId, load, logActivity],
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
        const { data, error: fetchErr } = await supabase
          .from('internal_project_deployments')
          .select('github_sha')
          .eq('id', deploymentId)
          .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!data) return 'Deployment record not found.';
        if ((data.github_sha as string) !== deployedSha.trim()) {
          return 'Deployed SHA does not match the approved SHA.';
        }

        const { error: e } = await supabase
          .from('internal_project_deployments')
          .update({
            status: 'DEPLOYED',
            deployed_sha: deployedSha.trim(),
            completed_at: new Date().toISOString(),
            notes: notes || null,
            provider: providerRef?.trim() || null,
          })
          .eq('id', deploymentId);
        if (e) throw e;

        await logActivity('Deployment marked completed');
        await load();
        return null;
      } catch (err: unknown) {
        return err instanceof Error ? err.message : 'Failed to mark deployment completed.';
      } finally {
        setSaving(false);
      }
    },
    [load, logActivity],
  );

  const markFailed = useCallback(
    async (deploymentId: string, reason: string, activityAction = 'Deployment failed'): Promise<string | null> => {
      setSaving(true);
      try {
        const { error: e } = await supabase
          .from('internal_project_deployments')
          .update({
            status: 'FAILED',
            failed_at: new Date().toISOString(),
            failure_reason: reason || null,
          })
          .eq('id', deploymentId);
        if (e) throw e;

        await logActivity(activityAction);
        await load();
        return null;
      } catch (err: unknown) {
        return err instanceof Error ? err.message : 'Failed to mark deployment as failed.';
      } finally {
        setSaving(false);
      }
    },
    [load, logActivity],
  );

  const startVerification = useCallback(
    async (deploymentId: string): Promise<string | null> => {
      setSaving(true);
      try {
        const { data, error: fetchErr } = await supabase
          .from('internal_project_deployments')
          .select('status')
          .eq('id', deploymentId)
          .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!data) return 'Deployment record not found.';
        if (data.status !== 'DEPLOYED') return 'Verification can only start from a Deployed deployment.';

        const { error: e } = await supabase
          .from('internal_project_deployments')
          .update({ status: 'VERIFYING', verifying_at: new Date().toISOString() })
          .eq('id', deploymentId);
        if (e) throw e;

        await logActivity('Production verification started');
        await load();
        return null;
      } catch (err: unknown) {
        return err instanceof Error ? err.message : 'Failed to start verification.';
      } finally {
        setSaving(false);
      }
    },
    [load, logActivity],
  );

  const markVerified = useCallback(
    async (deploymentId: string): Promise<string | null> => {
      setSaving(true);
      try {
        // Production verification is performed server-side by the deployment-verify
        // Edge Function — the client never submits a PASS snapshot. The engine
        // independently resolves all mandatory checks from authoritative telemetry.
        const { data, error: fnErr } = await supabase.functions.invoke('deployment-verify', {
          body: { deploymentId },
        });
        if (fnErr) return fnErr.message || 'Failed to verify deployment.';
        const code = data?.code;
        if (code && code !== 'OK') return data?.message || code;

        await logActivity('Deployment verified');
        await load();
        return null;
      } catch (err: unknown) {
        return err instanceof Error ? err.message : 'Failed to verify deployment.';
      } finally {
        setSaving(false);
      }
    },
    [load, logActivity],
  );

  // ── Command 13C: Production acceptance ──────────────────────────────────
  const acceptProduction = useCallback(
    async (deploymentId: string, notes: string): Promise<string | null> => {
      setSaving(true);
      try {
        // Acceptance is a deliberate owner/admin action gated by the deployment_accept
        // RPC, which requires an authoritative server-generated verification snapshot.
        const { error } = await supabase.rpc('deployment_accept', {
          p_deployment_id: deploymentId,
          p_notes: notes || null,
        });
        if (error) {
          const msg = String(error?.message ?? '');
          if (msg.includes('VERIFICATION_REQUIRED')) {
            return 'Authoritative server verification is required before acceptance.';
          }
          if (msg.includes('ACCEPTANCE_NOT_ALLOWED')) {
            return 'Acceptance requires a verified, unaccepted deployment with a matching SHA.';
          }
          return msg || 'Failed to accept production deployment.';
        }

        await logActivity('Production release accepted');
        onProjectChanged?.();
        await load();
        return null;
      } catch (err: unknown) {
        return err instanceof Error ? err.message : 'Failed to accept production deployment.';
      } finally {
        setSaving(false);
      }
    },
    [load, logActivity, onProjectChanged],
  );

  // ── Command 13C: Rollback ───────────────────────────────────────────────
  const startRollback = useCallback(
    async (input: StartRollbackInput): Promise<string | null> => {
      if (!projectId) return 'Project is not available.';
      setSaving(true);
      try {
        const { data: existing } = await supabase
          .from('internal_project_deployments')
          .select('status')
          .eq('project_id', projectId)
          .eq('environment', 'production');
        const hasActive = (existing ?? []).some((d) =>
          blocksNewDeployment(d.status as ProjectDeployment['status']),
        );
        if (hasActive) return 'A production deployment or rollback is already in progress.';

        let operator: string | null = null;
        try {
          const { data: u } = await supabase.auth.getUser();
          operator = u.user?.id ?? null;
        } catch {
          operator = null;
        }

        const { error: e } = await supabase.from('internal_project_deployments').insert({
          project_id: projectId,
          launch_approval_id: input.launchApprovalId,
          environment: 'production',
          status: 'ROLLING_BACK',
          github_sha: input.rollbackSha,
          previous_production_sha: input.failedSha,
          last_known_good_sha: input.lastKnownGoodSha,
          deployment_method: input.deploymentMethod,
          production_url: input.productionUrl,
          rollback_of_deployment_id: input.ofDeploymentId,
          rollback_sha: input.rollbackSha,
          rollback_reason: input.reason,
          started_at: new Date().toISOString(),
          started_by: operator,
        });
        if (e) throw e;

        await logActivity('Rollback started');
        await load();
        return null;
      } catch (err: unknown) {
        return err instanceof Error ? err.message : 'Failed to start rollback.';
      } finally {
        setSaving(false);
      }
    },
    [projectId, load, logActivity],
  );

  const enterRollbackDeployedSha = useCallback(
    async (deploymentId: string, sha: string): Promise<string | null> => {
      setSaving(true);
      try {
        const { data, error: fetchErr } = await supabase
          .from('internal_project_deployments')
          .select('status, rollback_sha')
          .eq('id', deploymentId)
          .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!data) return 'Rollback record not found.';
        if (data.status !== 'ROLLING_BACK') return 'Rollback is not in progress.';
        const target = data.rollback_sha as string | null;
        if (!target) return 'No rollback target SHA recorded.';
        if (sha.trim() !== target) return 'Deployed SHA does not match the rollback target SHA.';

        const { error: e } = await supabase
          .from('internal_project_deployments')
          .update({ deployed_sha: sha.trim() })
          .eq('id', deploymentId);
        if (e) throw e;

        await logActivity('Rollback deployed');
        await load();
        return null;
      } catch (err: unknown) {
        return err instanceof Error ? err.message : 'Failed to record rollback SHA.';
      } finally {
        setSaving(false);
      }
    },
    [load, logActivity],
  );

  const markRolledBack = useCallback(
    async (deploymentId: string, snapshot: VerificationSnapshot): Promise<string | null> => {
      setSaving(true);
      try {
        const { data, error: fetchErr } = await supabase
          .from('internal_project_deployments')
          .select('status, rollback_sha, deployed_sha')
          .eq('id', deploymentId)
          .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!data) return 'Rollback record not found.';
        if (data.status !== 'ROLLING_BACK') return 'Rollback is not in progress.';
        if (!data.deployed_sha || !data.rollback_sha || data.deployed_sha !== data.rollback_sha) {
          return 'Rollback can only complete when the deployed SHA matches the rollback target.';
        }

        let operator: string | null = null;
        try {
          const { data: u } = await supabase.auth.getUser();
          operator = u.user?.id ?? null;
        } catch {
          operator = null;
        }

        const { error: e } = await supabase
          .from('internal_project_deployments')
          .update({
            status: 'ROLLED_BACK',
            rolled_back_at: new Date().toISOString(),
            verified_at: new Date().toISOString(),
            verified_by: operator,
            verification_snapshot: snapshot,
          })
          .eq('id', deploymentId);
        if (e) throw e;

        await logActivity('Rollback completed');
        await load();
        return null;
      } catch (err: unknown) {
        return err instanceof Error ? err.message : 'Failed to complete rollback.';
      } finally {
        setSaving(false);
      }
    },
    [load, logActivity],
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