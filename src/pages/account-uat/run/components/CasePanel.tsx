import type { UatJob } from '@/pages/admin/website-uat/types';
import type { RunnerCase, Draft, EvidenceItem } from '../lib';
import { requiresNotesOnFail, requiresScreenshotOnFail } from '../lib';
import EvidenceUpload from './EvidenceUpload';

interface Props {
  caseItem: RunnerCase;
  draft: Draft;
  evidence: EvidenceItem[];
  job: UatJob | null;
  assignmentId: string;
  sessionId: string | null;
  disabled: boolean;
  evidenceHint: string;
  onDraftChange: (d: Draft) => void;
  onEvidenceChange: (e: EvidenceItem[]) => void;
}

const RESULT_OPTIONS: { value: 'passed' | 'failed' | 'blocked'; label: string; icon: string; activeClass: string }[] = [
  { value: 'passed', label: 'PASS', icon: 'ri-check-line', activeClass: 'bg-emerald-500 text-background-950 border-emerald-500' },
  { value: 'failed', label: 'FAIL', icon: 'ri-close-line', activeClass: 'bg-red-500 text-background-950 border-red-500' },
  { value: 'blocked', label: 'BLOCKED', icon: 'ri-forbid-2-line', activeClass: 'bg-orange-500 text-background-950 border-orange-500' },
];

export default function CasePanel({
  caseItem,
  draft,
  evidence,
  job,
  assignmentId,
  sessionId,
  disabled,
  evidenceHint,
  onDraftChange,
  onEvidenceChange,
}: Props) {
  const notesOnFail = requiresNotesOnFail(job);
  const screenshotOnFail = requiresScreenshotOnFail(job);

  const set = (patch: Partial<Draft>) => onDraftChange({ ...draft, ...patch });

  return (
    <div className="space-y-6">
      {/* Case content */}
      <div className="space-y-4">
        <div className="flex items-start gap-2 flex-wrap">
          <h2 className="font-heading text-lg font-semibold text-foreground-50">{caseItem.title || 'Untitled case'}</h2>
          {caseItem.reference && (
            <span className="text-[11px] font-label px-2 py-0.5 rounded-full bg-secondary-500/10 text-secondary-300 whitespace-nowrap">
              {caseItem.reference}
            </span>
          )}
        </div>

        {caseItem.description && (
          <div>
            <h3 className="text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1">Objective</h3>
            <p className="text-sm text-foreground-300 leading-relaxed whitespace-pre-wrap">{caseItem.description}</p>
          </div>
        )}

        {caseItem.preconditions && (
          <div>
            <h3 className="text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1">Preconditions</h3>
            <p className="text-sm text-foreground-300 leading-relaxed whitespace-pre-wrap">{caseItem.preconditions}</p>
          </div>
        )}

        {caseItem.steps.length > 0 && (
          <div>
            <h3 className="text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1">Steps</h3>
            <ol className="space-y-1.5">
              {caseItem.steps.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-foreground-300 leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-background-200/60 text-foreground-400 text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div>
          <h3 className="text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1">Expected result</h3>
          <p className="text-sm text-foreground-300 leading-relaxed whitespace-pre-wrap">{caseItem.expectedResult || '—'}</p>
        </div>
      </div>

      {/* Result */}
      <div className="border-t border-background-200/60 pt-5">
        <h3 className="text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-3">Your result</h3>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {RESULT_OPTIONS.map((opt) => {
            const active = draft.status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => set({ status: opt.value })}
                disabled={disabled}
                aria-pressed={active}
                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg border text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
                  active ? opt.activeClass : 'bg-background-50 border-background-200/60 text-foreground-300 hover:border-foreground-400'
                }`}
              >
                <i className={`${opt.icon} text-lg w-5 h-5 flex items-center justify-center`}></i>
                {opt.label}
              </button>
            );
          })}
        </div>

        {draft.status === 'failed' && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-label text-foreground-500 uppercase tracking-wide block mb-1">
                Actual result <span className="text-red-400">*</span>
              </label>
              <textarea
                value={draft.actualResult}
                onChange={(e) => set({ actualResult: e.target.value })}
                disabled={disabled}
                rows={3}
                maxLength={2000}
                className="w-full bg-background-50 border border-background-200/60 rounded-md px-3 py-2 text-sm text-foreground-200 focus:outline-none focus:border-accent-400 resize-y"
                placeholder="Describe what actually happened when you ran the test…"
              />
            </div>
            <div>
              <label className="text-xs font-label text-foreground-500 uppercase tracking-wide block mb-1">
                Notes {notesOnFail && <span className="text-red-400">*</span>}
              </label>
              <textarea
                value={draft.notes}
                onChange={(e) => set({ notes: e.target.value })}
                disabled={disabled}
                rows={2}
                maxLength={2000}
                className="w-full bg-background-50 border border-background-200/60 rounded-md px-3 py-2 text-sm text-foreground-200 focus:outline-none focus:border-accent-400 resize-y"
                placeholder={notesOnFail ? 'Notes are required when marking a case as FAIL.' : 'Optional notes'}
              />
            </div>
          </div>
        )}

        {draft.status === 'blocked' && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-label text-foreground-500 uppercase tracking-wide block mb-1">
                Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={draft.blockerReason}
                onChange={(e) => set({ blockerReason: e.target.value })}
                disabled={disabled}
                rows={2}
                maxLength={2000}
                className="w-full bg-background-50 border border-background-200/60 rounded-md px-3 py-2 text-sm text-foreground-200 focus:outline-none focus:border-accent-400 resize-y"
                placeholder="Why is this case blocked?"
              />
            </div>
            <div>
              <label className="text-xs font-label text-foreground-500 uppercase tracking-wide block mb-1">Notes</label>
              <textarea
                value={draft.notes}
                onChange={(e) => set({ notes: e.target.value })}
                disabled={disabled}
                rows={2}
                maxLength={2000}
                className="w-full bg-background-50 border border-background-200/60 rounded-md px-3 py-2 text-sm text-foreground-200 focus:outline-none focus:border-accent-400 resize-y"
                placeholder="Optional notes"
              />
            </div>
          </div>
        )}

        {draft.status === 'passed' && (
          <div className="mt-4">
            <label className="text-xs font-label text-foreground-500 uppercase tracking-wide block mb-1">Notes</label>
            <textarea
              value={draft.notes}
              onChange={(e) => set({ notes: e.target.value })}
              disabled={disabled}
              rows={2}
              maxLength={2000}
              className="w-full bg-background-50 border border-background-200/60 rounded-md px-3 py-2 text-sm text-foreground-200 focus:outline-none focus:border-accent-400 resize-y"
              placeholder="Optional notes"
            />
          </div>
        )}

        {/* Evidence */}
        <div className="mt-5">
          {screenshotOnFail && draft.status === 'failed' && evidenceHint && (
            <p className="text-xs text-amber-400 mb-2 flex items-center gap-1.5">
              <i className="ri-alert-line w-4 h-4 flex items-center justify-center"></i>
              {evidenceHint}
            </p>
          )}
          <EvidenceUpload
            assignmentId={assignmentId}
            sessionId={sessionId}
            atcId={caseItem.atcId}
            evidence={evidence}
            disabled={disabled}
            onChange={onEvidenceChange}
          />
        </div>
      </div>
    </div>
  );
}