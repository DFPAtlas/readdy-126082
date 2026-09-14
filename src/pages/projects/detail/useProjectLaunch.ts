// ============================================================================
// DFP COMMAND 12 — PROJECT LAUNCH APPROVALS — DATA HOOK
// ============================================================================
// Reads/writes internal_project_launch_approvals for the selected project and
// records significant launch events into internal_activity_log. Approval is a
// deliberate, human/authorised action — passing gates NEVER writes an approval
// here. "APPROVED" is not "deployed".
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { LaunchApproval, ApprovalDecision, LaunchSnapshot } from './launchTypes';

const SELECT =
  'id,project_id,decision,requested_at,requested_by,decided_at,decided_by,decision_notes,evaluation_snapshot,github_sha,last_known_good_sha,created_at';

export interface ProjectLaunchData {
  approvals: LaunchApproval[];
  latest: LaunchApproval | null;
  loading: boolean;
  error: string | null;
  configured: boolean;
  saving: boolean;
  refresh: () => void;
  requestApproval: (snapshot: LaunchSnapshot, githubSha: string | null) => Promise<string | null>;
  decide: (approvalId: string, decision: 'APPROVED' | 'REJECTED', notes: string) => Promise<string | null>;
}

export function useProjectLaunch(projectId: number | undefined, projectName: string | null | undefined): ProjectLaunchData {
  const [approvals, setApprovals] = useState<LaunchApproval[]>([]);
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
      setApprovals([]);
      setLoading(false);
      setError(null);
      return;
    }
    if (!configured) {
      setError('Launch approvals unavailable — backend is not connected.');
      setLoading(false);
      return;
    }
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('internal_project_launch_approvals')
        .select(SELECT)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (id !== requestIdRef.current) return;
      if (dbError) throw dbError;
      const rows = (data ?? []) as LaunchApproval[];
      setApprovals(rows);
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Launch approvals could not be loaded.');
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [projectId, configured]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const requestApproval = useCallback(
    async (snapshot: LaunchSnapshot, githubSha: string | null): Promise<string | null> => {
      if (!projectId) return 'Project is not available.';
      setSaving(true);
      try {
        const { error: e } = await supabase.from('internal_project_launch_approvals').insert({
          project_id: projectId,
          decision: 'PENDING',
          requested_at: new Date().toISOString(),
          evaluation_snapshot: snapshot as unknown as Record<string, unknown>,
          github_sha: githubSha,
          last_known_good_sha: snapshot.lastKnownGoodSha,
        });
        if (e) throw e;
        await logActivity('Launch approval requested');
        await load();
        return null;
      } catch (err: unknown) {
        return err instanceof Error ? err.message : 'Failed to request launch approval.';
      } finally {
        setSaving(false);
      }
    },
    [projectId, load, logActivity],
  );

  const decide = useCallback(
    async (approvalId: string, decision: 'APPROVED' | 'REJECTED', notes: string): Promise<string | null> => {
      setSaving(true);
      try {
        const { error: e } = await supabase
          .from('internal_project_launch_approvals')
          .update({
            decision,
            decided_at: new Date().toISOString(),
            decision_notes: notes || null,
          })
          .eq('id', approvalId);
        if (e) throw e;
        await logActivity(decision === 'APPROVED' ? 'Launch approval granted' : 'Launch approval rejected');
        await load();
        return null;
      } catch (err: unknown) {
        return err instanceof Error ? err.message : 'Failed to record the launch decision.';
      } finally {
        setSaving(false);
      }
    },
    [load, logActivity],
  );

  // Most recent non-superseded approval is the operative one.
  const latest = approvals.find((a) => a.decision !== 'SUPERSEDED') ?? null;

  return {
    approvals,
    latest,
    loading,
    error,
    configured,
    saving,
    refresh,
    requestApproval,
    decide,
  };
}

export type { ApprovalDecision };