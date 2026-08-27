const METRICS = [
  { label: 'Jobs (today)', value: '1,045', icon: 'ri-list-check-3' },
  { label: 'Runs (today)', value: '806', icon: 'ri-play-list-line' },
  { label: 'Input usage', value: '23.6M tokens', icon: 'ri-arrow-down-line' },
  { label: 'Output usage', value: '2.1M tokens', icon: 'ri-arrow-up-line' },
  { label: 'Tool calls', value: '312', icon: 'ri-plug-2-line' },
  { label: 'Avg duration', value: '1.1s', icon: 'ri-time-line' },
  { label: 'Failed runs', value: '6', icon: 'ri-error-warning-line' },
  { label: 'Retry cost', value: '£1.42', icon: 'ri-refresh-line' },
];

export default function UsageMetrics() {
  return (
    <section aria-label="Usage metrics" className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-label font-semibold text-foreground-100">Usage Metrics</h3>
        <span className="text-[11px] font-label text-foreground-500">Demo only</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {METRICS.map((m) => (
          <div key={m.label} className="flex items-start gap-3 p-3 rounded-md bg-background-50 border border-background-200/50">
            <div className="w-8 h-8 rounded-md bg-secondary-500/10 text-secondary-300 flex items-center justify-center shrink-0">
              <i className={`${m.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wide whitespace-nowrap">{m.label}</p>
              <p className="text-sm font-heading font-semibold text-foreground-100">{m.value}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}