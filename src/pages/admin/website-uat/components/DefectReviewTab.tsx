import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import CreateUatTicketModal from './CreateUatTicketModal';
import LinkTicketModal from './LinkTicketModal';
import { statusColors, statusLabels } from '@/pages/support-tickets/constants';
import type { UatTestCaseResult, UatEvidence, UatDefectItem, UatFeedback } from '../types';
import { RESULT_STATUS_COLORS, DEFECT_REVIEW_STATUS_COLORS, DEFECT_REVIEW_STATUS_LABELS } from '../types';
import { formatDateTime } from '../marketplace';

const RESULT_LABELS: Record<string, string> = { failed: 'FAIL', blocked: 'BLOCKED' };

type ReviewDecision = 'validated' | 'duplicate' | 'not_a_defect';

interface ReviewTarget {
  item: UatDefectItem;
  decision: ReviewDecision;
}

export default function DefectReviewTab() {
  const [items, setItems] = useState<UatDefectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [createFor, setCreateFor] = useState<UatDefectItem | null>(null);
  const [linkFor, setLinkFor] = useState<UatDefectItem | null>(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const { data: results, error: err } = await supabase
        .from('uat_test_case_results')
        .select('*')
        .in('status', ['failed', 'blocked'])
        .order('created_at', { ascending: false });
      if (err) throw err;

      const resultRows = (results || []) as UatTestCaseResult[];
      const resultIds = resultRows.map((r) => r.id);
      const assignmentIds = [...new Set(resultRows.map((r) => r.assignment_id))];
      const testCaseIds = [...new Set(resultRows.map((r) => r.test_case_id))];
      const sessionIds = [...new Set(resultRows.map((r) => r.session_id))];

      const [{ data: assignments }, { data: testCases }, { data: sessions }, { data: defects }, { data: evidence }] =
        await Promise.all([
          assignmentIds.length ? supabase.from('uat_assignments').select('id,job_id,tester_id,submitted_at').in('id', assignmentIds) : Promise.resolve({ data: [] }),
          testCaseIds.length ? supabase.from('uat_test_cases').select('id,title,reference,expected_result').in('id', testCaseIds) : Promise.resolve({ data: [] }),
          sessionIds.length ? supabase.from('uat_sessions').select('id,device_used,browser_name,browser_used').in('id', sessionIds) : Promise.resolve({ data: [] }),
          resultIds.length ? supabase.from('uat_feedback').select('*').in('test_case_result_id', resultIds) : Promise.resolve({ data: [] }),
          assignmentIds.length ? supabase.from('uat_evidence').select('*').in('assignment_id', assignmentIds) : Promise.resolve({ data: [] }),
        ]);

      const assignmentMap = Object.fromEntries((assignments || []).map((a: Record<string, unknown>) => [a.id, a]));
      const testCaseMap = Object.fromEntries((testCases || []).map((t: Record<string, unknown>) => [t.id, t]));
      const sessionMap = Object.fromEntries((sessions || []).map((s: Record<string, unknown>) => [s.id, s]));
      const jobIds = [...new Set((assignments || []).map((a: Record<string, unknown>) => a.job_id as string))];
      const testerIds = [...new Set((assignments || []).map((a: Record<string, unknown>) => a.tester_id as string))];

      const [{ data: jobs }, { data: testers }] = await Promise.all([
        jobIds.length ? supabase.from('uat_jobs').select('id,project_id,title').in('id', jobIds) : Promise.resolve({ data: [] }),
        testerIds.length ? supabase.from('uat_testers').select('id,full_name').in('id', testerIds) : Promise.resolve({ data: [] }),
      ]);

      const jobMap = Object.fromEntries((jobs || []).map((j: Record<string, unknown>) => [j.id, j]));
      const testerMap = Object.fromEntries((testers || []).map((t: Record<string, unknown>) => [t.id, t]));
      const projectIds = [...new Set((jobs || []).map((j: Record<string, unknown>) => j.project_id as string))];
      const { data: projects } = projectIds.length
        ? await supabase.from('uat_projects').select('id,name').in('id', projectIds)
        : { data: [] };
      const projectMap = Object.fromEntries((projects || []).map((p: Record<string, unknown>) => [p.id, p]));

      const defectByResult = new Map<string, UatFeedback>();
      (defects || []).forEach((d: UatFeedback) => {
        if (d.test_case_result_id) defectByResult.set(d.test_case_result_id, d);
      });

      const evidenceByKey = new Map<string, UatEvidence[]>();
      (evidence || []).forEach((e: UatEvidence) => {
        const keys = [e.test_case_id, e.assignment_test_case_id].filter(Boolean) as string[];
        keys.forEach((k) => {
          const list = evidenceByKey.get(k) || [];
          list.push(e);
          evidenceByKey.set(k, list);
        });
      });

      const urlMap: Record<string, string> = {};
      await Promise.all(
        ((evidence || []) as UatEvidence[]).map(async (e) => {
          if (!e.storage_path) return;
          try {
            const bucket = e.storage_bucket || 'uat-evidence';
            const { data } = await supabase.storage.from(bucket).createSignedUrl(e.storage_path, 3600);
            if (data?.signedUrl) urlMap[e.id] = data.signedUrl;
          } catch {
            /* leave unsigned */
          }
        }),
      );
      setSignedUrls(urlMap);

      const ticketIds = [...new Set((defects || []).map((d: UatFeedback) => d.support_ticket_id).filter(Boolean))] as string[];
      let ticketMap: Record<string, Record<string, unknown>> = {};
      if (ticketIds.length) {
        const { data: tix } = await supabase.from('internal_support_tickets').select('id,ticket_number,status,subject').in('id', ticketIds);
        ticketMap = Object.fromEntries((tix || []).map((t: Record<string, unknown>) => [t.id, t]));
      }

      const built: UatDefectItem[] = resultRows.map((r) => {
        const a = assignmentMap[r.assignment_id] || {};
        const job = jobMap[a.job_id as string] || {};
        const tc = testCaseMap[r.test_case_id] || {};
        const sess = sessionMap[r.session_id] || {};
        const defect = defectByResult.get(r.id) || null;
        const ticket = defect?.support_ticket_id ? (ticketMap[defect.support_ticket_id] || null) : null;
        return {
          resultId: r.id,
          status: r.status,
          actualResult: r.actual_result,
          testerNotes: r.tester_notes,
          blockerReason: r.blocker_reason,
          submittedAt: (a.submitted_at as string) || r.created_at,
          testCaseId: r.test_case_id,
          testCaseTitle: (tc.title as string) || (tc.reference as string) || 'Untitled test case',
          testCaseReference: (tc.reference as string) || null,
          expectedResult: (tc.expected_result as string) || null,
          assignmentId: r.assignment_id,
          jobId: (a.job_id as string) || '',
          projectId: (job.project_id as string) || '',
          testerId: r.tester_id,
          testerName: (testerMap[r.tester_id]?.full_name as string) || 'Unknown tester',
          jobTitle: (job.title as string) || 'Unknown job',
          projectName: (projectMap[job.project_id as string]?.name as string) || 'Unknown project',
          device: (sess.device_used as string) || null,
          browser: (sess.browser_name as string) || (sess.browser_used as string) || null,
          evidence: evidenceByKey.get(r.test_case_id) || evidenceByKey.get(r.assignment_test_case_id) || [],
          defect,
          ticket: ticket ? { id: ticket.id as string, ticket_number: ticket.ticket_number as string, status: ticket.status as string, subject: ticket.subject as string } : null,
        };
      });

      setItems(built);
    } catch {
      setError('Failed to load the defect review queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitReview = async () => {
    if (!reviewTarget) return;
    const { item, decision } = reviewTarget;
    if ((decision === 'duplicate' || decision === 'not_a_defect') && !reason.trim()) {
      setActionError('A reason is required for this decision.');
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      const { error: err } = await supabase.rpc('promote_uat_defect', {
        p_result_id: item.resultId,
        p_decision: decision,
        p_reason: reason.trim() || null,
        p_duplicate_of: null,
      });
      if (err) throw err;
      setReviewTarget(null);
      setReason('');
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update defect review.');
    } finally {
      setBusy(false);
    }
  };

  const evidenceLabel = (e: UatEvidence) =>
    e.evidence_type || e.file_type || (e.mime_type?.startsWith('video') ? 'video' : e.mime_type?.startsWith('image') ? 'screenshot' : 'attachment');

  if (loading) return <div className="text-sm text-foreground-400 py-8">Loading potential defects...</div>;
  if (error) return <div className="text-sm text-red-400 py-8">{error}</div>;

  const pendingCount = items.filter((i) => !i.defect || i.defect.defect_review_status === 'pending_review').length;

  const reportCountByTc: Record<string, number> = {};
  items.forEach((i) => {
    reportCountByTc[i.testCaseId] = (reportCountByTc[i.testCaseId] || 0) + 1;
  });

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-foreground-500">
            FAIL/BLOCKED test results flagged as potential defects. Review each before creating or linking a support ticket.
          </p>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-yellow-500/10 text-yellow-400">
            {pendingCount} awaiting review
          </span>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-foreground-500 py-8">No FAIL or BLOCKED results found. No potential defects to review.</p>
        ) : (
          <div className="grid gap-3">
            {items.map((item) => {
              const reviewStatus = item.defect?.defect_review_status ?? 'pending_review';
              const isLinked = reviewStatus === 'linked_to_ticket';
              return (
                <div key={item.resultId} className="bg-background-100 border border-background-200/60 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${RESULT_STATUS_COLORS[item.status] || 'bg-foreground-500/10 text-foreground-500'}`}>
                          {RESULT_LABELS[item.status] || item.status.toUpperCase()}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${DEFECT_REVIEW_STATUS_COLORS[reviewStatus] || 'bg-yellow-500/10 text-yellow-400'}`}>
                          {DEFECT_REVIEW_STATUS_LABELS[reviewStatus] || 'Pending Review'}
                        </span>
                        {reportCountByTc[item.testCaseId] > 1 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-sky-500/10 text-sky-400">
                            {reportCountByTc[item.testCaseId]} testers reported this
                          </span>
                        )}
                        <span className="text-[10px] text-foreground-500">{item.projectName}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-foreground-50 mt-1.5">{item.testCaseTitle}</h4>
                      {item.testCaseReference && <p className="text-[10px] text-foreground-500">{item.testCaseReference}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-foreground-500 mt-2 flex-wrap">
                    <span>{item.jobTitle}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>{item.testerName}</span>
                    {item.device && <><span className="hidden sm:inline">•</span><span>{item.device}</span></>}
                    {item.browser && <><span className="hidden sm:inline">•</span><span>{item.browser}</span></>}
                    <span className="hidden sm:inline">•</span>
                    <span>{formatDateTime(item.submittedAt) || '—'}</span>
                  </div>

                  {item.expectedResult && (
                    <div className="mt-2 text-xs">
                      <span className="text-foreground-500">Expected:</span>
                      <span className="text-foreground-300 ml-1">{item.expectedResult}</span>
                    </div>
                  )}
                  {item.actualResult && (
                    <div className="mt-1.5 text-xs">
                      <span className="text-foreground-500">Actual result:</span>
                      <span className="text-foreground-200 ml-1">{item.actualResult}</span>
                    </div>
                  )}
                  {item.testerNotes && (
                    <div className="mt-1.5 text-xs">
                      <span className="text-foreground-500">Tester notes:</span>
                      <span className="text-foreground-300 ml-1">{item.testerNotes}</span>
                    </div>
                  )}
                  {item.blockerReason && (
                    <div className="mt-1.5 text-xs bg-orange-500/10 border border-orange-500/20 rounded px-2.5 py-1.5">
                      <span className="text-orange-400">Blocked:</span>
                      <span className="text-foreground-300 ml-1">{item.blockerReason}</span>
                    </div>
                  )}
                  {item.defect?.defect_review_note && (
                    <div className="mt-1.5 text-xs text-foreground-400">
                      <span className="text-foreground-500">Review note:</span>
                      <span className="ml-1">{item.defect.defect_review_note}</span>
                    </div>
                  )}

                  {item.evidence.length > 0 && (
                    <div className="mt-3 flex items-start gap-2 flex-wrap">
                      {item.evidence.map((e) => {
                        const url = signedUrls[e.id];
                        const isImage = (e.mime_type || '').startsWith('image/');
                        const isVideo = (e.mime_type || '').startsWith('video/');
                        return (
                          <div key={e.id} className="flex items-center gap-1.5">
                            {url && isImage ? (
                              <a href={url} target="_blank" rel="noreferrer noopener" className="block w-14 h-14 rounded-md overflow-hidden border border-background-300/60">
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
                                {evidenceLabel(e)}
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isLinked && item.ticket && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/support-tickets/${item.ticket.id}`}
                        className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-full bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors whitespace-nowrap"
                      >
                        <i className="ri-ticket-2-line w-3.5 h-3.5 flex items-center justify-center"></i>
                        {item.ticket.ticket_number}
                      </Link>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[item.ticket.status as keyof typeof statusColors] || 'bg-foreground-500/10 text-foreground-500'}`}>
                        {statusLabels[item.ticket.status as keyof typeof statusLabels] || item.ticket.status}
                      </span>
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {reviewStatus === 'validated' && (
                      <>
                        <button
                          onClick={() => setCreateFor(item)}
                          className="bg-accent-500 hover:bg-accent-400 text-background-950 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Create Support Ticket
                        </button>
                        <button
                          onClick={() => setLinkFor(item)}
                          className="bg-background-50 border border-background-300/60 text-foreground-300 hover:text-violet-400 hover:border-violet-500/40 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Link Existing Ticket
                        </button>
                      </>
                    )}

                    {reviewStatus !== 'validated' && (
                      <>
                        <button
                          onClick={() => { setActionError(''); setReason(''); setReviewTarget({ item, decision: 'validated' }); }}
                          className="bg-accent-500 hover:bg-accent-400 text-background-950 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Validate Defect
                        </button>
                        <button
                          onClick={() => { setActionError(''); setReason(''); setReviewTarget({ item, decision: 'duplicate' }); }}
                          className="bg-background-50 border border-background-300/60 text-foreground-300 hover:text-sky-400 hover:border-sky-500/40 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Mark Duplicate
                        </button>
                        <button
                          onClick={() => { setActionError(''); setReason(''); setReviewTarget({ item, decision: 'not_a_defect' }); }}
                          className="bg-background-50 border border-background-300/60 text-foreground-300 hover:text-foreground-100 hover:border-foreground-400/50 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Not a Defect
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Review decision modal ── */}
      <Modal
        open={reviewTarget !== null}
        onClose={() => { if (!busy) setReviewTarget(null); }}
        title={
          reviewTarget?.decision === 'validated' ? 'Validate Defect'
          : reviewTarget?.decision === 'duplicate' ? 'Mark Duplicate'
          : reviewTarget?.decision === 'not_a_defect' ? 'Not a Defect'
          : 'Confirm'
        }
        variant="dialog"
        lockScroll={true}
      >
        <div className="p-5">
          {reviewTarget?.decision === 'validated' && (
            <p className="text-sm text-foreground-300">
              Confirm this is a genuine defect for <span className="text-foreground-100">{reviewTarget.item.testCaseTitle}</span>? It will be marked as validated and ready to link to a support ticket.
            </p>
          )}
          {reviewTarget?.decision === 'duplicate' && (
            <div className="space-y-2">
              <p className="text-sm text-foreground-300">Mark this as a duplicate. A reason is required (e.g. reference the original defect).</p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Reason (e.g. same issue as TC-042 reported by another tester)"
                className="w-full bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none resize-none"
              />
            </div>
          )}
          {reviewTarget?.decision === 'not_a_defect' && (
            <div className="space-y-2">
              <p className="text-sm text-foreground-300">Record this as not a defect. A reason is required.</p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Reason (e.g. expected behaviour per spec, tester misread the step)"
                className="w-full bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none resize-none"
              />
            </div>
          )}

          {actionError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-3">
              <p className="text-xs text-red-400">{actionError}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 mt-5">
            <button
              onClick={() => setReviewTarget(null)}
              disabled={busy}
              className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={submitReview}
              disabled={busy}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 ${
                reviewTarget?.decision === 'duplicate' ? 'bg-sky-500 hover:bg-sky-400 text-background-950'
                : reviewTarget?.decision === 'not_a_defect' ? 'bg-foreground-500 hover:bg-foreground-400 text-background-950'
                : 'bg-accent-500 hover:bg-accent-400 text-background-950'
              }`}
            >
              {busy ? 'Saving...' : reviewTarget?.decision === 'validated' ? 'Validate' : reviewTarget?.decision === 'duplicate' ? 'Mark Duplicate' : 'Not a Defect'}
            </button>
          </div>
        </div>
      </Modal>

      <CreateUatTicketModal
        open={createFor !== null}
        defect={createFor}
        onClose={() => setCreateFor(null)}
        onCreated={load}
      />

      <LinkTicketModal
        open={linkFor !== null}
        defect={linkFor}
        onClose={() => setLinkFor(null)}
        onLinked={load}
      />
    </>
  );
}