import { useMemo } from 'react';
import { useRuntimeHealth } from '@/pages/ai-operations/runtime-health/runtimeHealthStore';

type HandshakeState = 'verified' | 'unverified' | 'failed' | 'not_configured';

const STATE_META: Record<HandshakeState, { label: string; tone: 'emerald' | 'amber' | 'red' | 'secondary' }> = {
  verified: { label: 'Verified', tone: 'emerald' },
  unverified: { label: 'Unverified', tone: 'amber' },
  failed: { label: 'Failed', tone: 'red' },
  not_configured: { label: 'Not Configured', tone: 'secondary' },
};

const TONE_STYLES: Record<'emerald' | 'amber' | 'red' | 'secondary', string> = {
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  red: 'bg-red-500/15 text-red-400 border-red-500/25',
  secondary: 'bg-secondary-500/15 text-secondary-300 border-secondary-500/25',
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export default function ScheduledHandshake() {
  const { sweeps } = useRuntimeHealth();

  const { state, lastScheduled } = useMemo(() => {
    const scheduled = sweeps.filter((s) => s.trigger_type === 'scheduled');
    if (scheduled.length > 0) {
      return { state: 'verified' as HandshakeState, lastScheduled: scheduled[0].started_at };
    }
    // No scheduled sweep has ever been persisted → handshake not yet confirmed.
    return { state: 'unverified' as HandshakeState, lastScheduled: null };
  }, [sweeps]);

  const meta = STATE_META[state];

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Scheduled Monitoring Handshake</h3>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-label whitespace-nowrap border ${TONE_STYLES[meta.tone]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.tone === 'emerald' ? 'bg-emerald-400' : meta.tone === 'amber' ? 'bg-amber-400' : meta.tone === 'red' ? 'bg-red-400' : 'bg-secondary-400'}`}></span>
            {meta.label}
          </span>
        </div>
        <span className="text-[10px] font-label text-foreground-600">pg_cron → runtime-health-scheduled</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-background-200/40">
        <div className="bg-background-100 px-4 py-3">
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Last scheduled sweep</p>
          <p className="text-sm text-foreground-100 mt-1">{formatDateTime(lastScheduled)}</p>
        </div>
        <div className="bg-background-100 px-4 py-3">
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Cron registration</p>
          <p className="text-sm text-foreground-100 mt-1">Registered · every 5 min</p>
        </div>
        <div className="bg-background-100 px-4 py-3">
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Scheduled function</p>
          <p className="text-sm text-foreground-100 mt-1">Deployed · token-guarded</p>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-background-200/60 flex items-start gap-2.5">
        <i className="ri-information-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center shrink-0 mt-0.5"></i>
        <p className="text-xs text-foreground-500 leading-relaxed">
          {state === 'verified'
            ? 'A genuine scheduled sweep has been persisted — the pg_cron → scheduled-function token handshake is confirmed working.'
            : 'No scheduled sweep has been persisted yet. The cron job and scheduled function are registered, but the token handshake has not produced a persisted result. Scheduler handshake requires infrastructure verification — monitoring readiness remains Partial until a real scheduled sweep lands. The scheduler secret is never exposed to the browser.'}
        </p>
      </div>
    </section>
  );
}