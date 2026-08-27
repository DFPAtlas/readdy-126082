import { Link } from 'react-router-dom';
import { readinessModules } from '@/mocks/ai-operations-readiness';
import { READINESS_STATUS } from '@/pages/ai-operations/readiness/readinessStatus';
import Section from '@/pages/ai-operations/readiness/components/Section';

const COLUMNS = [
  { key: 'frontend', label: 'Frontend' },
  { key: 'dataContract', label: 'Data Contract' },
  { key: 'database', label: 'Database' },
  { key: 'integration', label: 'Integration' },
  { key: 'security', label: 'Security' },
  { key: 'liveData', label: 'Live Data' },
  { key: 'execution', label: 'Execution' },
] as const;

function Cell({ status }: { status: (typeof readinessModules)[number]['overall'] }) {
  const { tone, label } = READINESS_STATUS[status];
  const toneStyles: Record<string, string> = {
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    red: 'bg-red-500/15 text-red-400 border-red-500/25',
    accent: 'bg-accent-500/15 text-accent-400 border-accent-500/25',
    secondary: 'bg-secondary-500/15 text-secondary-300 border-secondary-500/25',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-label whitespace-nowrap border ${toneStyles[tone]}`}>
      {label}
    </span>
  );
}

export default function ModuleReadinessMatrix() {
  return (
    <Section
      icon="ri-grid-line"
      title="Module Readiness Matrix"
      subtitle="Per-module status across frontend, data contract, database, integration, security, live data and execution."
    >
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-[11px] font-label uppercase tracking-wide text-foreground-500 border-b border-background-200/60">
              <th className="py-2 pr-4 font-semibold">Module</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="py-2 pr-3 font-semibold whitespace-nowrap">{c.label}</th>
              ))}
              <th className="py-2 font-semibold">Overall Status</th>
            </tr>
          </thead>
          <tbody>
            {readinessModules.map((m) => (
              <tr key={m.id} className="border-b border-background-200/40 last:border-0 hover:bg-background-50/50 transition-colors">
                <td className="py-2.5 pr-4">
                  <Link to={m.route} className="text-foreground-100 font-label font-medium hover:text-accent-400 transition-colors whitespace-nowrap">
                    {m.module}
                  </Link>
                </td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className="py-2.5 pr-3">
                    <Cell status={m[c.key]} />
                  </td>
                ))}
                <td className="py-2.5">
                  <Cell status={m.overall} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden mt-3 space-y-3">
        {readinessModules.map((m) => (
          <div key={m.id} className="border border-background-200/60 rounded-lg p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <Link to={m.route} className="text-sm font-label font-semibold text-foreground-100">{m.module}</Link>
              <Cell status={m.overall} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COLUMNS.map((c) => (
                <span key={c.key} className="inline-flex items-center gap-1 text-[11px] text-foreground-500">
                  <span className="text-foreground-600">{c.label}:</span>
                  <Cell status={m[c.key]} />
                </span>
              ))}
            </div>
            {m.notes && <p className="text-xs text-foreground-600 mt-2">{m.notes}</p>}
          </div>
        ))}
      </div>
    </Section>
  );
}