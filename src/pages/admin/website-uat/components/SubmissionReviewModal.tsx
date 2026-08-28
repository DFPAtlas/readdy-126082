import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import type { UatJob, UatAssignment, UatTestCaseResult, UatEvidence, UatSession } from '../types';
import {
  ASSIGNMENT_STATUS_COLORS,
  ASSIGNMENT_STATUS_LABELS,
  REVIEW_STATUS_COLORS,
  REVIEW_STATUS_LABELS,
  RESULT_STATUS_COLORS,
} from '../types';
import { formatMinorCurrency, formatDateTime } from '../marketplace';

interface Props {
  open: boolean;
  job: UatJob;
  assignment: UatAssignment;
  onClose: () => void;
  onChanged: () => void;
}

interface TestCaseRow {
  assignmentTestCaseId: string;
  testCaseId: string;
  sortOrder: number;
  title: string;
  reference: string | null;
  expectedResult: string | null;
  result: UatTestCaseResult | null;
  evidence: UatEvidence[];
}

type Decision = 'approved' | 'changes_requested' | 'rejected' | null;

const RESULT_LABELS: Record<string, string> = {
  passed: 'PASS',
  failed: 'FAIL',
  blocked: 'BLOCKED',
};

export default function SubmissionReviewModal({ open, job, assignment, onClose, onChanged }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<TestCaseRow[]>([]);
  const [sessions, setSessions] = useState<UatSession[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const [decision, setDecision] = useState<Decision>(null);
  const [feedback, setFeedback] = useState('');
  const [notes, setNotes] = useState(assignment.review_notes ?? '');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError('');
    setDecision(null);
    setFeedback('');
    setActionError('');
    try {
      const [{ data: atc }, { data: results }, { data: evidence }, { data: sessionRows }] = await Promise.all([
        supabase.from('uat_assignment_test_cases').select('*').eq('assignment_id', assignment.id).order('sort_order', { ascending: true }),
        supabase.from('uat_test_case_results').select('*').eq('assignment_id', assignment.id),
        supabase.from('uat_evidence').select('*').eq('assignment_id', assignment.id),
        supabase.from('uat_sessions').select('*').eq('assignment_id', assignment.id).order('created_at', { ascending: false }),
      ]);

      const assignmentTestCases = (atc || []) as Array<Record<string, unknown>>;
      const testCaseIds = [...new Set(assignmentTestCases.map((r) => r.test_case_id as string))];
      const resultRows = (results || []) as UatTestCaseResult[];
      const evidenceRows = (evidence || []) as UatEvidence[];

      let testCaseMap: Record<string, Record<string, unknown>> = {};
      if (testCaseIds.length > 0) {
        const { data: tcs } = await supabase
          .from('uat_test_cases')
          .select('id,title,reference,expected_result')
          .in('id', testCaseIds);
        testCaseMap = Object.fromEntries((tcs || []).map((t: Record<string, unknown>) => [t.id, t]));
      }

      const resultByAtcId = new Map<string, UatTestCaseResult>();
      const resultByTcId = new Map<string, UatTestCaseResult>();
      resultRows.forEach((r) => {
        if (r.assignment_test_case_id) resultByAtcId.set(r.assignment_test_case_id, r);
        resultByTcId.set(r.test_case_id, r);
      });

      const evidenceByTcId = new Map<string, UatEvidence[]>();
      evidenceRows.forEach((e) => {
        const key = (e.test_case_id || e.assignment_test_case_id) as string;
        if (!key) return;
        const list = evidenceByTcId.get(key) || [];
        list.push(e);
        evidenceByTcId.set(key, list);
      });

      const built: TestCaseRow[] = assignmentTestCases.map((a) => {
        const tcId = a.test_case_id as string;
        const tc = testCaseMap[tcId] || {};
        const result = resultByAtcId.get(a.id as string) || resultByTcId.get(tcId) || null;
        return {
          assignmentTestCaseId: a.id as string,
          testCaseId: tcId,
          sortOrder: (a.sort_order as number) ?? 0,
          title: (tc.title as string) || (tc.reference as string) || 'Untitled test case',
          reference: (tc.reference as string) || null,
          expectedResult: (tc.expected_result as string) || null,
          result,
          evidence: evidenceByTcId.get(tcId) || evidenceByTcId.get(a.id as string) || [],
        };
      });
      setRows(built);
      setSessions((sessionRows || []) as UatSession[]);
      setNotes(assignment.review_notes ?? '');

      // Short-lived signed URLs so evidence can be previewed (kept private otherwise).
      const urlMap: Record<string, string> = {};
      await Promise.all(
        evidenceRows.map(async (e) => {
          if (!e.storage_path) return;
          try {
            const bucket = e.storage_bucket || 'uat-evidence';
            const { data } = await supabase.storage.from(bucket).createSignedUrl(e.storage_path, 3600);
            if (data?.signedUrl) urlMap[e.id] = data.signedUrl;
          } catch {
            /* leave unsigned; evidence remains private */
          }
        }),
      );
      setSignedUrls(urlMap);
    } catch {
      setError('Failed to load this submission for review.');
    } finally {
      setLoading(false);
    }
  }, [open, assignment.id, assignment.review_notes]);

  useEffect(() => { load(); }, [load]);

  const total = rows.length;
  const passed = rows.filter((r) => r.result?.status === 'passed').length;
  const failed = rows.filter((r) => r.result?.status === 'failed').length;
  const blocked = rows.filter((r) => r.result?.status === 'blocked').length;
  const missing = rows.filter((r) => !r.result).length;

  const session = sessions[0];
  const device = session?.device_used || '—';
  const browser = session?.browser_used || session?.browser_name || '—';

  const currentReview = assignment.review_status ?? 'pending_review';

  const submitDecision = async () => {
    if (!decision) return;
    if (decision === 'rejected' && !feedback.trim()) {
      setActionError('A reason is required to reject this submission.');
      return;
    }
    if (decision === 'changes_requested' && !feedback.trim()) {
      setActionError('A message is required when requesting more information.');
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const actorId = authSession?.user?.id ?? null;
      const payload: Record<string, unknown> = {
        review_status: decision,
        reviewed_by: actorId,
        reviewed_at: new Date().toISOString(),
        review_feedback: feedback.trim() || null,
        review_notes: notes.trim() || null,
      };
      if (decision === 'approved') {
        payload.status = 'completed';
        if (!assignment.completed_at) payload.completed_at = new Date().toISOString();
      }

      const { error: err } = await supabase.from('uat_assignments').update(payload).eq('id', assignment.id);
      if (err) throw err;

      try {
        await supabase.from('uat_audit_log').insert({
          actor_id: actorId,
          action: `assignment_review_${decision === 'changes_requested' ? 'changes_requested' : decision}`,
          entity_type: 'uat_assignment',
          entity_id: assignment.id,
          previous_value: { review_status: currentReview },
          new_value: { review_status: decision },
        });
      } catch {
        /* audit is best-effort */
      }

      setDecision(null);
      setFeedback('');
      onChanged();
      onClose();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to record review decision.');
    } finally {
      setBusy(false);
    }
  };

  const evidenceLabel = (e: UatEvidence) =>
    e.evidence_type || e.file_type || (e.mime_type?.startsWith('video') ? 'video' : e.mime_type?.startsWith('image') ? 'screenshot' : 'attachment');

  return (
    <>
      <Modal open={open} onClose={() => { if (!busy) onClose(); }} title="Review Submission" variant="default" lockScroll={true}>
        {loading ? (
          <div className="p-6 text-sm text-foreground-500">Loading submission...</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-400">{error}</div>
        ) : (
          <div className="p-5 space-y-5">
            {/* ── Header ── */}
            <div>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h4 className="text-base font-semibold text-foreground-50">{assignment.tester_name}</h4>
                  <p className="text-xs text-foreground-500 mt-0.5">{job.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ASSIGNMENT_STATUS_COLORS[assignment.status] || 'bg-foreground-500/10 text-foreground-500'}`}>
                    {ASSIGNMENT_STATUS_LABELS[assignment.status] || assignment.status}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${REVIEW_STATUS_COLORS[currentReview] || 'bg-yellow-500/10 text-yellow-400'}`}>
                    {REVIEW_STATUS_LABELS[currentReview] || 'Pending Review'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mt-3">
                <div><span className="text-foreground-500">Agreed Reward:</span> <span className="text-foreground-200 ml-1">{formatMinorCurrency(assignment.agreed_reward_amount_minor ?? 0, assignment.currency ?? 'GBP')}</span></div>
                <div><span className="text-foreground-500">Submitted:</span> <span className="text-foreground-200 ml-1">{formatDateTime(assignment.submitted_at) || '—'}</span></div>
                <div><span className="text-foreground-500">Device:</span> <span className="text-foreground-200 ml-1">{device}</span></div>
                <div><span className="text-foreground-500">Browser:</span> <span className="text-foreground-200 ml-1">{browser}</span></div>
                <div><span className="text-foreground-500">Sessions:</span> <span className="text-foreground-200 ml-1">{assignment.session_count ?? sessions.length}</span></div>
                {assignment.reviewed_at && <div><span className="text-foreground-500">Reviewed:</span> <span className="text-foreground-200 ml-1">{formatDateTime(assignment.reviewed_at)}</span></div>}
              </div>
            </div>

            {/* ── Summary totals ── */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { label: 'Total', value: total, cls: 'text-foreground-100' },
                { label: 'Passed', value: passed, cls: 'text-emerald-400' },
                { label: 'Failed', value: failed, cls: 'text-red-400' },
                { label: 'Blocked', value: blocked, cls: 'text-orange-400' },
                { label: 'Missing', value: missing, cls: missing > 0 ? 'text-amber-400' : 'text-foreground-500' },
              ].map((s) => (
                <div key={s.label} className="bg-background-100 border border-background-200/60 rounded-lg p-3 text-center">
                  <p className={`text-lg font-semibold ${s.cls}`}>{s.value}</p>
                  <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>

            {/* ── Test case results ── */}
            {rows.length === 0 ? (
              <p className="text-sm text-foreground-500">No test cases have been assigned to this submission.</p>
            ) : (
              <div className="space-y-3">
                {rows.map((r) => (
                  <div key={r.assignmentTestCaseId} className="bg-background-100 border border-background-200/60 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground-100">{r.title}</p>
                        {r.reference && <p className="text-[10px] text-foreground-500">{r.reference}</p>}
                      </div>
                      {r.result ? (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${RESULT_STATUS_COLORS[r.result.status] || 'bg-foreground-500/10 text-foreground-500'}`}>
                          {RESULT_LABELS[r.result.status] || r.result.status.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-400">NO RESULT</span>
                      )}
                    </div>

                    {r.expectedResult && (
                      <div className="mt-2 text-xs">
                        <span className="text-foreground-500">Expected:</span>
                        <span className="text-foreground-300 ml-1">{r.expectedResult}</span>
                      </div>
                    )}

                    {r.result && (
                      <>
                        {r.result.actual_result && (
                          <div className="mt-2 text-xs">
                            <span className="text-foreground-500">Actual result:</span>
                            <span className="text-foreground-200 ml-1">{r.result.actual_result}</span>
                          </div>
                        )}
                        {r.result.tester_notes && (
                          <div className="mt-1.5 text-xs">
                            <span className="text-foreground-500">Tester notes:</span>
                            <span className="text-foreground-300 ml-1">{r.result.tester_notes}</span>
                          </div>
                        )}
                        {r.result.blocker_reason && (
                          <div className="mt-1.5 text-xs bg-orange-500/10 border border-orange-500/20 rounded px-2.5 py-1.5">
                            <span className="text-orange-400">Blocked:</span>
                            <span className="text-foreground-300 ml-1">{r.result.blocker_reason}</span>
                          </div>
                        )}
                        {(r.result.status === 'failed' || r.result.status === 'blocked') && (
                          <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-medium text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">
                            <i className="ri-bug-line w-3 h-3 flex items-center justify-center"></i>
                            Potential Defect
                          </div>
                        )}
                      </>
                    )}

                    {r.evidence.length > 0 && (
                      <div className="mt-3 flex items-start gap-2 flex-wrap">
                        {r.evidence.map((e) => {
                          const url = signedUrls[e.id];
                          const isImage = (e.mime_type || '').startsWith('image/');
                          const isVideo = (e.mime_type || '').startsWith('video/');
                          return (
                            <div key={e.id} className="flex items-center gap-1.5">
                              {url && isImage ? (
                                <a href={url} target="_blank" rel="noreferrer noopener" className="block w-16 h-16 rounded-md overflow-hidden border border-background-300/60">
                                  <img src={url} alt={e.file_name || e.original_filename || 'evidence'} className="w-full h-full object-cover object-top" />
                                </a>
                              ) : (
                                <a
                                  href={url || '#'}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-full border border-background-300/60 text-foreground-300 hover:text-accent-400 hover:border-accent-500/40 transition-colors ${url ? '' : 'opacity-50 pointer-events-none'}`}
                                >
                                  <i className={`${isVideo ? 'ri-video-line' : 'ri-attachment-2'} w-3.5 h-3.5 flex items-center justify-center`}></i>
                                  {evidenceLabel(e)}{e.caption ? ` · ${e.caption}` : ''}
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Review notes + decision ── */}
            <div className="border-t border-background-200/60 pt-4">
              <div className="mb-3">
                <label className="block text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-1.5">Internal review notes (not visible to tester)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Add private notes for DFP staff only."
                  className="w-full bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none resize-none"
                />
              </div>

              {actionError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
                  <p className="text-xs text-red-400">{actionError}</p>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => { setActionError(''); setFeedback(''); setDecision('approved'); }}
                  className="bg-accent-500 hover:bg-accent-400 text-background-950 px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  Approve Submission
                </button>
                <button
                  onClick={() => { setActionError(''); setFeedback(''); setDecision('changes_requested'); }}
                  className="bg-background-50 border border-background-300/60 text-foreground-300 hover:text-amber-400 hover:border-amber-500/40 px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                >
                  Request More Information
                </button>
                <button
                  onClick={() => { setActionError(''); setFeedback(''); setDecision('rejected'); }}
                  className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                >
                  Reject Submission
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Decision confirm modal ── */}
      <Modal
        open={decision !== null}
        onClose={() => { if (!busy) setDecision(null); }}
        title={
          decision === 'approved' ? 'Approve Submission'
          : decision === 'changes_requested' ? 'Request More Information'
          : decision === 'rejected' ? 'Reject Submission'
          : 'Confirm'
        }
        variant="dialog"
        lockScroll={true}
      >
        <div className="p-5">
          {decision === 'approved' && (
            <p className="text-sm text-foreground-300">
              Approve this submission? The tester&apos;s work is accepted, all results and evidence are preserved, and the assignment becomes eligible for reward approval.
            </p>
          )}
          {decision === 'changes_requested' && (
            <div className="space-y-2">
              <p className="text-sm text-foreground-300">Describe what additional information you need from the tester.</p>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                placeholder="e.g. Please add a screenshot of the error you encountered on step 4."
                className="w-full bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none resize-none"
              />
            </div>
          )}
          {decision === 'rejected' && (
            <div className="space-y-2">
              <p className="text-sm text-foreground-300">
                Reject this submission? A reason is required. The full submission and evidence are retained.
              </p>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                placeholder="Reason for rejection"
                className="w-full bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none resize-none"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 mt-5">
            <button
              onClick={() => setDecision(null)}
              disabled={busy}
              className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={submitDecision}
              disabled={busy}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 ${
                decision === 'rejected' ? 'bg-red-500 hover:bg-red-400 text-white' : 'bg-accent-500 hover:bg-accent-400 text-background-950'
              }`}
            >
              {busy ? 'Saving...' : decision === 'approved' ? 'Approve' : decision === 'changes_requested' ? 'Send Request' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}