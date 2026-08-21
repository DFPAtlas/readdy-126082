import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { UatFeedback, FEEDBACK_TYPE_COLORS, SEVERITY_COLORS, STATUS_COLORS } from '../types';

export default function WebsiteChangesTab() {
  const [feedback, setFeedback] = useState<UatFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'fixed'>('all');

  const loadData = useCallback(async () => {
    try {
      setError('');
      let q = supabase.from('uat_feedback').select('*').order('created_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      const { data, error: err } = await q;
      if (err) throw err;

      const projectIds = [...new Set((data || []).map((f: Record<string, unknown>) => f.project_id))];
      const testerIds = [...new Set((data || []).map((f: Record<string, unknown>) => f.tester_id))];
      const [{ data: projects }, { data: testers }] = await Promise.all([
        projectIds.length > 0 ? supabase.from('uat_projects').select('id,name').in('id', projectIds) : Promise.resolve({ data: [] }),
        testerIds.length > 0 ? supabase.from('uat_testers').select('id,display_name,full_name').in('id', testerIds) : Promise.resolve({ data: [] }),
      ]);

      const projMap = Object.fromEntries((projects || []).map((p: Record<string, unknown>) => [p.id, p.name]));
      const testerMap = Object.fromEntries((testers || []).map((t: Record<string, unknown>) => [t.id, t.display_name || t.full_name]));

      setFeedback((data || []).map((f: Record<string, unknown>) => ({
        ...f,
        project_name: projMap[f.project_id as string] || 'Unknown',
        tester_name: testerMap[f.tester_id as string] || 'Unknown',
      })) as UatFeedback[]);
    } catch {
      setError('Failed to load bug reports.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div className="text-sm text-foreground-400 py-8">Loading bug reports...</div>;
  if (error) return <div className="text-sm text-red-400 py-8">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {(['all', 'open', 'in_progress', 'fixed'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            filter === f ? 'bg-accent-500/10 text-accent-400' : 'text-foreground-400 hover:text-foreground-200'
          }`}>{f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
      </div>

      {feedback.length === 0 ? (
        <p className="text-sm text-foreground-500 py-8">No bug reports found.</p>
      ) : (
        <div className="grid gap-3">
          {feedback.map((f) => (
            <div key={f.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${FEEDBACK_TYPE_COLORS[f.feedback_type] || 'bg-foreground-500/10 text-foreground-500'}`}>{f.feedback_type}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[f.severity] || 'bg-foreground-500/10 text-foreground-500'}`}>{f.severity}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[f.status] || 'bg-foreground-500/10 text-foreground-500'}`}>{f.status.replace('_', ' ')}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-foreground-50 mt-1.5">{f.title}</h4>
                </div>
                {f.reference && <span className="text-[10px] text-foreground-500 shrink-0">{f.reference}</span>}
              </div>
              <p className="text-xs text-foreground-500 line-clamp-2 mb-2">{f.description}</p>
              <div className="flex items-center gap-3 text-[10px] text-foreground-500 flex-wrap">
                <span>{f.project_name}</span>
                <span className="hidden sm:inline">•</span>
                <span>{f.tester_name}</span>
                {f.device && <><span className="hidden sm:inline">•</span><span>{f.device}</span></>}
                {f.browser && <><span className="hidden sm:inline">•</span><span>{f.browser}</span></>}
                {f.category && <><span className="hidden sm:inline">•</span><span>{f.category}</span></>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}