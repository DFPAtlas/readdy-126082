import type { WorkstreamSummary as Summary } from '../workstreamUtils';

interface WorkstreamSummaryProps {
  summary: Summary;
}

export default function WorkstreamSummary({ summary }: WorkstreamSummaryProps) {
  const cells: { label: string; value: number; icon: string; tone: string }[] = [
    { label: 'Critical Bugs', value: summary.criticalBugs, icon: 'ri-alert-line', tone: summary.criticalBugs > 0 ? 'text-red-400' : 'text-emerald-400' },
    { label: 'UAT Defects', value: summary.uatDefects, icon: 'ri-bug-2-line', tone: summary.uatDefects > 0 ? 'text-violet-400' : 'text-emerald-400' },
    { label: 'Build Blockers', value: summary.buildBlockers, icon: 'ri-forbid-line', tone: summary.buildBlockers > 0 ? 'text-orange-400' : 'text-emerald-400' },
    { label: 'Approved Changes', value: summary.approvedChanges, icon: 'ri-git-pull-request-line', tone: summary.approvedChanges > 0 ? 'text-sky-400' : 'text-emerald-400' },
    { label: 'Ready for Retest', value: summary.readyForRetest, icon: 'ri-refresh-line', tone: summary.readyForRetest > 0 ? 'text-violet-400' : 'text-emerald-400' },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-5">
      <h4 className="flex items-center gap-2 text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">
        <i className="ri-stack-line w-4 h-4 flex items-center justify-center text-foreground-400"></i>
        Project Workstream
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {cells.map((c) => (
          <div key={c.label} className="bg-background-50 border border-background-200/60 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <i className={`${c.icon} ${c.tone} w-3.5 h-3.5 flex items-center justify-center`}></i>
              <span className="text-[10px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{c.label}</span>
            </div>
            <span className={`text-lg font-heading font-bold ${c.tone}`}>{c.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}