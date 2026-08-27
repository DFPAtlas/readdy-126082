import type { ToolConnection } from '@/pages/ai-operations/types';

const GROUP_META = {
  green: { label: 'Green', tone: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', icon: 'ri-checkbox-circle-line' },
  amber: { label: 'Amber', tone: 'bg-amber-500/10 text-amber-400 border-amber-500/25', icon: 'ri-alert-line' },
  red: { label: 'Red / Restricted', tone: 'bg-red-500/10 text-red-400 border-red-500/25', icon: 'ri-close-circle-line' },
} as const;

export default function AllowedOperations({ connection }: { connection: ToolConnection }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Allowed Operations</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {connection.operationGroups.map((group) => {
          const meta = GROUP_META[group.riskClass];
          return (
            <div key={group.riskClass} className={`rounded-lg border p-3 ${meta.tone}`}>
              <div className="flex items-center gap-2 mb-2">
                <i className={`${meta.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
                <span className="text-xs font-label font-semibold uppercase tracking-wide">{meta.label}</span>
              </div>
              <ul className="space-y-1.5">
                {group.operations.map((op) => (
                  <li key={op} className="flex items-start gap-1.5 text-xs text-foreground-300">
                    <span className="mt-1 w-1 h-1 rounded-full bg-current shrink-0"></span>
                    {op}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] font-label text-foreground-600 mt-3">No operations execute — this is an access-control reference only.</p>
    </section>
  );
}