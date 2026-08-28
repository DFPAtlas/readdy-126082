import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useTester } from '@/components/feature/TesterAuthGuard';
import type { UatAssignment, UatJob, UatProject } from '@/pages/admin/website-uat/types';
import { formatMinorCurrency, DEVICE_LABELS, BROWSER_LABELS } from '@/pages/admin/website-uat/marketplace';
import { formatDate } from '../types';
import ProgressBar from '../components/ProgressBar';
import CaseNavigator from './components/CaseNavigator';
import CasePanel from './components/CasePanel';
import {
  type RunnerCase,
  type Draft,
  type EvidenceItem,
  type EnvState,
  detectBrowser,
  detectOS,
  detectDeviceType,
  browserToEnum,
  deviceTypeToEnum,
  parseSteps,
  requiresScreenshotOnFail,
  requiresNotesOnFail,
  requiresDeviceInfo,
  requiresBrowserInfo,
} from './lib';

const EMPTY_DRAFT: Draft = { status: '', actualResult: '', notes: '', blockerReason: '' };

type Phase = 'runner' | 'review' | 'submitted';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface LoadedState {
  assignment: UatAssignment;
  job: UatJob | null;
  project: UatProject | null;
}

export default function UatRunner() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { tester } = useTester();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notRunnable, setNotRunnable] = useState<string>('');

  const [loaded, setLoaded] = useState<LoadedState | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cases, setCases] = useState<RunnerCase[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [evidenceByCase, setEvidenceByCase] = useState<Record<string, EvidenceItem[]>>({});
  const [env, setEnv] = useState<EnvState>({ device: '', browser: '', os: '', browserVersion: '' });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('runner');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true);
    setError('');
    try {
      const { data: a, error: ae } = await supabase
        .from('uat_assignments')
        .select('*')
        .eq('id', assignmentId)
        .maybeSingle();
      if (ae) throw ae;
      if (!a) {
        setError('Assignment not found.');
        return;
      }
      const assignment = a as UatAssignment;

      // Non-runnable states → read-only message, no session started.
      if (assignment.submitted_at != null || assignment.status === 'submitted') {
        setNotRunnable('This test has already been submitted and is awaiting DFP review.');
        setLoading(false);
        return;
      }
      if (['completed', 'cancelled', 'rejected', 'expired'].includes(assignment.status)) {
        setNotRunnable('This test is no longer active.');
        setLoading(false);
        return;
      }

      const { data: j } = await supabase.from('uat_jobs').select('*').eq('id', assignment.job_id).maybeSingle();
      const job = (j as UatJob) ?? null;
      const { data: pr } = job
        ? await supabase.from('uat_projects').select('*').eq('id', job.project_id).maybeSingle()
        : { data: null };
      const project = (pr as UatProject) ?? null;

      const { data: atcRows, error: atcErr } = await supabase
        .from('uat_assignment_test_cases')
        .select('id,test_case_id,sort_order,status')
        .eq('assignment_id', assignmentId)
        .order('sort_order', { ascending: true });
      if (atcErr) throw atcErr;

      const testCaseIds = (atcRows ?? []).map((r) => r.test_case_id).filter(Boolean);
      const { data: tcRows } =
        testCaseIds.length > 0
          ? await supabase.from('uat_test_cases').select('*').in('id', testCaseIds)
          : { data: [] };
      const tcById = new Map<string, Record<string, unknown>>((tcRows ?? []).map((t) => [t.id, t]));

      const { data: resRows } = await supabase
        .from('uat_test_case_results')
        .select('assignment_test_case_id,status,actual_result,tester_notes,blocker_reason')
        .eq('assignment_id', assignmentId);
      const resByAtc = new Map<string, Record<string, unknown>>(
        (resRows ?? []).map((r) => [r.assignment_test_case_id, r]),
      );

      const { data: evRows } = await supabase
        .from('uat_evidence')
        .select('id,assignment_test_case_id,evidence_type,file_name,mime_type,file_size_bytes')
        .eq('assignment_id', assignmentId)
        .neq('status', 'deleted');

      // Build ordered case list from real rows.
      const built: RunnerCase[] = (atcRows ?? []).map((atc) => {
        const tc = tcById.get(atc.test_case_id) ?? {};
        const res = resByAtc.get(atc.id);
        const existingStatus = res ? String(res.status ?? '') : '';
        const existing = res
          ? {
              status: existingStatus,
              actualResult: res.actual_result != null ? String(res.actual_result) : '',
              notes: res.tester_notes != null ? String(res.tester_notes) : '',
              blockerReason: res.blocker_reason != null ? String(res.blocker_reason) : '',
            }
          : null;
        return {
          atcId: atc.id,
          testCaseId: atc.test_case_id,
          sortOrder: atc.sort_order ?? 0,
          atcStatus: atc.status ?? 'not_started',
          title: tc.title != null ? String(tc.title) : tc.reference != null ? String(tc.reference) : 'Untitled case',
          reference: tc.reference != null ? String(tc.reference) : null,
          description: tc.description != null ? String(tc.description) : null,
          preconditions: tc.preconditions != null ? String(tc.preconditions) : null,
          steps: parseSteps(tc.steps),
          expectedResult: tc.expected_result != null ? String(tc.expected_result) : '',
          isRequired: tc.is_required !== false,
          existing,
        };
      });

      const draftMap: Record<string, Draft> = {};
      for (const c of built) {
        const ex = c.existing;
        const terminal = ex && ['passed', 'failed', 'blocked'].includes(ex.status);
        draftMap[c.atcId] = terminal
          ? { status: ex!.status as Draft['status'], actualResult: ex!.actualResult, notes: ex!.notes, blockerReason: ex!.blockerReason }
          : { ...EMPTY_DRAFT };
      }

      const evMap: Record<string, EvidenceItem[]> = {};
      for (const e of evRows ?? []) {
        const key = e.assignment_test_case_id;
        if (!key) continue;
        if (!evMap[key]) evMap[key] = [];
        evMap[key].push({
          id: e.id,
          evidence_type: e.evidence_type,
          file_name: e.file_name,
          mime_type: e.mime_type,
          file_size_bytes: e.file_size_bytes,
        });
      }

      // Start (or resume) the session.
      const browser = detectBrowser();
      const os = detectOS();
      const { data: sData, error: sErr } = await supabase.rpc('start_uat_session', {
        p_assignment_id: assignmentId,
        p_browser_name: browser.name || null,
        p_browser_version: browser.version || null,
        p_operating_system: os || null,
        p_viewport_width: window.innerWidth,
        p_viewport_height: window.innerHeight,
        p_user_agent: navigator.userAgent,
      });
      if (sErr) throw sErr;
      if (!sData?.success) throw new Error(sData?.message || 'Could not start test session.');

      setLoaded({ assignment, job, project });
      setSessionId(sData.session_id);
      setCases(built);
      setDrafts(draftMap);
      setEvidenceByCase(evMap);
      setEnv({
        device: deviceTypeToEnum(detectDeviceType()),
        browser: browserToEnum(browser.name),
        os,
        browserVersion: browser.version,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    load();
  }, [load, tester]);

  const job = loaded?.job ?? null;
  const currentCase = cases[currentIndex];
  const currentDraft = currentCase ? drafts[currentCase.atcId] ?? EMPTY_DRAFT : EMPTY_DRAFT;
  const currentEvidence = currentCase ? evidenceByCase[currentCase.atcId] ?? [] : [];

  const completedCount = useMemo(
    () => cases.filter((c) => ['passed', 'failed', 'blocked'].includes(drafts[c.atcId]?.status ?? '')).length,
    [cases, drafts],
  );

  const setDraft = useCallback(
    (atcId: string, d: Draft) => setDrafts((prev) => ({ ...prev, [atcId]: d })),
    [],
  );

  const setEvidence = useCallback(
    (atcId: string, e: EvidenceItem[]) => setEvidenceByCase((prev) => ({ ...prev, [atcId]: e })),
    [],
  );

  const persistCase = useCallback(
    async (atcId: string, draft: Draft) => {
      if (!draft.status || !sessionId) return;
      setSaveStatus('saving');
      setSaveError('');
      try {
        const { data, error: rpcErr } = await supabase.rpc('update_uat_test_case_result', {
          p_assignment_test_case_id: atcId,
          p_session_id: sessionId,
          p_status: draft.status,
          p_actual_result: draft.actualResult.trim() ? draft.actualResult : null,
          p_tester_notes: draft.notes.trim() ? draft.notes : null,
          p_blocker_reason: draft.blockerReason.trim() ? draft.blockerReason : null,
        });
        if (rpcErr) throw rpcErr;
        if (!data?.success) throw new Error(data?.message || 'Save failed.');
        setSaveStatus('saved');
      } catch (err) {
        setSaveStatus('error');
        setSaveError(err instanceof Error ? err.message : String(err));
      }
    },
    [sessionId],
  );

  const validateDraft = useCallback(
    (draft: Draft, evidence: EvidenceItem[]): string[] => {
      const missing: string[] = [];
      if (!draft.status) return ['a result (PASS, FAIL or BLOCKED)'];
      if (draft.status === 'failed') {
        if (!draft.actualResult.trim()) missing.push('an actual result');
        if (requiresNotesOnFail(job) && !draft.notes.trim()) missing.push('notes');
        if (requiresScreenshotOnFail(job) && evidence.length === 0) missing.push('screenshot evidence');
      }
      if (draft.status === 'blocked' && !draft.blockerReason.trim()) missing.push('a reason');
      return missing;
    },
    [job],
  );

  const persistCurrent = useCallback(async () => {
    if (currentCase) await persistCase(currentCase.atcId, currentDraft);
  }, [currentCase, currentDraft, persistCase]);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= cases.length) return;
      void persistCurrent();
      setCurrentIndex(index);
    },
    [cases.length, persistCurrent],
  );

  const onSave = () => {
    if (!currentCase) return;
    const missing = validateDraft(currentDraft, currentEvidence);
    if (missing.length) {
      setSaveError(`Cannot save: this case needs ${missing.join(', ')}.`);
      return;
    }
    void persistCase(currentCase.atcId, currentDraft);
  };

  const onSaveNext = () => {
    if (!currentCase) return;
    const missing = validateDraft(currentDraft, currentEvidence);
    if (missing.length) {
      setSaveError(`Cannot continue: this case needs ${missing.join(', ')}.`);
      return;
    }
    void persistCase(currentCase.atcId, currentDraft);
    if (currentIndex < cases.length - 1) setCurrentIndex(currentIndex + 1);
    else setPhase('review');
  };

  const persistEnv = useCallback(
    async (next: EnvState) => {
      setEnv(next);
      if (!sessionId) return;
      try {
        await supabase
          .from('uat_sessions')
          .update({ device_used: next.device || null, browser_used: next.browser || null })
          .eq('id', sessionId);
      } catch {
        /* best-effort; final submit re-checks */
      }
    },
    [sessionId],
  );

  const reviewSummary = useMemo(() => {
    let passed = 0;
    let failed = 0;
    let blocked = 0;
    let incomplete = 0;
    const missing: string[] = [];
    cases.forEach((c, i) => {
      const d = drafts[c.atcId] ?? EMPTY_DRAFT;
      const ev = evidenceByCase[c.atcId] ?? [];
      if (d.status === 'passed') passed += 1;
      else if (d.status === 'failed') failed += 1;
      else if (d.status === 'blocked') blocked += 1;
      else incomplete += 1;
      const errs = validateDraft(d, ev);
      if (errs.length) missing.push(`Case ${i + 1} — ${c.title}: needs ${errs.join(', ')}`);
    });
    if (requiresDeviceInfo(job) && !env.device) missing.push('Device information');
    if (requiresBrowserInfo(job) && !env.browser) missing.push('Browser information');
    return { passed, failed, blocked, incomplete, missing };
  }, [cases, drafts, evidenceByCase, env, job, validateDraft]);

  const onSubmit = async () => {
    if (!sessionId) return;
    if (reviewSummary.missing.length > 0) {
      setSubmitError('Please complete the missing items before submitting.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      // Ensure device/browser are persisted before finishing.
      await supabase
        .from('uat_sessions')
        .update({ device_used: env.device || null, browser_used: env.browser || null })
        .eq('id', sessionId);
      const { data, error: rpcErr } = await supabase.rpc('finish_uat_session', { p_session_id: sessionId });
      if (rpcErr) throw rpcErr;
      if (!data?.success) throw new Error(data?.message || 'Could not submit.');
      setPhase('submitted');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / error / not-runnable / submitted screens ────────────────
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 w-32 bg-background-300/40 rounded"></div>
        <div className="h-32 bg-background-300/30 rounded-lg"></div>
        <div className="h-24 bg-background-300/30 rounded-lg"></div>
      </div>
    );
  }

  if (error) {
    return <Centered message={error} onBack={() => navigate('/account/uat')} />;
  }

  if (notRunnable) {
    return <Centered message={notRunnable} onBack={() => navigate(`/account/uat/assignment/${assignmentId}`)} />;
  }

  if (phase === 'submitted') {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-4">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6">
          <i className="ri-check-double-line text-emerald-400 text-3xl w-8 h-8 flex items-center justify-center"></i>
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground-50 mb-3">UAT Submitted</h1>
        <p className="text-sm text-foreground-400 mb-8 max-w-md leading-relaxed">
          Your test is now awaiting DFP review. Your reward will be reviewed separately — submitting does not approve
          payment.
        </p>
        <Link
          to={`/account/uat/assignment/${assignmentId}`}
          className="bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-6 py-3 rounded-full transition-colors whitespace-nowrap cursor-pointer"
        >
          View My Test
        </Link>
      </div>
    );
  }

  if (phase === 'review') {
    const { passed, failed, blocked, incomplete, missing } = reviewSummary;
    const total = cases.length;
    return (
      <div className="space-y-6">
        <button
          onClick={() => setPhase('runner')}
          className="inline-flex items-center gap-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer"
        >
          <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
          Back to cases
        </button>

        <div className="bg-background-100 border border-background-200/60 rounded-lg p-6">
          <h1 className="font-heading text-xl font-bold text-foreground-50 mb-1">Review &amp; Submit</h1>
          <p className="text-sm text-foreground-500 mb-6">Check your results before sending them to DFP for review.</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Stat label="Total cases" value={String(total)} />
            <Stat label="Passed" value={String(passed)} tone="text-emerald-400" />
            <Stat label="Failed" value={String(failed)} tone="text-red-400" />
            <Stat label="Blocked" value={String(blocked)} tone="text-orange-400" />
          </div>

          {incomplete > 0 && (
            <p className="text-sm text-amber-400 mb-4 flex items-center gap-1.5">
              <i className="ri-alert-line w-4 h-4 flex items-center justify-center"></i>
              {incomplete} case{incomplete === 1 ? '' : 's'} not yet completed
            </p>
          )}

          {loaded?.assignment && (
            <div className="flex items-center justify-between p-4 bg-background-50 border border-background-200/60 rounded-lg mb-6">
              <span className="text-sm text-foreground-400">Agreed reward</span>
              <span className="text-lg font-heading font-semibold text-foreground-100">
                {formatMinorCurrency(loaded.assignment.agreed_reward_amount_minor, loaded.assignment.currency)}
              </span>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-xs font-label text-foreground-500 uppercase tracking-wide mb-2">Evidence summary</h2>
            <p className="text-sm text-foreground-300">
              {Object.values(evidenceByCase).reduce((n, arr) => n + arr.length, 0)} file
              {Object.values(evidenceByCase).reduce((n, arr) => n + arr.length, 0) === 1 ? '' : 's'} attached across{' '}
              {cases.length} case{cases.length === 1 ? '' : 's'}.
            </p>
          </div>

          {missing.length > 0 && (
            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg mb-6">
              <h2 className="text-xs font-label text-amber-400 uppercase tracking-wide mb-2">Missing before submit</h2>
              <ul className="space-y-1">
                {missing.map((m, i) => (
                  <li key={i} className="text-sm text-amber-300 flex items-start gap-2">
                    <i className="ri-error-warning-line w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {submitError && <p className="text-sm text-red-400 mb-4">{submitError}</p>}

          <p className="text-sm text-foreground-500 mb-6 leading-relaxed">
            Submitting will send your work to DFP for review. You won't be able to edit after submission unless a
            reviewer requests more information.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setPhase('runner')}
              className="px-6 py-3 rounded-full border border-background-200/60 text-foreground-300 text-sm font-semibold hover:bg-background-200/40 transition-colors whitespace-nowrap cursor-pointer"
            >
              Back to Tests
            </button>
            <button
              onClick={onSubmit}
              disabled={submitting || missing.length > 0}
              className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 disabled:cursor-not-allowed text-background-950 font-semibold text-sm px-6 py-3 rounded-full transition-colors whitespace-nowrap cursor-pointer"
            >
              {submitting ? 'Submitting…' : 'Submit UAT'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Runner ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-lg font-semibold text-foreground-50">{job?.title ?? 'UAT Test'}</h1>
            <p className="text-sm text-foreground-500">{loaded?.project?.name ?? '—'}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span
              className={`text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${
                saveStatus === 'error'
                  ? 'bg-red-500/10 text-red-400'
                  : saveStatus === 'saved'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : saveStatus === 'saving'
                      ? 'bg-yellow-500/10 text-yellow-400'
                      : 'bg-foreground-500/10 text-foreground-500'
              }`}
            >
              {saveStatus === 'error' ? 'Not saved' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving…' : 'Unsaved changes'}
            </span>
            <button
              onClick={() => {
                void persistCurrent();
                setPhase('review');
              }}
              className="bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-4 py-2 rounded-full transition-colors whitespace-nowrap cursor-pointer"
            >
              Review &amp; Submit
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground-400">
          <span className="flex items-center gap-1.5">
            <i className="ri-list-check-2 w-4 h-4 flex items-center justify-center"></i>
            {completedCount} of {cases.length} completed
          </span>
          {loaded?.assignment?.deadline && (
            <span className="flex items-center gap-1.5">
              <i className="ri-calendar-line w-4 h-4 flex items-center justify-center"></i>
              Due {formatDate(loaded.assignment.deadline)}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <i className="ri-focus-3-line w-4 h-4 flex items-center justify-center"></i>
            Case {currentIndex + 1} of {cases.length}
          </span>
        </div>

        <div className="mt-4">
          <ProgressBar completed={completedCount} total={cases.length} />
        </div>
      </div>

      {/* Environment (only when required, but always shown for confirmation) */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <i className="ri-smartphone-line text-foreground-400 text-base w-5 h-5 flex items-center justify-center"></i>
          <h2 className="font-heading text-sm font-semibold text-foreground-50">Test environment</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-label text-foreground-500 uppercase tracking-wide block mb-1">
              Device {requiresDeviceInfo(job) && <span className="text-red-400">*</span>}
            </label>
            <select
              value={env.device}
              onChange={(e) => void persistEnv({ ...env, device: e.target.value })}
              className="w-full bg-background-50 border border-background-200/60 rounded-md px-3 py-2 text-sm text-foreground-200 focus:outline-none focus:border-accent-400 cursor-pointer"
            >
              <option value="">Select device…</option>
              {Object.entries(DEVICE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-label text-foreground-500 uppercase tracking-wide block mb-1">
              Browser {requiresBrowserInfo(job) && <span className="text-red-400">*</span>}
            </label>
            <select
              value={env.browser}
              onChange={(e) => void persistEnv({ ...env, browser: e.target.value })}
              className="w-full bg-background-50 border border-background-200/60 rounded-md px-3 py-2 text-sm text-foreground-200 focus:outline-none focus:border-accent-400 cursor-pointer"
            >
              <option value="">Select browser…</option>
              {Object.entries(BROWSER_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
        {(env.os || env.browserVersion) && (
          <p className="text-xs text-foreground-500 mt-3">
            Detected: {[env.os, env.browserVersion ? `v${env.browserVersion}` : ''].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {/* Case navigator */}
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
        <CaseNavigator cases={cases} drafts={drafts} currentIndex={currentIndex} onSelect={goTo} />
      </div>

      {/* Current case */}
      {currentCase && (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-5 sm:p-6">
          <CasePanel
            caseItem={currentCase}
            draft={currentDraft}
            evidence={currentEvidence}
            job={job}
            assignmentId={assignmentId ?? ''}
            sessionId={sessionId}
            disabled={false}
            evidenceHint="A screenshot is required when marking this case as FAIL."
            onDraftChange={(d) => setDraft(currentCase.atcId, d)}
            onEvidenceChange={(e) => setEvidence(currentCase.atcId, e)}
          />

          {saveError && (
            <p className="text-sm text-red-400 mt-4 flex items-center gap-1.5">
              <i className="ri-error-warning-line w-4 h-4 flex items-center justify-center"></i>
              {saveError}
            </p>
          )}

          {/* Navigation controls */}
          <div className="mt-6 pt-5 border-t border-background-200/60 flex flex-wrap items-center gap-3">
            <button
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="px-4 py-2.5 rounded-full border border-background-200/60 text-foreground-300 text-sm font-semibold hover:bg-background-200/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i> Previous
            </button>
            <button
              onClick={onSave}
              className="px-4 py-2.5 rounded-full border border-background-200/60 text-foreground-300 text-sm font-semibold hover:bg-background-200/40 transition-colors whitespace-nowrap cursor-pointer"
            >
              Save
            </button>
            <div className="flex-1" />
            <button
              onClick={() => goTo(currentIndex + 1)}
              disabled={currentIndex === cases.length - 1}
              className="px-4 py-2.5 rounded-full border border-background-200/60 text-foreground-300 text-sm font-semibold hover:bg-background-200/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
            >
              Next <i className="ri-arrow-right-line w-4 h-4 flex items-center justify-center"></i>
            </button>
            <button
              onClick={onSaveNext}
              className="bg-accent-500 hover:bg-accent-400 text-background-950 font-semibold text-sm px-5 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer"
            >
              {currentIndex === cases.length - 1 ? 'Save & Review' : 'Save & Next'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="p-4 bg-background-50 border border-background-200/60 rounded-lg">
      <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-2xl font-heading font-bold mt-1 ${tone ?? 'text-foreground-100'}`}>{value}</p>
    </div>
  );
}

function Centered({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-14 h-14 bg-background-200/60 rounded-2xl flex items-center justify-center mb-4">
        <i className="ri-question-line text-foreground-500 text-2xl w-7 h-7 flex items-center justify-center"></i>
      </div>
      <p className="text-foreground-400 text-sm mb-4">{message}</p>
      <button
        onClick={onBack}
        className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
      >
        Back
      </button>
    </div>
  );
}