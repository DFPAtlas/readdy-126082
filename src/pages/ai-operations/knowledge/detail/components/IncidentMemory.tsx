import { Link } from 'react-router-dom';
import type { IncidentMemory as IncidentMemoryType } from '@/pages/ai-operations/types';

export default function IncidentMemory({ memory }: { memory: IncidentMemoryType }) {
  const rows = [
    { label: 'Incident ID', value: memory.incidentId, mono: true },
    { label: 'Site', value: memory.site },
    { label: 'Problem', value: memory.problem },
    { label: 'Root cause summary', value: memory.rootCauseSummary },
    { label: 'Resolution', value: memory.resolution },
    { label: 'Verification result', value: memory.verificationResult },
    { label: 'UAT result', value: memory.uatResult },
    { label: 'Date resolved', value: memory.dateResolved },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Incident Memory</h3>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">
          <i className="ri-history-line text-xs w-3.5 h-3.5 flex items-center justify-center text-accent-400"></i>
          Known Issue / Previous Incident
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {rows.map((r) => (
          <div key={r.label} className={`flex items-start justify-between gap-3 border-b border-background-200/40 pb-2 ${r.label === 'Problem' || r.label === 'Root cause summary' || r.label === 'Resolution' ? 'sm:col-span-2' : ''}`}>
            <span className="text-xs font-label text-foreground-600 whitespace-nowrap shrink-0">{r.label}</span>
            <span className={`text-sm text-foreground-200 text-right ${r.mono ? 'font-mono' : ''}`}>{r.value}</span>
          </div>
        ))}
      </div>

      {memory.relatedRunId && (
        <div className="mt-4 flex items-center gap-2">
          <Link
            to={`/ai-operations/runs/${memory.relatedRunId}`}
            className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            {memory.relatedRunId}
            <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
          </Link>
        </div>
      )}

      <p className="text-[11px] font-label text-foreground-600 mt-3">
        Helps Diagnostics and Support agents identify repeated problems. Safe demo summary only.
      </p>
    </section>
  );
}