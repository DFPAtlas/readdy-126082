import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { UatSession, SESSION_STATUS_COLORS } from '../types';

export default function ImageManagerTab() {
  const [sessions, setSessions] = useState<UatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setError('');
      const { data, error: err } = await supabase.from('uat_sessions').select('*').order('created_at', { ascending: false }).limit(30);
      if (err) throw err;

      const projectIds = [...new Set((data || []).map((s: Record<string, unknown>) => s.project_id).filter(Boolean))];
      const testerIds = [...new Set((data || []).map((s: Record<string, unknown>) => s.tester_id))];
      const [{ data: projects }, { data: testers }] = await Promise.all([
        projectIds.length > 0 ? supabase.from('uat_projects').select('id,name').in('id', projectIds as string[]) : Promise.resolve({ data: [] }),
        testerIds.length > 0 ? supabase.from('uat_testers').select('id,display_name,full_name').in('id', testerIds) : Promise.resolve({ data: [] }),
      ]);

      const projMap = Object.fromEntries((projects || []).map((p: Record<string, unknown>) => [p.id, p.name]));
      const testerMap = Object.fromEntries((testers || []).map((t: Record<string, unknown>) => [t.id, t.display_name || t.full_name]));

      setSessions((data || []).map((s: Record<string, unknown>) => ({
        ...s,
        project_name: projMap[s.project_id as string] || '',
        tester_name: testerMap[s.tester_id as string] || 'Unknown',
      })) as UatSession[]);
    } catch {
      setError('Failed to load sessions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (loading) return <div className="text-sm text-foreground-400 py-8">Loading sessions...</div>;
  if (error) return <div className="text-sm text-red-400 py-8">{error}</div>;

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <i className="ri-timer-line text-3xl text-foreground-500 w-8 h-8 flex items-center justify-center mx-auto mb-3"></i>
        <p className="text-sm text-foreground-500">No testing sessions recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {sessions.map((s) => (
        <div key={s.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.status === 'in_progress' ? 'bg-emerald-500/10' : 'bg-background-200/40'}`}>
              <i className={`${s.status === 'in_progress' ? 'ri-play-circle-fill text-emerald-400' : 'ri-checkbox-circle-fill text-foreground-400'} w-5 h-5 flex items-center justify-center`}></i>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground-50">{s.tester_name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${SESSION_STATUS_COLORS[s.status] || 'bg-foreground-500/10 text-foreground-500'}`}>{s.status.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-foreground-500 mt-0.5">
                {s.project_name && <span>{s.project_name}</span>}
                {s.device_used && <><span>•</span><span>{s.device_used}</span></>}
                {s.browser_used && <><span>•</span><span>{s.browser_used}</span></>}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-medium text-foreground-200">{formatDuration(s.active_seconds)}</p>
            <p className="text-[10px] text-foreground-500">{new Date(s.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}