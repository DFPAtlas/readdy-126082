import type { PortfolioSummary } from '../portfolioTypes';

interface SummaryCard {
  key: string;
  label: string;
  value: number;
  icon: string;
  tone: 'neutral' | 'accent' | 'amber' | 'emerald' | 'red';
}

const toneText: Record<SummaryCard['tone'], string> = {
  neutral: 'text-foreground-50',
  accent: 'text-accent-400',
  amber: 'text-amber-400',
  emerald: 'text-emerald-400',
  red: 'text-red-400',
};

export default function PortfolioSummaryCards({ summary }: { summary: PortfolioSummary }) {
  const cards: SummaryCard[] = [
    { key: 'total', label: 'Total Projects', value: summary.total, icon: 'ri-folder-3-line', tone: 'neutral' },
    { key: 'active', label: 'Active', value: summary.active, icon: 'ri-checkbox-circle-line', tone: 'neutral' },
    { key: 'building', label: 'Building', value: summary.building, icon: 'ri-hammer-line', tone: 'accent' },
    { key: 'testing', label: 'Testing', value: summary.testing, icon: 'ri-clipboard-line', tone: 'amber' },
    { key: 'live', label: 'Live', value: summary.live, icon: 'ri-rocket-2-line', tone: 'emerald' },
    { key: 'atRisk', label: 'Blocked / At Risk', value: summary.blockedAtRisk, icon: 'ri-alert-line', tone: 'amber' },
    { key: 'critical', label: 'Critical Operations', value: summary.criticalOps, icon: 'ri-pulse-line', tone: 'red' },
    { key: 'launchReady', label: 'Launch Ready', value: summary.launchReady, icon: 'ri-rocket-line', tone: 'emerald' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {cards.map((c) => (
        <div
          key={c.key}
          className="bg-background-100 border border-background-200/60 rounded-lg p-3 min-w-0"
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <i className={`${c.icon} ${toneText[c.tone]} w-3.5 h-3.5 flex items-center justify-center`}></i>
            <span className="text-[10px] font-label text-foreground-400 uppercase tracking-wide truncate whitespace-nowrap">
              {c.label}
            </span>
          </div>
          <p className={`text-xl font-heading font-bold leading-none ${toneText[c.tone]}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}