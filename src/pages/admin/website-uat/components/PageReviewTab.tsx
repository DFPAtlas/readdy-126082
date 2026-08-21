import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { UatTestCaseResult, RESULT_STATUS_COLORS } from '../types';

export default function PageReviewTab() {
  const [results, setResults] = useState<UatTestCaseResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed' | 'blocked'>('all');

  const loadData = useCallback(async () => {
    try {
      setError('');
      let q = supabase.from('uat_test_case_results').select('*').order('created_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      const { data, error: err } = await q;
      if (err) throw err;

      const caseIds = [...new Set((data || []).map((r: Record<string, unknown>) => r.test_case_id))];
      const testerIds = [...new Set((data || []).map((r: Record<string, unknown>) => r.tester_id))];
      const [{ data: cases }, { data: testers }] = await Promise.all([
        caseIds.length > 0 ? supabase.from('uat_test_cases').select('id,title,reference').in('id', caseIds) : Promise.resolve({ data: [] }),
        testerIds.length > 0 ? supabase.from('uat_testers').select('id,display_name,full_name').in('id', testerIds) : Promise.resolve({ data: [] }),
      ]);

      const caseMap = Object.fromEntries((cases || []).map((c: Record<string, unknown>) => [c.id, { title: c.title, reference: c.reference }]));
      const testerMap = Object.fromEntries((testers || []).map((t: Record<string, unknown>) => [t.id, t.display_name || t.full_name]));

      setResults((data || []).map((r: Record<string, unknown>) => ({
        ...r,
        test_case_title: caseMap[r.test_case_id as string]?.title || 'Unknown',
        test_case_reference: caseMap[r.test_case_id as string]?.reference || '',
        tester_name: testerMap[r.tester_id as string] || 'Unknown',
      })) as UatTestCaseResult[]);
    } catch {
      setError('Failed to load test results.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div className="text-sm text-foreground-400 py-8">Loading test results...</div>;
  if (error) return <div className="text-sm text-red-400 py-8">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {(['all', 'passed', 'failed', 'blocked'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            filter === f ? 'bg-accent-500/10 text-accent-400' : 'text-foreground-400 hover:text-foreground-200'
          }`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
      </div>

      {results.length === 0 ? (
        <p className="text-sm text-foreground-500 py-8">No test results found.</p>
      ) : (
        <div className="grid gap-3">
          {results.map((r) => (
            <div key={r.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${RESULT_STATUS_COLORS[r.status] || 'bg-foreground-500/10 text-foreground-500'}`}>{r.status.replace('_', ' ')}</span>
                    {r.test_case_reference && <span className="text-[10px] text-foreground-500">{r.test_case_reference}</span>}
                  </div>
                  <h4 className="text-sm font-semibold text-foreground-50 mt-1.5">{r.test_case_title}</h4>
                </div>
                <span className="text-[10px] text-foreground-500 shrink-0">{Math.floor(r.duration_seconds / 60)}m {r.duration_seconds % 60}s</span>
              </div>
              {r.actual_result && <p className="text-xs text-foreground-500 line-clamp-2 mb-2">{r.actual_result}</p>}
              {r.tester_notes && <p className="text-xs text-foreground-600 italic mb-2">"{r.tester_notes}"</p>}
              {r.blocker_reason && <p className="text-xs text-red-400 bg-red-500/5 px-2 py-1 rounded mb-2">Blocked: {r.blocker_reason}</p>}
              <div className="flex items-center gap-3 text-[10px] text-foreground-500">
                <span>{r.tester_name}</span>
                <span className="hidden sm:inline">•</span>
                <span>{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}