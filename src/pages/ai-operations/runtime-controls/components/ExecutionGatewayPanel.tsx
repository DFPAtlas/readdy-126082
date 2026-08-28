import { useEffect } from 'react';
import {
  useRuntimeGateway,
  refreshGateway,
  type AiRuntimeServiceIdentity,
} from '@/pages/ai-operations/runtime-controls/runtimeGatewayStore';

const IDENTITY_TYPE_LABELS: Record<string, string> = {
  dfp_command: 'DFP Command',
  scheduler: 'Scheduler',
  n8n: 'n8n',
  internal_runtime: 'Internal Runtime',
  monitoring: 'Monitoring',
};

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ExecutionGatewayPanel() {
  const { serviceIdentities, requests, summary, loading, error } = useRuntimeGateway();

  useEffect(() => {
    void refreshGateway();
  }, []);

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
            <i className="ri-shield-keyhole-line w-4 h-4 flex items-center justify-center"></i>
          </div>
          <div>
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Execution Gateway</h3>
            <p className="text-xs text-foreground-500 mt-0.5">Central trusted runtime boundary — deny-only.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-shield-check-line w-3 h-3 flex items-center justify-center"></i>
            Gateway Ready
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
            <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
            Deny-only mode
          </span>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-background-200/60">
        <SummaryStat label="Requests evaluated" value={summary?.requestsEvaluated ?? 0} />
        <SummaryStat label="Requests blocked" value={summary?.requestsBlocked ?? 0} tone="red" />
        <SummaryStat label="Requests rejected" value={summary?.requestsRejected ?? 0} tone="amber" />
        <SummaryStat label="Last request" value={formatTime(summary?.lastRequest?.requested_at)} muted />
      </div>

      {/* Service identities */}
      <div className="px-4 py-3 border-t border-background-200/60">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h4 className="text-xs font-label font-semibold text-foreground-300 uppercase tracking-wide">Service Identities (allowlisted, registry-only)</h4>
          <span className="text-[11px] text-foreground-600">No credentials stored in registry rows</span>
        </div>

        {loading && serviceIdentities.length === 0 ? (
          <div className="py-6 text-center text-xs text-foreground-500">
            <i className="ri-loader-4-line w-4 h-4 inline-flex items-center justify-center animate-spin"></i>
            <span className="ml-2">Loading service identities…</span>
          </div>
        ) : error && serviceIdentities.length === 0 ? (
          <div className="py-4 text-center text-xs text-amber-400">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] font-label text-foreground-600 uppercase tracking-wide border-b border-background-200/60">
                  <th className="py-1.5 pr-3 font-medium whitespace-nowrap">Identity</th>
                  <th className="py-1.5 pr-3 font-medium whitespace-nowrap">Type</th>
                  <th className="py-1.5 pr-3 font-medium whitespace-nowrap">Status</th>
                  <th className="py-1.5 pr-3 font-medium whitespace-nowrap">Credential reference</th>
                  <th className="py-1.5 font-medium whitespace-nowrap">Allowed request types</th>
                </tr>
              </thead>
              <tbody>
                {(serviceIdentities ?? []).map((ident: AiRuntimeServiceIdentity) => (
                  <tr key={ident.id} className="border-b border-background-200/40 last:border-0">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground-100 whitespace-nowrap">{ident.name}</span>
                        {ident.is_active ? (
                          <i className="ri-checkbox-circle-line text-emerald-400 w-3.5 h-3.5 flex items-center justify-center shrink-0"></i>
                        ) : (
                          <i className="ri-close-circle-line text-foreground-600 w-3.5 h-3.5 flex items-center justify-center shrink-0"></i>
                        )}
                      </div>
                      <p className="text-[11px] text-foreground-600 font-mono whitespace-nowrap">{ident.identity_key}</p>
                    </td>
                    <td className="py-2 pr-3 text-xs text-foreground-400 whitespace-nowrap">{IDENTITY_TYPE_LABELS[ident.identity_type] ?? ident.identity_type}</td>
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
                        <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
                        {ident.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs text-foreground-400 font-mono whitespace-nowrap">
                      {ident.credential_reference ?? '—'}
                      <span className="block text-[10px] text-foreground-600">name-only · no value stored</span>
                    </td>
                    <td className="py-2 text-xs text-foreground-400">
                      {ident.allowed_request_types?.length ? ident.allowed_request_types.join(', ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent requests */}
      <div className="px-4 py-3 border-t border-background-200/60">
        <h4 className="text-xs font-label font-semibold text-foreground-300 uppercase tracking-wide mb-2">Recent execution requests (append-only ledger)</h4>
        {requests.length === 0 ? (
          <p className="text-xs text-foreground-500 py-2">
            No execution requests have reached the gateway yet. Requests are created server-side only — the browser cannot forge them.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {requests.slice(0, 8).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-foreground-100 whitespace-nowrap">{r.request_key}</span>
                    <span className="text-[10px] font-label text-foreground-600 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">{r.request_type}</span>
                  </div>
                  <p className="text-[11px] text-foreground-600 mt-0.5">{formatTime(r.requested_at)} · {r.source_type}{r.source_reference ? ` · ${r.source_reference}` : ''}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
                  <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SummaryStat({ label, value, tone, muted }: { label: string; value: number | string; tone?: 'red' | 'amber'; muted?: boolean }) {
  return (
    <div className="bg-background-100 px-4 py-3">
      <p className="text-[11px] font-label text-foreground-600 uppercase tracking-wide whitespace-nowrap">{label}</p>
      <p className={`text-lg font-heading font-semibold mt-0.5 ${tone === 'red' ? 'text-red-400' : tone === 'amber' ? 'text-amber-400' : muted ? 'text-foreground-300' : 'text-foreground-100'}`}>
        {value}
      </p>
    </div>
  );
}