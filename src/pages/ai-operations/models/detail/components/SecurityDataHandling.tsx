import type { AiModel } from '@/pages/ai-operations/types';

function YesNo({ value }: { value: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-label ${value ? 'text-emerald-400' : 'text-foreground-500'}`}>
      <i className={`${value ? 'ri-checkbox-circle-line' : 'ri-close-circle-line'} w-3.5 h-3.5 flex items-center justify-center`}></i>
      {value ? 'Yes' : 'No'}
    </span>
  );
}

export default function SecurityDataHandling({ model }: { model: AiModel }) {
  const s = model.security;

  const rows = [
    { label: 'Local processing available', value: s.localProcessingAvailable },
    { label: 'External provider involved', value: s.externalProviderInvolved },
    { label: 'Secret credentials hidden', value: s.credentialsHidden },
    { label: 'Environment separation', value: s.environmentSeparation },
    { label: 'Sensitive-data restriction', value: s.sensitiveDataRestricted },
    { label: 'Approval required for restricted workloads', value: s.approvalForRestricted },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <div className="flex items-center gap-2">
        <i className="ri-shield-keyhole-line text-foreground-300 w-4 h-4 flex items-center justify-center"></i>
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Security &amp; Data Handling</h3>
      </div>

      <div className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 border-b border-background-200/40 pb-2">
            <span className="text-xs font-label text-foreground-500">{r.label}</span>
            <YesNo value={r.value} />
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-b border-background-200/40 pb-2">
          <span className="text-xs font-label text-foreground-500">Logging policy reference</span>
          <span className="text-sm text-foreground-300 text-right font-mono">{s.loggingPolicyRef}</span>
        </div>
      </div>

      <p className="text-[11px] font-label text-foreground-600 mt-3">No keys, tokens or secrets are stored or displayed.</p>
    </section>
  );
}