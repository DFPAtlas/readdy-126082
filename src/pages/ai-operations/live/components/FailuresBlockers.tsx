import { Link } from 'react-router-dom';
import { getFailuresBlockers } from '@/pages/ai-operations/live/selectors';
import { getAlertByReference } from '@/pages/ai-operations/alerts/selectors';
import { SEVERITY } from '@/pages/ai-operations/constants';
import type { OperationsAlert } from '@/pages/ai-operations/types';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

function openLink(item: OperationsAlert) {
  if (!item.referenceId) return null;
  const base = item.referenceType === 'run'
    ? '/ai-operations/runs'
    : item.referenceType === 'agent'
      ? '/ai-operations/agents'
      : item.referenceType === 'approval'
        ? '/ai-operations/approvals'
        : item.referenceType === 'site'
          ? '/ai-operations/sites'
          : null;
  if (!base) return null;
  return (
    <Link
      to={`${base}/${item.referenceId}`}
      className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap"
    >
      Open Record
    </Link>
  );
}

function openAlertLink(item: OperationsAlert) {
  const alert = getAlertByReference(item.referenceType, item.referenceId);
  if (!alert) return null;
  return (
    <Link
      to={`/ai-operations/alerts/${alert.id}`}
      className="inline-flex items-center gap-1.5 text-xs font-label text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-1.5 hover:bg-amber-500/20 transition-colors duration-150 cursor-pointer whitespace-nowrap"
    >
      Open Alert
    </Link>
  );
}

export default function FailuresBlockers() {
  const items = getFailuresBlockers();

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Failures &amp; Blockers</h3>
        <span className={`text-xs font-label ${items.length > 0 ? 'text-red-400' : 'text-foreground-600'}`}>{items.length} items</span>
      </div>

      <div className="divide-y divide-background-200/40 max-h-[440px] overflow-y-auto">
        {items.map((item) => {
          const severity = SEVERITY[item.severity];
          return (
            <div key={item.id} className="px-4 py-3 hover:bg-background-200/30 transition-colors duration-150">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-foreground-200">{item.siteName}</span>
                    <span className="text-foreground-600">&middot;</span>
                    <span className="text-xs text-foreground-400">{item.source}</span>
                  </div>
                  <p className="text-sm text-foreground-300 mt-0.5">{item.message}</p>
                  <p className="text-[11px] text-foreground-500 mt-1">{item.recommendedAction}</p>
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <StatusPill tone={severity.tone} label={severity.label} />
                    <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">{item.state}</span>
                    <span className="text-[10px] font-label text-foreground-600 whitespace-nowrap">Detected {item.detectedAt}</span>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  {openAlertLink(item)}
                  {openLink(item)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}