import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  LinkedUatProject,
  UatData,
  UatSummary,
  UatReportRow,
} from './uatTypes';
import { computeUatSummary } from './uatTypes';

const EMPTY: UatData = {
  uatProject: null,
  jobs: [],
  assignments: [],
  results: [],
  testCases: [],
  feedback: [],
  evidence: [],
  sessions: [],
  approvals: [],
  testers: [],
  reports: [],
};

export interface ProjectUatData {
  data: UatData;
  summary: UatSummary;
  loading: boolean;
  error: string;
  saving: boolean;
  refresh: () => void;
  connect: (uatProjectId: string) => Promise<string | null>;
  disconnect: (uatProjectId: string) => Promise<string | null>;
}

/**
 * Loads the selected DFP project's linked UAT project and its project-scoped
 * records. The canonical link is internal_projects.id -> uat_projects.internal_project_id.
 * Loads sections independently-ish so a single failed sub-query (e.g. reports)
 * never blanks the whole page.
 */
export function useProjectUat(
  projectId: number | null | undefined,
  projectName: string | null | undefined,
): ProjectUatData {
  const [data, setData] = useState<UatData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const dataRef = useRef<UatData>(EMPTY);

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
      dataRef.current = EMPTY;
      setData(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: linked, error: linkedErr } = await supabase
        .from('uat_projects')
        .select('*')
        .eq('internal_project_id', projectId)
        .maybeSingle();
      if (linkedErr) throw linkedErr;

      const uatProject = (linked as LinkedUatProject) ?? null;
      if (!uatProject) {
        dataRef.current = EMPTY;
        setData(EMPTY);
        return;
      }

      const projId = uatProject.id;

      const [jobsRes, approvalsRes, feedbackRes, evidenceRes, sessionsRes, testCasesRes] = await Promise.all([
        supabase.from('uat_jobs').select('*').eq('project_id', projId).order('created_at', { ascending: false }),
        supabase.from('uat_approvals').select('*').eq('project_id', projId).order('created_at', { ascending: false }),
        supabase.from('uat_feedback').select('*').eq('project_id', projId).order('created_at', { ascending: false }),
        supabase.from('uat_evidence').select('*').eq('project_id', projId).order('created_at', { ascending: false }),
        supabase.from('uat_sessions').select('*').eq('project_id', projId).order('created_at', { ascending: false }),
        supabase.from('uat_test_cases').select('*').eq('project_id', projId).order('sort_order', { ascending: true }),
      ]);

      const jobs = (jobsRes.data ?? []) as UatData['jobs'];
      const jobIds = jobs.map((j) => j.id);

      const { data: assignments } = jobIds.length
        ? await supabase.from('uat_assignments').select('*').in('job_id', jobIds)
        : { data: [] };
      const assignmentRows = (assignments ?? []) as UatData['assignments'];
      const assignmentIds = assignmentRows.map((a) => a.id);

      const { data: results } = assignmentIds.length
        ? await supabase
            .from('uat_test_case_results')
            .select('*')
            .in('assignment_id', assignmentIds)
            .order('created_at', { ascending: false })
        : { data: [] };

      const testerIds = Array.from(
        new Set(
          [
            ...((results ?? []) as UatData['results']).map((r) => r.tester_id),
            ...((feedbackRes.data ?? []) as UatData['feedback']).map((f) => f.tester_id),
            ...((sessionsRes.data ?? []) as UatData['sessions']).map((s) => s.tester_id),
          ].filter(Boolean),
        ),
      ) as string[];

      const { data: testers } = testerIds.length
        ? await supabase.from('uat_testers').select('id,full_name').in('id', testerIds)
        : { data: [] };

      // Reports are loaded defensively: the uat_reports schema is not fully
      // typed and may not exist in every environment. Never block the page on it.
      let reports: UatReportRow[] = [];
      try {
        const { data: r, error: rErr } = await supabase.from('uat_reports').select('*');
        if (!rErr && Array.isArray(r)) {
          reports = (r as UatReportRow[]).filter((x) => x.project_id == null || x.project_id === projId);
        }
      } catch {
        reports = [];
      }

      const next: UatData = {
        uatProject,
        jobs,
        assignments: assignmentRows,
        results: (results ?? []) as UatData['results'],
        testCases: (testCasesRes.data ?? []) as UatData['testCases'],
        feedback: (feedbackRes.data ?? []) as UatData['feedback'],
        evidence: (evidenceRes.data ?? []) as UatData['evidence'],
        sessions: (sessionsRes.data ?? []) as UatData['sessions'],
        approvals: (approvalsRes.data ?? []) as UatData['approvals'],
        testers: (testers ?? []) as UatData['testers'],
        reports,
      };
      dataRef.current = next;
      setData(next);
    } catch (err: any) {
      setError(err?.message || 'UAT data unavailable.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const connect = useCallback(
    async (uatProjectId: string): Promise<string | null> => {
      if (!projectId) return 'Project is not available.';
      setSaving(true);
      try {
        const { error: uErr } = await supabase
          .from('uat_projects')
          .update({ internal_project_id: projectId })
          .eq('id', uatProjectId);
        if (uErr) throw uErr;
        await logActivity('UAT project connected');
        await load();
        return null;
      } catch (err: any) {
        return err?.message || 'Failed to connect UAT project.';
      } finally {
        setSaving(false);
      }
    },
    [projectId, logActivity, load],
  );

  const disconnect = useCallback(
    async (uatProjectId: string): Promise<string | null> => {
      setSaving(true);
      try {
        const { error: uErr } = await supabase
          .from('uat_projects')
          .update({ internal_project_id: null })
          .eq('id', uatProjectId);
        if (uErr) throw uErr;
        await logActivity('UAT project disconnected');
        await load();
        return null;
      } catch (err: any) {
        return err?.message || 'Failed to disconnect UAT project.';
      } finally {
        setSaving(false);
      }
    },
    [logActivity, load],
  );

  const summary = computeUatSummary(data);

  return { data, summary, loading, error, saving, refresh: load, connect, disconnect };
}