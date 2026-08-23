import type { SummaryCounts } from '../hooks';

export type SummaryCardKey =
  | 'new'
  | 'active'
  | 'waiting'
  | 'overdue'
  | 'resolvedToday'
  | 'unassigned';

interface SummaryCardsProps {
  counts: SummaryCounts;
  selected: SummaryCardKey | null;
  onSelect: (key: SummaryCardKey | null) => void;
}

interface CardDef {
  key: SummaryCardKey;
  label: string;
  value: number;
  icon: string;
  accent: string;
}

export default function SummaryCards({ counts, selected, onSelect }: SummaryCardsProps) {
  const cards: CardDef[] = [
    { key: 'new', label: 'New', value: counts.newCount, icon: 'ri-mail-unread-line', accent: 'text-accent-400' },
    { key: 'active', label: 'Open & In Progress', value: counts.activeCount, icon: 'ri-loader-4-line', accent: 'text-primary-400' },
    { key: 'waiting', label: 'Waiting on Customer', value: counts.waitingCount, icon: 'ri-time-line', accent: 'text-yellow-400' },
    { key: 'overdue', label: 'Overdue', value: counts.overdueCount, icon: 'ri-alarm-warning-line', accent: 'text-orange-400' },
    { key: 'resolvedToday', label: 'Resolved Today', value: counts.resolvedTodayCount, icon: 'ri-check-double-line', accent: 'text-emerald-400' },
    { key: 'unassigned', label: 'Unassigned', value: counts.unassignedCount, icon: 'ri-user-line', accent: 'text-foreground-400' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4" role="group" aria-label="Ticket summary">
      {cards.map((card) => {
        const isSelected = selected === card.key;
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onSelect(isSelected ? null : card.key)}
            aria-pressed={isSelected}
            className={`text-left bg-background-100 border rounded-lg p-3 md:p-4 transition-colors duration-150 cursor-pointer whitespace-nowrap ${
              isSelected
                ? 'border-accent-500/60 ring-1 ring-accent-500/40'
                : 'border-background-200/60 hover:border-background-300/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-label text-foreground-500 uppercase tracking-wider whitespace-nowrap">
                {card.label}
              </span>
              <i className={`${card.icon} ${card.accent} text-base w-5 h-5 flex items-center justify-center`}></i>
            </div>
            <p className="text-2xl font-heading font-bold text-foreground-50 mt-1.5">{card.value}</p>
          </button>
        );
      })}
    </div>
  );
}