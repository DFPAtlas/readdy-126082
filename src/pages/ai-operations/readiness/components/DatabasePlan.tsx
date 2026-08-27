import { useMemo } from 'react';
import { databasePlan } from '@/mocks/ai-operations-readiness';
import Section from '@/pages/ai-operations/readiness/components/Section';

const DOMAINS = ['Core', 'Runs', 'Governance', 'Tools / Models', 'Knowledge', 'Operations', 'Cost'];

function Flag({ value }: { value: boolean }) {
  return value ? (
    <i className="ri-check-line text-emerald-400 text-sm w-4 h-4 flex items-center justify-center"></i>
  ) : (
    <i className="ri-close-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center"></i>
  );
}

export default function DatabasePlan() {
  const grouped = useMemo(() => {
    const map = new Map<string, typeof databasePlan>();
    DOMAINS.forEach((d) => map.set(d, []));
    databasePlan.forEach((item) => {
      const arr = map.get(item.domain) ?? [];
      arr.push(item);
      map.set(item.domain, arr);
    });
    return Array.from(map.entries()).map(([domain, items]) => ({ domain, items }));
  }, []);

  return (
    <Section
      icon="ri-database-2-line"
      title="Supabase Data Model Plan"
      subtitle="Proposed tables grouped by domain. Planning only — no tables are created."
    >
      <div className="space-y-5">
        {grouped.map(({ domain, items }) => (
          <div key={domain}>
            <h3 className="text-xs font-label font-semibold uppercase tracking-wide text-foreground-500 mb-2">
              {domain} <span className="text-foreground-600 font-normal normal-case">({items.length} tables)</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="text-left text-[11px] font-label uppercase tracking-wide text-foreground-500 border-b border-background-200/60">
                    <th className="py-1.5 pr-4 font-semibold">Table</th>
                    <th className="py-1.5 pr-3 font-semibold">Purpose</th>
                    <th className="py-1.5 pr-3 font-semibold">Priority</th>
                    <th className="py-1.5 pr-3 font-semibold">Dependencies</th>
                    <th className="py-1.5 pr-3 font-semibold">RLS</th>
                    <th className="py-1.5 pr-3 font-semibold">Audit</th>
                    <th className="py-1.5 font-semibold">State</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => (
                    <tr key={t.id} className="border-b border-background-200/30 last:border-0 hover:bg-background-50/50 transition-colors">
                      <td className="py-2 pr-4 font-mono text-xs text-accent-400 whitespace-nowrap">{t.table}</td>
                      <td className="py-2 pr-3 text-foreground-300 text-xs">{t.purpose}</td>
                      <td className="py-2 pr-3 text-[11px] font-label uppercase text-foreground-500">{t.priority}</td>
                      <td className="py-2 pr-3 text-xs text-foreground-500">{t.dependencies}</td>
                      <td className="py-2 pr-3"><Flag value={t.rlsRequired} /></td>
                      <td className="py-2 pr-3"><Flag value={t.auditRequired} /></td>
                      <td className="py-2 text-xs text-foreground-500 capitalize">{t.state.replace('_', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}