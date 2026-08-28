import type { RuntimeHealthSweep } from '@/lib/ai-operations/runtimeHealth';

interface HealthKpisProps {
  sweep: RuntimeHealthSweep | null;
  checkedCount: number;
}

function formatTime(iso: string | undefined): string {
  if (!iso) return 'Not checked';
  return new Date(iso).toLocaleTimeString('en-US', { hour12: false });
}

export default function HealthKpis({ sweep, checkedCount }: HealthKpisProps) {
  const counts = sweep?.counts ?? {};
  const healthy = counts.healthy ?? 0;
  const degraded = counts.degraded ?? 0;
  const unavailable = counts.unavailable ?? 0;
  const notConfigured = counts.not_configured ?? 0;
  const notTestable = counts.not_testable ?? 0;

  const cards = [
    { label: 'Connections Checked', value: String(checkedCount), icon: 'ri-radar-line', tone: 'text-foreground-100', sub: 'testable targets' },
    { label: 'Healthy', value: String(healthy), icon: 'ri-checkbox-circle-line', tone: 'text-emerald-400', sub: 'reachable & verified' },
    { label: 'Degraded', value: String(degraded), icon: 'ri-timer-line', tone: 'text-amber-400', sub: 'slow / partial' },
    { label: 'Unavailable', value: String(unavailable), icon: 'ri-close-circle-line', tone: 'text-red-400', sub: 'not reachable' },
    { label: 'Not Configured', value: String(notConfigured), icon: 'ri-settings-4-line', tone: 'text-secondary-300', sub: 'no credentials' },
    { label: 'Not Testable', value: String(notTestable), icon: 'ri-prohibited-2-line', tone: 'text-secondary-300', sub: 'no safe check' },
    { label: 'Last Health Sweep', value: formatTime(sweep?.checkedAt), icon: 'ri-time-line', tone: 'text-foreground-100', sub: sweep ? 'manual sweep' : 'not yet run' },
    { label: 'Runtime Execution', value: 'Disabled', icon: 'ri-shield-cross-line', tone: 'text-red-400', sub: 'master kill switch' },
  ];

  return (
    <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-background-100 border border-background-200/60 rounded-lg p-4 flex flex-col"
        >
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-50 border border-background-200/40">
              <i className={`${card.icon} text-sm w-4 h-4 flex items-center justify-center ${card.tone}`}></i>
            </span>
            <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{card.label}</p>
          </div>
          <p className={`text-xl font-heading font-bold mt-2 ${card.tone}`}>{card.value}</p>
          <p className="text-[10px] font-label text-foreground-600 mt-0.5">{card.sub}</p>
        </div>
      ))}
    </section>
  );
}