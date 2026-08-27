import type { ApprovalStatus } from '@/pages/ai-operations/types';

const STAGES = ['DIAGNOSE', 'RECOMMEND', 'HUMAN APPROVAL', 'EXECUTE', 'VERIFY', 'UAT', 'AUDIT', 'CLOSE'];

// Map a status to the index of the "current" stage (0-based), or -1 when the
// workflow has stopped before reaching approval.
function currentIndex(status: ApprovalStatus): number {
  switch (status) {
    case 'draft':
    case 'pending':
    case 'under_review':
    case 'more_info_required':
      return 2; // HUMAN APPROVAL
    case 'approved':
    case 'approved_with_conditions':
      return 3; // EXECUTE (pending)
    case 'executing':
      return 3; // EXECUTE
    case 'verification_required':
      return 4; // VERIFY
    case 'uat_required':
      return 5; // UAT
    case 'completed':
      return 7; // CLOSE
    case 'failed':
    case 'rejected':
    case 'cancelled':
    case 'expired':
      return 2; // stopped at HUMAN APPROVAL
    default:
      return 2;
  }
}

function isStopped(status: ApprovalStatus): boolean {
  return ['rejected', 'cancelled', 'expired', 'failed'].includes(status);
}

export default function WorkflowStage({ status }: { status: ApprovalStatus }) {
  const current = currentIndex(status);
  const stopped = isStopped(status);

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Post-Approval Workflow</h3>
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-y-3">
          {STAGES.map((stage, i) => {
            const isCurrent = i === current;
            const isDone = i < current;
            const isFuture = i > current;
            return (
              <div key={stage} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    className={`px-2.5 py-1 rounded-md text-[10px] font-label whitespace-nowrap border ${
                      isCurrent
                        ? 'bg-accent-500/15 text-accent-400 border-accent-500/30'
                        : isDone
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-background-200/40 text-foreground-600 border-background-300/40'
                    }`}
                  >
                    {stage}
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-accent-400' : isDone ? 'bg-emerald-400' : 'bg-background-300'}`}></span>
                </div>
                {i < STAGES.length - 1 && (
                  <i className="ri-arrow-down-line text-foreground-600 mx-1 text-xs w-4 h-4 flex items-center justify-center rotate-[-90deg] sm:rotate-0"></i>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-background-200/40">
          {stopped ? (
            <p className="text-xs font-label text-red-400">Workflow stopped at HUMAN APPROVAL ({status.replace(/_/g, ' ')}).</p>
          ) : current === 3 || current === 4 || current === 5 ? (
            <p className="text-xs font-label text-accent-400">Execution Pending — no production execution has occurred.</p>
          ) : current === 7 ? (
            <p className="text-xs font-label text-emerald-400">Workflow complete.</p>
          ) : (
            <p className="text-xs font-label text-foreground-500">Awaiting human decision.</p>
          )}
        </div>
      </div>
    </section>
  );
}