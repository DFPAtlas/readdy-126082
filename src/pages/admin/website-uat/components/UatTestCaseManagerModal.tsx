import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import type { UatJob, UatTestCase } from '../types';
import {
  TEST_CASE_PRIORITY_LABELS,
  TEST_CASE_PRIORITY_COLORS,
  TEST_CASE_STATUS_COLORS,
} from '../testCaseHelpers';

interface Props {
  open: boolean;
  job: UatJob;
  onClose: () => void;
  onEdit: (testCase: UatTestCase) => void;
  onChanged: () => void;
}

export default function UatTestCaseManagerModal({ open, job, onClose, onEdit, onChanged }: Props) {
  const [cases, setCases] = useState<UatTestCase[]>([]);
  const [resultIds, setResultIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('uat_test_cases')
        .select('*')
        .eq('job_id', job.id)
        .is('archived_at', null)
        .order('sort_order', { ascending: true });
      if (err) throw err;
      const list = (data || []) as UatTestCase[];
      setCases(list);

      const ids = list.map((c) => c.id);
      if (ids.length > 0) {
        const { data: results, error: rErr } = await supabase
          .from('uat_test_case_results')
          .select('test_case_id')
          .in('test_case_id', ids);
        if (!rErr) {
          setResultIds(new Set((results || []).map((r: { test_case_id: string }) => r.test_case_id)));
        }
      } else {
        setResultIds(new Set());
      }
    } catch {
      setError('Failed to load test cases.');
    } finally {
      setLoading(false);
    }
  }, [job.id]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      const { error: err } = await supabase
        .from('uat_test_cases')
        .delete()
        .eq('id', confirmDeleteId);
      if (err) throw err;
      setConfirmDeleteId(null);
      onChanged();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete test case.');
    } finally {
      setDeleting(false);
    }
  };

  const canDelete = (c: UatTestCase) => c.case_status === 'draft' && !resultIds.has(c.id);
  const canEdit = (c: UatTestCase) => c.case_status === 'draft' && !resultIds.has(c.id);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage Test Cases"
      className="max-w-3xl"
      lockScroll={true}
    >
      <div className="p-5">
        <p className="text-sm text-foreground-400 mb-4">
          Test cases for <span className="text-foreground-200 font-medium">"{job.title}"</span>.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-sm text-foreground-400 py-8">Loading test cases...</div>
        ) : cases.length === 0 ? (
          <div className="text-center py-10">
            <i className="ri-list-check-3 text-3xl text-foreground-500 w-8 h-8 flex items-center justify-center mx-auto mb-3"></i>
            <p className="text-sm text-foreground-500">No test cases have been created for this test run yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-foreground-500 border-b border-background-200/60">
                  <th className="py-2 pr-3 font-label uppercase tracking-wide text-[10px]">Reference</th>
                  <th className="py-2 pr-3 font-label uppercase tracking-wide text-[10px]">Title</th>
                  <th className="py-2 pr-3 font-label uppercase tracking-wide text-[10px]">Priority</th>
                  <th className="py-2 pr-3 font-label uppercase tracking-wide text-[10px]">Est.</th>
                  <th className="py-2 pr-3 font-label uppercase tracking-wide text-[10px]">Evidence</th>
                  <th className="py-2 pr-3 font-label uppercase tracking-wide text-[10px]">Req.</th>
                  <th className="py-2 pr-3 font-label uppercase tracking-wide text-[10px]">Status</th>
                  <th className="py-2 font-label uppercase tracking-wide text-[10px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id} className="border-b border-background-200/40">
                    <td className="py-2.5 pr-3 text-foreground-300 font-medium whitespace-nowrap">{c.reference}</td>
                    <td className="py-2.5 pr-3 text-foreground-100">{c.title}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TEST_CASE_PRIORITY_COLORS[c.priority] ?? 'bg-foreground-500/10 text-foreground-500'}`}>
                        {TEST_CASE_PRIORITY_LABELS[c.priority] ?? c.priority}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-foreground-400 whitespace-nowrap">{c.estimated_minutes != null ? `${c.estimated_minutes}m` : '—'}</td>
                    <td className="py-2.5 pr-3 text-foreground-400">{c.required_evidence || '—'}</td>
                    <td className="py-2.5 pr-3 text-foreground-400">{c.is_required ? 'Required' : 'Optional'}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TEST_CASE_STATUS_COLORS[c.case_status] ?? 'bg-foreground-500/10 text-foreground-500'}`}>
                        {c.case_status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit(c) ? (
                          <button
                            onClick={() => onEdit(c)}
                            className="flex items-center gap-1 text-xs text-foreground-400 hover:text-foreground-100 font-medium transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-edit-line text-sm w-4 h-4 flex items-center justify-center"></i>
                            Edit
                          </button>
                        ) : (
                          <span className="text-[10px] text-foreground-600 italic whitespace-nowrap">Read-only</span>
                        )}
                        {canDelete(c) && (
                          <button
                            onClick={() => setConfirmDeleteId(c.id)}
                            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-medium transition-colors cursor-pointer whitespace-nowrap ml-2"
                          >
                            <i className="ri-delete-bin-line text-sm w-4 h-4 flex items-center justify-center"></i>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <Modal
        open={confirmDeleteId !== null}
        onClose={() => { if (!deleting) setConfirmDeleteId(null); }}
        title="Delete Test Case"
        variant="dialog"
        lockScroll={true}
      >
        <div className="p-5">
          <p className="text-sm text-foreground-300">Delete this draft test case? This cannot be undone.</p>
          <div className="flex items-center justify-end gap-3 mt-5">
            <button
              onClick={() => setConfirmDeleteId(null)}
              disabled={deleting}
              className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-400 text-white px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
}