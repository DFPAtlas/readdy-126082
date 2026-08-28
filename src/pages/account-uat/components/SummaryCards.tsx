import { formatMinorCurrency } from '@/pages/admin/website-uat/marketplace';
import type { EarningsSummary } from '../hooks';

interface Props {
  available: number;
  active: number;
  review: number;
  completed: number;
  earnings: EarningsSummary;
  currency: string;
  onSelect: (tab: string) => void;
}

interface Stat {
  tab: string;
  label: string;
  value: string;
  icon: string;
  accent: string;
}

export default function SummaryCards({
  available,
  active,
  review,
  completed,
  earnings,
  currency,
  onSelect,
}: Props) {
  const testStats: Stat[] = [
    { tab: 'available', label: 'Available Tests', value: String(available), icon: 'ri-compass-3-line', accent: 'bg-accent-500/10 text-accent-400' },
    { tab: 'active', label: 'Active Tests', value: String(active), icon: 'ri-play-circle-line', accent: 'bg-emerald-500/10 text-emerald-400' },
    { tab: 'review', label: 'Awaiting Review', value: String(review), icon: 'ri-time-line', accent: 'bg-amber-500/10 text-amber-400' },
    { tab: 'completed', label: 'Completed Tests', value: String(completed), icon: 'ri-check-double-line', accent: 'bg-sky-500/10 text-sky-400' },
  ];

  const earningStats: Stat[] = [
    { tab: 'earnings', label: 'Pending Review', value: formatMinorCurrency(earnings.pendingMinor, currency), icon: 'ri-time-line', accent: 'bg-amber-500/10 text-amber-400' },
    { tab: 'earnings', label: 'Approved', value: formatMinorCurrency(earnings.approvedMinor, currency), icon: 'ri-check-line', accent: 'bg-emerald-500/10 text-emerald-400' },
    { tab: 'earnings', label: 'Paid', value: formatMinorCurrency(earnings.paidMinor, currency), icon: 'ri-bank-card-line', accent: 'bg-sky-500/10 text-sky-400' },
    { tab: 'earnings', label: 'Total Earned', value: formatMinorCurrency(earnings.totalMinor, currency), icon: 'ri-money-pound-circle-line', accent: 'bg-secondary-500/10 text-secondary-300' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {testStats.map((s) => (
          <StatCard key={s.label} stat={s} onSelect={onSelect} />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {earningStats.map((s) => (
          <StatCard key={s.label} stat={s} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function StatCard({ stat, onSelect }: { stat: Stat; onSelect: (tab: string) => void }) {
  return (
    <button
      onClick={() => onSelect(stat.tab)}
      className="bg-background-100 border border-background-200/60 rounded-lg p-4 text-left hover:border-background-300/60 transition-colors duration-150 cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{stat.label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.accent}`}>
          <i className={`${stat.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
        </div>
      </div>
      <p className="text-2xl font-heading font-bold text-foreground-100 truncate">{stat.value}</p>
    </button>
  );
}