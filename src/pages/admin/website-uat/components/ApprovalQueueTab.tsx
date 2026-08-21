import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { UatApproval, APPROVAL_STATUS_COLORS } from '../types';

export default function ApprovalQueueTab() {
  const [approvals, setApprovals] = useState<UatApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setError('');
      const { data, error: err } = await supabase.from('uat_approvals').select('*').order('created_at', { ascending: false });
      if (err) throw err;

      const projectIds = [...new Set((data || []).map((a: Record<string, unknown>) => a.project_id))];
      const { data: projects } = await (projectIds.length > 0
        ? supabase.from('uat_projects').select('id,name').in('id', projectIds)
        : Promise.resolve({ data: [] }));

      const projMap = Object.fromEntries((projects || []).map((p: Record<string, unknown>) => [p.id, p.name]));

      setApprovals((data || []).map((a: Record<string, unknown>) => ({
        ...a,
        project_name: projMap[a.project_id as string] || 'Unknown',
      })) as UatApproval[]);
    } catch {
      setError('Failed to load approvals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div className="text-sm text-foreground-400 py-8">Loading approvals...</div>;
  if (error) return <div className="text-sm text-red-400 py-8">{error}</div>;

  if (approvals.length === 0) {
    return (
      <div className="text-center py-12">
        <i className="ri-shield-check-line text-3xl text-foreground-500 w-8 h-8 flex items-center justify-center mx-auto mb-3"></i>
        <p className="text-sm text-foreground-500">No approval requests yet.</p>
        <p className="text-xs text-foreground-600 mt-1">Deployment approvals will appear here when UAT is complete.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {approvals.map((a) => (
        <div key={a.id} className="bg-background-100 border border-background-200/60 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-foreground-50">{a.project_name}</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${APPROVAL_STATUS_COLORS[a.status] || 'bg-foreground-500/10 text-foreground-500'}`}>{a.status}</span>
              </div>
              {a.decision_reason && <p className="text-xs text-foreground-500 mt-1 line-clamp-2">{a.decision_reason}</p>}
            </div>
            {a.decided_at && <span className="text-[10px] text-foreground-500 shrink-0">{new Date(a.decided_at).toLocaleDateString()}</span>}
          </div>
          <div className="flex items-center gap-4 text-[10px] text-foreground-500 mt-2">
            {a.evidence && (
              <span className="flex items-center gap-1">
                <i className="ri-file-text-line w-3 h-3 flex items-center justify-center"></i>
                Evidence attached
              </span>
            )}
            {a.conditions && (
              <span className="flex items-center gap-1 text-amber-400">
                <i className="ri-alert-line w-3 h-3 flex items-center justify-center"></i>
                Has conditions
              </span>
            )}
            {a.exceptions && (
              <span className="flex items-center gap-1 text-orange-400">
                <i className="ri-error-warning-line w-3 h-3 flex items-center justify-center"></i>
                Has exceptions
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}