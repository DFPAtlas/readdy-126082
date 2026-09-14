import { Link } from 'react-router-dom';
import type { UatTestCaseResult, UatTester, UatEvidence, UatFeedback, UatSession } from '@/pages/admin/website-uat/types';
import {
  RESULT_STATUS_COLORS,
  SEVERITY_COLORS,
  STATUS_COLORS,
  SESSION_STATUS_COLORS,
} from '@/pages/admin/website-uat/types';
import type { UatData, UatSummary } from '../uatTypes';
import { dedupeLatestResults } from '../uatTypes';
import { formatDate } from '../utils';

export function testerName(testers: UatTester[], id: string | null | undefined): string {
  if (!id) return 'Unknown tester';
  return testers.find((t) => t.id === id)?.full_name ?? 'Unknown tester';
}

function testCaseTitle(data: UatData, id: string | null | undefined): string {
  if (!id) return 'Untitled test case';
  const tc = data.testCases.find((x) => x.id === id);
  return tc?.title || tc?.reference || 'Untitled test case';
}

function currentRunResults(data: UatData): UatTestCaseResult[] {
  const run = data.jobs.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];
  if (!run) return [];
  const assignmentIds = new Set(data.assignments.filter((a) => a.job_id === run.id).map((a) => a.id));
  return dedupeLatestResults(data.results.filter((r) => assignmentIds.has(r.assignment_id)));
}

const RUN_STATUS_STYLES: Record<string, string> = {
  open: 'bg-sky-500/10 text-sky-400',
  in_progress: 'bg-yellow-500/10 text-yellow-400',
  completed: 'bg-emerald-500/10 text-emerald-400',
  cancelled: 'bg-foreground-500/10 text-foreground-500',
  failed: 'bg-red-500/10 text-red-400',
};

// ─── Current test run + test results ─────────────────────────────

export function UatCurrentRunPanel({ summary, data }: { summary: UatSummary; data: UatData }) {
  const run = summary.currentRun;
  if (!run) {
    return (
      <Panel title="Current Test Run" icon="ri-test-tube-line">
        <p className="text-sm text-foreground-500 py-4">No test run has been created yet.</p>
      </Panel>
    );
  }

  const results = currentRunResults(data);
  const testerCount = new Set(data.assignments.filter((a) => a.job_id === run.id).map((a) => a.tester_id)).size;

  return (
    <Panel title="Current Test Run" icon="ri-test-tube-line">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h5 className="text-sm font-semibold text-foreground-100">{run.title}</h5>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${RUN_STATUS_STYLES[run.status] || 'bg-foreground-500/10 text-foreground-500'}`}>
              {(run.status || '').replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-foreground-500 mt-1.5 flex-wrap">
            <span>Created {formatDate(run.created_at)}</span>
            {run.deadline && <span>Deadline {formatDate(run.deadline)}</span>}
            <span>{testerCount} tester{testerCount === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-500">{results.length} results</span>
          <span className={`text-xs font-semibold ${summary.passRate == null ? 'text-foreground-500' : summary.passRate >= 0.9 ? 'text-emerald-400' : summary.passRate >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
            {summary.passRate == null ? 'No completed tests' : `${Math.round(summary.passRate * 100)}% pass`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <MiniStat label="Total" value={String(summary.testsTotal)} />
        <MiniStat label="Passed" value={String(summary.testsPassed)} tone="text-emerald-400" />
        <MiniStat label="Failed" value={String(summary.testsFailed)} tone="text-red-400" />
        <MiniStat label="Blocked" value={String(summary.testsBlocked)} tone="text-orange-400" />
        <MiniStat label="Skipped" value={String(summary.testsSkipped)} />
      </div>

      {results.length === 0 ? (
        <p className="text-sm text-foreground-500 py-2">No completed test results for this run.</p>
      ) : (
        <div className="grid gap-2">
          {results.map((r) => (
            <div key={r.id} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-2.5">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${RESULT_STATUS_COLORS[r.status] || 'bg-foreground-500/10 text-foreground-500'}`}>
                      {(r.status || '').toUpperCase()}
                    </span>
                    <span className="text-sm text-foreground-200">{testCaseTitle(data, r.test_case_id)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-foreground-500 mt-1 flex-wrap">
                    <span>{testerName(data.testers, r.tester_id)}</span>
                    <span>Executed {formatDate(r.created_at)}</span>
                  </div>
                </div>
              </div>
              {r.tester_notes && <p className="text-xs text-foreground-500 mt-1.5">{r.tester_notes}</p>}
              {r.blocker_reason && (
                <p className="text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded px-2 py-1 mt-1.5">
                  Blocked: {r.blocker_reason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ─── Defects ─────────────────────────────────────────────────────

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

export function UatDefectsPanel({ data }: { data: UatData }) {
  const open = data.feedback.filter((f) => {
    const s = (f.status || '').toLowerCase();
    return !['fixed', 'closed', 'wont_fix', 'duplicate', 'resolved'].includes(s);
  });

  if (open.length === 0) {
    return (
      <Panel title="Defects" icon="ri-bug-2-line">
        <p className="text-sm text-foreground-500 py-4">No open defects.</p>
      </Panel>
    );
  }

  const grouped = SEVERITY_ORDER.map((sev) => ({
    severity: sev,
    items: open.filter((f) => (f.severity || '').toLowerCase() === sev),
  })).filter((g) => g.items.length > 0);
  const other = open.filter((f) => !SEVERITY_ORDER.includes((f.severity || '').toLowerCase()));
  if (other.length > 0) grouped.push({ severity: 'other', items: other });

  return (
    <Panel title={`Open Defects (${open.length})`} icon="ri-bug-2-line">
      <div className="grid gap-4">
        {grouped.map((g) => (
          <div key={g.severity}>
            <p className="text-xs font-semibold text-foreground-400 uppercase tracking-wide mb-2 capitalize">{g.severity}</p>
            <div className="grid gap-2">
              {g.items.map((f) => (
                <div key={f.id} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[f.severity] || 'bg-foreground-500/10 text-foreground-500'}`}>
                          {(f.severity || 'unspecified').toUpperCase()}
                        </span>
                        <span className="text-sm text-foreground-100">{f.title || 'Untitled defect'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-foreground-500 mt-1 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[f.status] || 'bg-foreground-500/10 text-foreground-500'}`}>
                          {(f.status || '').replace('_', ' ')}
                        </span>
                        <span>{testerName(data.testers, f.tester_id)}</span>
                        <span>Reported {formatDate(f.created_at)}</span>
                        {(f.evidence_count ?? 0) > 0 && <span className="text-emerald-400">Evidence available</span>}
                      </div>
                    </div>
                    <Link
                      to="/admin/website-uat?tab=defects"
                      className="text-[11px] text-accent-400 hover:text-accent-300 whitespace-nowrap no-underline"
                    >
                      View Defect
                    </Link>
                  </div>
                  {f.description && <p className="text-xs text-foreground-500 mt-1.5 line-clamp-2">{f.description}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── Evidence ────────────────────────────────────────────────────

export function UatEvidencePanel({ data }: { data: UatData }) {
  const evidence = data.evidence;
  return (
    <Panel title={`Evidence (${evidence.length})`} icon="ri-camera-line">
      {evidence.length === 0 ? (
        <p className="text-sm text-foreground-500 py-4">No evidence recorded.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {evidence.map((e) => (
            <div key={e.id} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <i className="ri-attachment-2 w-4 h-4 flex items-center justify-center text-foreground-400"></i>
                <span className="text-sm text-foreground-200 truncate flex-1">{e.file_name || e.original_filename || 'Evidence'}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-foreground-500 mt-1 flex-wrap">
                <span className="capitalize">{e.evidence_type || 'attachment'}</span>
                <span>{testerName(data.testers, e.tester_id)}</span>
                <span>{formatDate(e.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ─── Reports ─────────────────────────────────────────────────────

export function UatReportsPanel({ data }: { data: UatData }) {
  const reports = data.reports;
  return (
    <Panel title="UAT Reports" icon="ri-file-chart-line">
      {reports.length === 0 ? (
        <p className="text-sm text-foreground-500 py-4">No UAT reports generated.</p>
      ) : (
        <div className="grid gap-2">
          {reports.map((r) => {
            const name = r.name || r.title || r.reference || 'UAT report';
            const score = typeof r.go_no_go_score === 'number' ? r.go_no_go_score : null;
            return (
              <div key={r.id} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-2.5">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <h5 className="text-sm text-foreground-100">{name}</h5>
                    <div className="flex items-center gap-3 text-[11px] text-foreground-500 mt-1 flex-wrap">
                      {r.created_at && <span>{formatDate(r.created_at)}</span>}
                      {r.recommendation && <span className="capitalize">{r.recommendation}</span>}
                      {score != null && <span className="text-foreground-400">Score {score}</span>}
                      {r.generated_by && <span>by {r.generated_by}</span>}
                    </div>
                  </div>
                  {r.recommendation && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${(r.recommendation || '').toLowerCase() === 'go' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {String(r.recommendation).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ─── Tester activity ─────────────────────────────────────────────

export function UatTesterActivityPanel({ data }: { data: UatData }) {
  const sessions = data.sessions;
  if (sessions.length === 0 && data.feedback.length === 0 && data.results.length === 0) {
    return (
      <Panel title="Tester Activity" icon="ri-user-star-line">
        <p className="text-sm text-foreground-500 py-4">No tester activity recorded.</p>
      </Panel>
    );
  }

  const testerIds = Array.from(new Set(sessions.map((s) => s.tester_id).filter(Boolean))) as string[];
  if (testerIds.length === 0) {
    return (
      <Panel title="Tester Activity" icon="ri-user-star-line">
        <p className="text-sm text-foreground-500 py-4">No tester sessions recorded.</p>
      </Panel>
    );
  }

  const completedStatuses = new Set(['passed', 'failed', 'blocked', 'skipped', 'needs_retest']);

  return (
    <Panel title={`Tester Activity (${testerIds.length})`} icon="ri-user-star-line">
      <div className="grid gap-2">
        {testerIds.map((tid) => {
          const testerSessions = sessions.filter((s) => s.tester_id === tid);
          const lastSession = testerSessions.slice().sort((a, b) => (b.last_activity_at || b.updated_at || b.created_at || '').localeCompare(a.last_activity_at || a.updated_at || a.created_at || ''))[0];
          const testsCompleted = data.results.filter((r) => r.tester_id === tid && completedStatuses.has(r.status)).length;
          const defectsRaised = data.feedback.filter((f) => f.tester_id === tid).length;
          return (
            <div key={tid} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-2.5">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <h5 className="text-sm font-semibold text-foreground-100">{testerName(data.testers, tid)}</h5>
                  <div className="flex items-center gap-3 text-[11px] text-foreground-500 mt-1 flex-wrap">
                    <span>{testerSessions.length} session{testerSessions.length === 1 ? '' : 's'}</span>
                    <span>{testsCompleted} test{testsCompleted === 1 ? '' : 's'} completed</span>
                    <span>{defectsRaised} defect{defectsRaised === 1 ? '' : 's'} raised</span>
                  </div>
                </div>
                {lastSession && (
                  <div className="text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${SESSION_STATUS_COLORS[lastSession.status] || 'bg-foreground-500/10 text-foreground-500'}`}>
                      {(lastSession.status || '').replace('_', ' ')}
                    </span>
                    <p className="text-[11px] text-foreground-500 mt-1">Last {formatDate(lastSession.last_activity_at || lastSession.updated_at || lastSession.created_at)}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ─── Shared building blocks ──────────────────────────────────────

function Panel({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-5">
      <h4 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">
        <i className={`${icon} w-4 h-4 flex items-center justify-center text-foreground-400`}></i>
        {title}
      </h4>
      {children}
    </section>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg px-2.5 py-2">
      <p className="text-[10px] font-label text-foreground-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm font-heading font-bold ${tone || 'text-foreground-100'}`}>{value}</p>
    </div>
  );
}