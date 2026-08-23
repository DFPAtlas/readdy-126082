import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { SupportSite, SupportSiteStats, TicketApiClient } from '@/types/support-tickets';
import { formatDateTime, formatRelative, isValidOrigin } from '../constants';

interface HealthPanelProps {
  site: SupportSite;
  stats: SupportSiteStats | undefined;
  credentials: TicketApiClient[];
}

interface Check {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  detail: string;
}

interface TestResult {
  correlationId: string;
  overall: string;
  checks: Check[];
}

export default function HealthPanel({ site, stats, credentials }: HealthPanelProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState('');

  const activeCreds = credentials.filter((c) => c.is_active && !c.revoked_at);

  const runTest = async () => {
    setTesting(true);
    setError('');
    setResult(null);
    const { data, error: e } = await supabase.functions.invoke('manage-support-integrations', {
      body: { action: 'health_test', siteId: site.id },
    });
    setTesting(false);
    if (e) {
      setError(e.message || 'Connection test failed.');
      return;
    }
    setResult(data as TestResult);
  };

  const rows: Array<{ label: string; value: string; tone?: 'ok' | 'warn' | 'bad' }> = [
    { label: 'Site', value: site.is_active ? 'Active' : 'Inactive', tone: site.is_active ? 'ok' : 'bad' },
    { label: 'Credentials', value: `${activeCreds.length} active / ${credentials.length} total`, tone: activeCreds.length > 0 ? 'ok' : 'bad' },
    { label: 'Origins valid', value: site.allowed_origins.every((o) => isValidOrigin(o)) ? 'Yes' : 'Review needed', tone: site.allowed_origins.every((o) => isValidOrigin(o)) ? 'ok' : 'warn' },
    { label: 'Last ticket', value: formatRelative(stats?.last_ticket_at) },
    { label: 'Last request', value: formatRelative(stats?.last_request_at) },
    { label: 'Requests (24h)', value: String(stats?.request_count_24h ?? 0) },
  ];

  const toneCls = { ok: 'text-emerald-400', warn: 'text-amber-400', bad: 'text-red-400' };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground-100">Integration health</h3>
          <p className="text-xs text-foreground-500 mt-0.5">Configuration and connectivity checks. Never creates a real ticket.</p>
        </div>
        <button
          onClick={runTest}
          disabled={testing}
          className="inline-flex items-center gap-1.5 border border-background-300/60 hover:border-accent-500/50 text-foreground-200 hover:text-accent-400 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
        >
          <i className="ri-flashlight-line text-base w-4 h-4 flex items-center justify-center"></i>
          {testing ? 'Testing…' : 'Run connection test'}
        </button>
      </div>

      <div className="bg-background-100 border border-background-200/60 rounded-lg divide-y divide-background-200/40">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-foreground-400">{r.label}</span>
            <span className={`text-sm font-medium ${r.tone ? toneCls[r.tone] : 'text-foreground-100'}`}>{r.value}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3 text-sm text-red-400" role="status">{error}</div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground-500">Correlation ID</span>
            <code className="font-mono text-xs text-foreground-300">{result.correlationId}</code>
          </div>
          <div className={`px-3 py-2 rounded-md text-sm border ${result.overall === 'ok' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'}`}>
            {result.overall === 'ok' ? 'All checks passed.' : 'Attention required — review the checks below.'}
          </div>
          <ul className="space-y-1.5">
            {result.checks.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <i className={`${c.status === 'pass' ? 'ri-checkbox-circle-line text-emerald-400' : c.status === 'warn' ? 'ri-error-warning-line text-amber-400' : 'ri-close-circle-line text-red-400'} text-base w-4 h-4 flex items-center justify-center mt-px shrink-0`}></i>
                <span className="text-foreground-300 leading-relaxed">{c.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats && stats.last_ticket_at && (
        <p className="text-xs text-foreground-600">Last ticket received {formatDateTime(stats.last_ticket_at)}.</p>
      )}
    </div>
  );
}