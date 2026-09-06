import { toneHex } from '@/pages/ai-operations/wallboard/operationsWallSelectors';
import {
  getQuickGuardManagerReport,
  type QuickGuardManagerReport,
} from '@/pages/ai-operations/wallboard/managerReportSelectors';

/**
 * Compact live manager-report panel for the QuickGuard wall widget.
 *
 * Read-only display of the newest autonomous-manager report: master identity,
 * host/mode, reporting freshness (observed_at ≤ 10 min), workflow execution
 * status and business health as SEPARATE signals, capped metrics, reasons, and
 * the intended overseer. No controls — this is supervision display only.
 */
function StatusChip({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="text-[7px] font-bold tracking-[0.06em] leading-none px-1.5 py-0.5 border rounded-full whitespace-nowrap"
      style={{ color, borderColor: `${color}66`, background: `${color}14` }}
    >
      {label}
    </span>
  );
}

function MetricCell({ label, value, truncated, color }: { label: string; value: number; truncated: boolean; color: string }) {
  return (
    <div className="flex flex-col leading-none min-w-0">
      <span className="font-mono text-[11px] font-semibold tabular-nums" style={{ color }}>
        {truncated ? `${value}+` : value}
      </span>
      <span className="text-[6px] font-label tracking-[0.1em] text-slate-500 whitespace-nowrap">{label}</span>
    </div>
  );
}

export default function QuickGuardManagerReport() {
  const r: QuickGuardManagerReport = getQuickGuardManagerReport();

  const reportingColor = toneHex(r.reportingTone);
  const workflowColor = toneHex(r.workflowStatusTone);
  const businessColor = toneHex(r.businessHealthTone);

  return (
    <div
      className="mt-1.5 pt-1.5 border-t"
      style={{ borderColor: 'rgba(59,130,246,0.20)' }}
      title={r.observedAt ? `Observed ${r.observedAt}` : undefined}
    >
      {/* Section header + observation age */}
      <div className="flex items-center justify-between gap-1 leading-none">
        <span className="text-[6.5px] font-label tracking-[0.14em] text-slate-500">MANAGER REPORT</span>
        <span className="font-mono text-[7px] text-slate-500 tabular-nums whitespace-nowrap">
          {r.observedAt ? `${r.ageLabel} ago` : '—'}
        </span>
      </div>

      {/* Master identity */}
      <div className="mt-1 text-[9px] font-semibold tracking-[0.04em] text-slate-200 truncate">
        {r.manager ?? 'QuickGuard Autonomous Manager'}
      </div>
      <div className="text-[7px] font-label tracking-[0.08em] text-slate-500 mt-0.5 truncate">
        HOST {r.host ?? '—'} · {r.mode ?? '—'}
      </div>

      {/* Reporting / workflow / business — three separate signals */}
      <div className="flex flex-wrap items-center gap-1 mt-1.5">
        <StatusChip color={reportingColor} label={`REPORT ${r.reportingLabel}`} />
        {r.workflowStatusLabel && <StatusChip color={workflowColor} label={r.workflowStatusLabel} />}
        {r.businessHealth && <StatusChip color={businessColor} label={`BUSINESS ${r.businessHealth}`} />}
      </div>

      {/* Metrics (capped counts shown as N+) */}
      {r.metrics.length > 0 && (
        <div className="grid grid-cols-3 gap-x-1 gap-y-1 mt-1.5">
          {r.metrics.map((m) => (
            <MetricCell key={m.key} label={m.label} value={m.value} truncated={m.truncated} color="#e2e8f0" />
          ))}
        </div>
      )}

      {/* Reasons */}
      {r.reasons.length > 0 && (
        <div className="mt-1 text-[7px] leading-tight text-slate-400 truncate" title={r.reasons.join(' · ')}>
          {r.reasons.join(' · ')}
        </div>
      )}

      {/* Truncation note */}
      {r.anyTruncated && (
        <div className="mt-0.5 text-[6.5px] font-label tracking-[0.04em] text-slate-500">
          OBSERVED ROWS · QUERY LIMIT REACHED
        </div>
      )}

      {/* Intended overseer (does not prove live oversight) */}
      <div className="mt-1 text-[6.5px] font-label tracking-[0.06em] text-slate-500 truncate">
        OVERSEER {r.overseer ?? '—'} · INTENDED
      </div>
    </div>
  );
}