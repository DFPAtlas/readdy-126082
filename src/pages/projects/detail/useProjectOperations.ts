// ============================================================================
// DFP COMMAND 14B — PROJECT OPERATIONS — DATA HOOK
// ============================================================================
// Reads/writes internal_project_maintenance + internal_project_reviews for the
// selected project and records significant operations events into
// internal_activity_log.
//
// Safety: maintenance records are PLANNING / AUDIT records. This hook never
// restarts services, deploys code, changes DNS, runs migrations, executes
// agents, closes bugs, or approves changes. Review records are operator notes
// only — review actions deliberately create Bug/Change/Maintenance records
// through the existing systems, never auto-executing them.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { MaintenanceItem, ProjectReview, MaintenanceInput, ReviewInput } from './operationsTypes';

const MAINT_SELECT =
  'id,project_id,title,description,maintenance_type,status,priority,planned_start,planned_end,started_at,completed_at,owner,notes,related_bug_id,related_change_id,related_incident_id,created_at,updated_at';

const REVIEW_SELECT =
  'id,project_id,review_type,status,review_date,reviewed_by,summary,what_worked,what_failed,lessons_learned,recommended_actions,created_at,updated_at';

export interface ProjectOperationsData {
  maintenance: MaintenanceItem[];
  reviews: ProjectReview[];
  loading: boolean;
  error: string | null;
  configured: boolean;
  saving: boolean;
  refresh: () => void;
  planMaintenance: (input: MaintenanceInput) => Promise<string | null>;
  startMaintenance: (id: string) => Promise<string | null>;
  completeMaintenance: (id: string) => Promise<string | null>;
  cancelMaintenance: (id: string) => Promise<string | null>;
  createReview: (input: ReviewInput) => Promise<string | null>;
}

export function useProjectOperations(
  projectId: number | undefined,
  projectName: string | null | undefined,
): ProjectOperationsData {
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);
  const [reviews, setReviews] = useState<ProjectReview[]>([]);
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
      setMaintenance([]);
      setReviews([]);
      setLoading(false);
      setError(null);
      return;
    }
    if (!configured) {
      setError('Operations data unavailable — backend is not connected.');
      setLoading(false);
      return;
    }
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const [maintRes, reviewRes] = await Promise.all([
        supabase
          .from('internal_project_maintenance')
          .select(MAINT_SELECT)
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('internal_project_reviews')
          .select(REVIEW_SELECT)
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
      ]);

      if (id !== requestIdRef.current) return;
      if (maintRes.error) throw maintRes.error;
      if (reviewRes.error) throw reviewRes.error;

      setMaintenance((maintRes.data ?? []) as MaintenanceItem[]);
      setReviews((reviewRes.data ?? []) as ProjectReview[]);
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Operations data could not be loaded.');
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [projectId, configured]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const planMaintenance = useCallback(
    async (input: MaintenanceInput): Promise<string | null> => {
      if (!projectId) return 'Project is not available.';
      setSaving(true);
      try {
        const { error: e } = await supabase.from('internal_project_maintenance').insert({
          project_id: projectId,
          title: input.title,
          description: input.description ?? null,
          maintenance_type: input.type,
          status: 'PLANNED',
          priority: input.priority,
          planned_start: input.plannedStart ?? null,
          planned_end: input.plannedEnd ?? null,
          owner: input.owner ?? null,
          notes: input.notes ?? null,
          related_bug_id: input.relatedBugId ?? null,
          related_change_id: input.relatedChangeId ?? null,
          related_incident_id: input.relatedIncidentId ?? null,
        });
        if (e) throw e;

        await logActivity('Maintenance planned');
        await load();
        return null;
      } catch (err: unknown) {
        return err instanceof Error ? err.message : 'Failed to plan maintenance.';
      } finally {
        setSaving(false);
      }
    },
    [projectId, load, logActivity],
  );

  const startMaintenance = useCallback(
    async (id: string): Promise<string | null> => {
      setSaving(true);
      try {
        const { error: e } = await supabase
          .from('internal_project_maintenance')
          .update({ status: 'IN_PROGRESS', started_at: new Date().toISOString() })
          .eq('id', id);
        if (e) throw e;
        await logActivity('Maintenance started');
        await load();
        return null;
      } catch (err: unknown) {
        return err instanceof Error ? err.message : 'Failed to start maintenance.';
      } finally {
        setSaving(false);
      }
    },
    [load, logActivity],
  );

  const completeMaintenance = useCallback(
    async (id: string): Promise<string | null> => {
      setSaving(true);
      try {
        const { error: e } = await supabase
          .from('internal_project_maintenance')
          .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
          .eq('id', id);
        if (e) throw e;
        await logActivity('Maintenance completed');
        await load();
        return null;
      } catch (err: unknown) {
        return err instanceof Error ? err.message : 'Failed to complete maintenance.';
      } finally {
        setSaving(false);
      }
    },
    [load, logActivity],
  );

  const cancelMaintenance = useCallback(
    async (id: string): Promise<string | null> => {
      setSaving(true);
      try {
        const { error: e } = await supabase
          .from('internal_project_maintenance')
          .update({ status: 'CANCELLED' })
          .eq('id', id);
        if (e) throw e;
        await load();
        return null;
      } catch (err: unknown) {
        return err instanceof Error ? err.message : 'Failed to cancel maintenance.';
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const createReview = useCallback(
    async (input: ReviewInput): Promise<string | null> => {
      if (!projectId) return 'Project is not available.';
      setSaving(true);
      try {
        let reviewer: string | null = null;
        try {
          const { data } = await supabase.auth.getUser();
          reviewer = data.user?.id ?? null;
        } catch {
          reviewer = null;
        }

        const { error: e } = await supabase.from('internal_project_reviews').insert({
          project_id: projectId,
          review_type: input.reviewType,
          status: input.status ?? 'COMPLETED',
          review_date: input.reviewDate ?? new Date().toISOString(),
          reviewed_by: reviewer,
          summary: input.summary ?? null,
          what_worked: input.whatWorked ?? null,
          what_failed: input.whatFailed ?? null,
          lessons_learned: input.lessonsLearned ?? null,
          recommended_actions: input.recommendedActions ?? null,
        });
        if (e) throw e;

        if (input.reviewType === 'POST_LAUNCH') {
          await logActivity('Post-launch review completed');
        } else {
          await logActivity('Operational review completed');
        }
        await load();
        return null;
      } catch (err: unknown) {
        return err instanceof Error ? err.message : 'Failed to record review.';
      } finally {
        setSaving(false);
      }
    },
    [projectId, load, logActivity],
  );

  return {
    maintenance,
    reviews,
    loading,
    error,
    configured,
    saving,
    refresh,
    planMaintenance,
    startMaintenance,
    completeMaintenance,
    cancelMaintenance,
    createReview,
  };
}