import { mockDataAudit } from '@/mocks/ai-operations-readiness';
import { READINESS_STATUS } from '@/pages/ai-operations/readiness/readinessStatus';
import Section from '@/pages/ai-operations/readiness/components/Section';

function Pill({ status }: { status: (typeof mockDataAudit)[number]['status'] }) {
  const { tone, label } = READINESS_STATUS[status];
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    red: 'bg-red-500/15 text-red-400 border-red-500/25',
    accent: 'bg-accent-500/15 text-accent-400 border-accent-500/25',
    secondary: 'bg-secondary-500/15 text-secondary-300 border-secondary-500/25',
  };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-label whitespace-nowrap border ${tones[tone]}`}>{label}</span>;
}

export default function MockDataAudit() {
  return (
    <Section
      icon="ri-arrow-right-line"
      title="Demo → Production Data Migration"
      subtitle="Each existing mock source, its production replacement and migration priority. No mock data is removed."
    >
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="text-left text-[11px] font-label uppercase tracking-wide text-foreground-500 border-b border-background-200/60">
              <th className="py-2 pr-4 font-semibold">Mock Source</th>
              <th className="py-2 pr-3 font-semibold">Module</th>
              <th className="py-2 pr-3 font-semibold">Production Replacement</th>
              <th className="py-2 pr-3 font-semibold">Priority</th>
              <th className="py-2 pr-3 font-semibold">Can Remain Fallback</th>
              <th className="py-2 pr-3 font-semibold">Required Tables / API</th>
              <th className="py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {mockDataAudit.map((m) => (
              <tr key={m.mockSource} className="border-b border-background-200/40 last:border-0 hover:bg-background-50/50 transition-colors">
                <td className="py-2.5 pr-4 font-mono text-xs text-foreground-300 whitespace-nowrap">{m.mockSource}</td>
                <td className="py-2.5 pr-3 text-foreground-100 whitespace-nowrap">{m.module}</td>
                <td className="py-2.5 pr-3 text-foreground-300">{m.productionReplacement}</td>
                <td className="py-2.5 pr-3">
                  <span className="text-[11px] font-label uppercase text-foreground-500">{m.migrationPriority}</span>
                </td>
                <td className="py-2.5 pr-3">
                  {m.canRemainAsFallback ? (
                    <i className="ri-check-line text-emerald-400 text-sm w-4 h-4 flex items-center justify-center"></i>
                  ) : (
                    <i className="ri-close-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center"></i>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-xs text-foreground-500">{m.requiredTablesApi}</td>
                <td className="py-2.5"><Pill status={m.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}