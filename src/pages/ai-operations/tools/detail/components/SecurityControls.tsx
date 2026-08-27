import type { ToolConnection } from '@/pages/ai-operations/types';

function SecurityItem({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <i className={`${active ? 'ri-checkbox-circle-line text-emerald-400' : 'ri-indeterminate-circle-line text-foreground-600'} text-sm w-4 h-4 flex items-center justify-center`}></i>
      <span className={`text-sm ${active ? 'text-foreground-200' : 'text-foreground-500'}`}>{label}</span>
    </div>
  );
}

export default function SecurityControls({ connection }: { connection: ToolConnection }) {
  const { security } = connection;

  const items: { label: string; active: boolean }[] = [
    { label: 'Credentials stored externally', active: security.credentialsExternal },
    { label: 'Secrets hidden from agents', active: security.secretsHiddenFromAgents },
    { label: 'Environment isolation', active: security.environmentIsolation },
    { label: 'Least privilege', active: security.leastPrivilege },
    { label: 'Approval required for high-risk actions', active: security.approvalForHighRisk },
    { label: 'Audit enabled', active: security.auditEnabled },
  ];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Security Controls</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => (
          <SecurityItem key={item.label} label={item.label} active={item.active} />
        ))}
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-background-200/40 text-sm">
        <span className="text-xs font-label text-foreground-500">Rotation status</span>
        <span className="text-foreground-200">{security.rotationStatus}</span>
      </div>
      <div className="flex items-center justify-between mt-2 text-sm">
        <span className="text-xs font-label text-foreground-500">Last security review</span>
        <span className="text-foreground-200">{security.lastSecurityReview}</span>
      </div>
      <p className="text-[11px] font-label text-foreground-600 mt-3">Secret values are never displayed or accepted in this interface.</p>
    </section>
  );
}