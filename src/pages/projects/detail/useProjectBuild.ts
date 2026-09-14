import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ProjectBuildRun, ProjectBuildItem } from './buildUtils';

export interface ProjectBuildData {
  runs: ProjectBuildRun[];
  itemsByRun: Record<number, ProjectBuildItem[]>;
  activeRun: ProjectBuildRun | null;
  loading: boolean;
  error: string;
  refresh: () => void;
}

export function useProjectBuild(projectId: number | null | undefined): ProjectBuildData {
  const [runs, setRuns] = useState<ProjectBuildRun[]>([]);
  const [itemsByRun, setItemsByRun] = useState<Record<number, ProjectBuildItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!projectId) {
      setRuns([]);
      setItemsByRun({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data: runsData, error: runsErr } = await supabase
        .from('internal_build_process_runs')
        .select('*')
        .eq('project_id', projectId);

      if (runsErr) throw runsErr;

      const runsList = (runsData ?? []) as ProjectBuildRun[];
      const sorted = [...runsList].sort((a, b) => {
        if (a.run_status === 'active' && b.run_status !== 'active') return -1;
        if (b.run_status === 'active' && a.run_status !== 'active') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setRuns(sorted);

      if (sorted.length > 0) {
        const runIds = sorted.map((r) => r.id);
        const { data: itemsData, error: itemsErr } = await supabase
          .from('internal_build_process_run_items')
          .select('*')
          .in('run_id', runIds)
          .order('item_order');

        if (itemsErr) throw itemsErr;

        const map: Record<number, ProjectBuildItem[]> = {};
        (itemsData ?? []).forEach((it) => {
          const item = it as ProjectBuildItem;
          if (!map[item.run_id]) map[item.run_id] = [];
          map[item.run_id].push(item);
        });
        setItemsByRun(map);
      }
    } catch (err: any) {
      setError(err.message || 'Build data unavailable.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const activeRun = runs.find((r) => r.run_status === 'active') ?? null;

  return { runs, itemsByRun, activeRun, loading, error, refresh: load };
}