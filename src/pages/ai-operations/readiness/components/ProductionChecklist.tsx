import { useMemo } from 'react';
import { checklistItems } from '@/mocks/ai-operations-readiness-2';
import Section from '@/pages/ai-operations/readiness/components/Section';

const CATEGORY_ICONS: Record<string, string> = {
  Database: 'ri-database-2-line',
  Security: 'ri-shield-keyhole-line',
  Infrastructure: 'ri-server-line',
  Agents: 'ri-robot-2-line',
  Tools: 'ri-plug-2-line',
  Models: 'ri-cpu-line',
  Knowledge: 'ri-book-2-line',
  Monitoring: 'ri-radar-line',
  Approvals: 'ri-shield-check-line',
  Audit: 'ri-file-list-3-line',
  UAT: 'ri-flask-line',
  Notifications: 'ri-notification-3-line',
  'Cost controls': 'ri-money-pound-circle-line',
  Recovery: 'ri-rewind-line',
};

export default function ProductionChecklist() {
  const grouped = useMemo(() => {
    const map = new Map<string, typeof checklistItems>();
    checklistItems.forEach((item) => {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    });
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }, []);

  return (
    <Section
      icon="ri-checkbox-multiple-line"
      title="Production Checklist"
      subtitle="Required items, ownership and blockers across all workstreams."
    >
      <div className="space-y-5">
        {grouped.map(({ category, items }) => (
          <div key={category}>
            <h3 className="flex items-center gap-2 text-xs font-label font-semibold uppercase tracking-wide text-foreground-500 mb-2">
              <i className={`${CATEGORY_ICONS[category] ?? 'ri-list-check-3'} text-foreground-500 text-sm w-4 h-4 flex items-center justify-center`}></i>
              {category}
            </h3>
            <div className="space-y-1.5">
              {items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 border border-background-200/50 rounded-lg px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-foreground-100">{item.item}</span>
                      {item.blocker && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-label text-red-400 bg-red-500/10 rounded-full px-2 py-0.5">
                          <i className="ri-error-warning-line text-xs w-3 h-3 flex items-center justify-center"></i>Blocker
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-foreground-500 mt-0.5">{item.owner} · {item.notes}</p>
                  </div>
                  <span className="text-[11px] font-label text-foreground-600 whitespace-nowrap capitalize">{item.status.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}