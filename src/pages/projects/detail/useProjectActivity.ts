// ============================================================================
// DFP COMMAND 11 — PROJECT-SCOPED ACTIVITY STREAM
// ============================================================================
// Loads the canonical internal_activity_log for the selected project. The
// project relationship is matched both ways the existing system writes it:
//   - entity_type = 'project' AND entity_id = internal_projects.id (current
//     writes from the Command Centre / workstream hooks)
//   - project_id = internal_projects.id (legacy / global activity-log writes)
// A failed query surfaces as an error ("unavailable"), never a silent empty
// list — that distinction matters to avoid showing "0 events".
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ActivityEntry } from './types';

export interface ProjectActivityData {
  entries: ActivityEntry[];
  loading: boolean;
  error: string | null;
  configured: boolean;
  refresh: () => void;
}

const SELECT = 'id,user_id,action,entity_type,entity_id,project_id,description,created_at';

export function useProjectActivity(projectId: number | undefined): ProjectActivityData {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const configured = Boolean(
    import.meta.env.VITE_PUBLIC_SUPABASE_URL && import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
  );

  const load = useCallback(async () => {
    if (!projectId) {
      setEntries([]);
      setLoading(false);
      setError(null);
      return;
    }
    if (!configured) {
      setError('Activity data unavailable — backend is not connected.');
      setLoading(false);
      return;
    }
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('internal_activity_log')
        .select(SELECT)
        .or(`project_id.eq.${projectId},and(entity_type.eq.project,entity_id.eq.${projectId})`)
        .order('created_at', { ascending: false })
        .limit(200);

      if (id !== requestIdRef.current) return;
      if (dbError) throw dbError;
      setEntries((data ?? []) as ActivityEntry[]);
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Activity could not be loaded.');
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [projectId, configured]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { entries, loading, error, configured, refresh };
}