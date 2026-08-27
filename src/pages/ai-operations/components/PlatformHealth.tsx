import type { SystemHealthRow } from '@/pages/ai-operations/types';
import { HEALTH_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function PlatformHealth({ rows }: { rows: SystemHealthRow[] }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">AI Platform Health</h3>
      </div>

      <div className="divide-y divide-background-200/40">
        {rows.map((row) => {
          const display = HEALTH_STATUS[row.status];
          return (
            <div key={row.key} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-background-200/30 transition-colors duration-150">
              <div className="min-w-0">
                <p className="text-sm text-foreground-200">{row.label}</p>
                {row.detail && <p className="text-[10px] font-label text-foreground-600 mt-0.5">{row.detail}</p>}
              </div>
              <StatusPill tone={display.tone} label={display.label} />
            </div>
          );
        })}
      </div>
    </section>
  );
}