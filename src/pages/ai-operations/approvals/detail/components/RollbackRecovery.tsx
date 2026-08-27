import type { ApprovalRollbackPlan } from '@/pages/ai-operations/types';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-background-200/40 last:border-0">
      <span className="text-xs text-foreground-600 shrink-0">{label}</span>
      <span className="text-xs text-foreground-300 text-right break-all">{value || '—'}</span>
    </div>
  );
}

export default function RollbackRecovery({ rollback }: { rollback: ApprovalRollbackPlan }) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Rollback &amp; Recovery</h3>
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <Row label="Rollback available" value={rollback.available ? 'Yes' : 'No'} />
        <Row label="Rollback method" value={rollback.method} />
        <Row label="Estimated rollback time" value={rollback.estimatedTime} />
        <Row label="Backup / reference" value={rollback.backupRef} />
        <Row label="Recovery owner" value={rollback.owner} />
        <Row label="Validation after rollback" value={rollback.validation} />
        <p className="text-[11px] font-label text-foreground-600 mt-3">No rollback actions execute in this demo.</p>
      </div>
    </section>
  );
}