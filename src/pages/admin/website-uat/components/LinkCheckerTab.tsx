import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { UatEvidence } from '../types';

export default function LinkCheckerTab() {
  const [evidence, setEvidence] = useState<UatEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setError('');
      const { data, error: err } = await supabase.from('uat_evidence').select('*').order('created_at', { ascending: false }).limit(50);
      if (err) throw err;

      const projectIds = [...new Set((data || []).map((e: Record<string, unknown>) => e.project_id).filter(Boolean))];
      const testerIds = [...new Set((data || []).map((e: Record<string, unknown>) => e.tester_id).filter(Boolean))];
      const [{ data: projects }, { data: testers }] = await Promise.all([
        projectIds.length > 0 ? supabase.from('uat_projects').select('id,name').in('id', projectIds as string[]) : Promise.resolve({ data: [] }),
        testerIds.length > 0 ? supabase.from('uat_testers').select('id,display_name,full_name').in('id', testerIds as string[]) : Promise.resolve({ data: [] }),
      ]);

      const projMap = Object.fromEntries((projects || []).map((p: Record<string, unknown>) => [p.id, p.name]));
      const testerMap = Object.fromEntries((testers || []).map((t: Record<string, unknown>) => [t.id, t.display_name || t.full_name]));

      setEvidence((data || []).map((e: Record<string, unknown>) => ({
        ...e,
        project_name: projMap[e.project_id as string] || '',
        tester_name: testerMap[e.tester_id as string] || '',
      })) as UatEvidence[]);
    } catch {
      setError('Failed to load evidence.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getTypeIcon = (type: string) => {
    if (type === 'screenshot') return 'ri-image-line';
    if (type === 'video') return 'ri-video-line';
    if (type === 'log') return 'ri-file-text-line';
    return 'ri-attachment-line';
  };

  if (loading) return <div className="text-sm text-foreground-400 py-8">Loading evidence...</div>;
  if (error) return <div className="text-sm text-red-400 py-8">{error}</div>;

  if (evidence.length === 0) {
    return (
      <div className="text-center py-12">
        <i className="ri-camera-line text-3xl text-foreground-500 w-8 h-8 flex items-center justify-center mx-auto mb-3"></i>
        <p className="text-sm text-foreground-500">No evidence uploaded yet.</p>
        <p className="text-xs text-foreground-600 mt-1">Screenshots and recordings from test sessions will appear here.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {evidence.map((e) => (
        <div key={e.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-background-200/40 flex items-center justify-center">
              <i className={`${getTypeIcon(e.evidence_type)} text-foreground-400 w-4 h-4 flex items-center justify-center`}></i>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground-200 truncate">{e.file_name}</p>
              <p className="text-[10px] text-foreground-500">{e.evidence_type} • {e.capture_source}</p>
            </div>
          </div>
          {e.tester_notes && <p className="text-xs text-foreground-500 line-clamp-2 mb-2">{e.tester_notes}</p>}
          <div className="flex items-center justify-between text-[10px] text-foreground-500">
            <span>{e.tester_name || 'Unknown'}</span>
            <span>{new Date(e.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}