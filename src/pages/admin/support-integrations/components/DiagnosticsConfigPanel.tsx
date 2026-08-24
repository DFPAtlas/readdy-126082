import { useEffect, useState } from 'react';
import { getDiagnosticConfigStatus } from '@/pages/support-customers/hooks';

type ConfigState = 'checking' | 'configured' | 'not_configured' | 'connection_error';

const STATE_UI: Record<Exclude<ConfigState, 'checking'>, { label: string; tone: string; icon: string }> = {
  configured: { label: 'Configured', tone: 'bg-emerald-500/15 text-emerald-400', icon: 'ri-check-line' },
  not_configured: { label: 'Not configured', tone: 'bg-amber-500/15 text-amber-400', icon: 'ri-alert-line' },
  connection_error: { label: 'Connection error', tone: 'bg-red-500/15 text-red-400', icon: 'ri-error-warning-line' },
};

export default function DiagnosticsConfigPanel() {
  const [state, setState] = useState<ConfigState>('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getDiagnosticConfigStatus();
      if (cancelled) return;
      if (!res.reachable) setState('connection_error');
      else if (res.configured) setState('configured');
      else setState('not_configured');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ui = STATE_UI[state as Exclude<ConfigState, 'checking'>];

  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent-500/10 flex items-center justify-center shrink-0">
            <i className="ri-robot-2-line text-accent-400 text-xl w-6 h-6 flex items-center justify-center"></i>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground-100">n8n Support Diagnostics</h3>
            <p className="text-xs text-foreground-500 mt-0.5 max-w-lg leading-relaxed">
              Runs read-only account diagnostics for support tickets and Customer 360. Requires the
              n8n webhook URL and shared secret to be set in Supabase Secrets.
            </p>
          </div>
        </div>

        {state === 'checking' ? (
          <span className="inline-flex items-center gap-2 text-xs text-foreground-500">
            <div className="w-4 h-4 border-2 border-foreground-500 border-t-transparent rounded-full animate-spin"></div>
            Checking…
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-label px-2.5 py-1 rounded-full whitespace-nowrap ${ui.tone}`}
          >
            <i className={`${ui.icon} w-3.5 h-3.5 flex items-center justify-center`}></i>
            {ui.label}
          </span>
        )}
      </div>
    </div>
  );
}