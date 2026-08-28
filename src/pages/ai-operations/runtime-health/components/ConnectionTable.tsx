import { Link } from 'react-router-dom';
import {
  HEALTH_STATUS_META,
  type RuntimeHealthRow,
} from '@/lib/ai-operations/runtimeHealth';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

interface ConnectionTableProps {
  rows: RuntimeHealthRow[];
  checkingKeys: string[];
  onCheck: (system: string, key: string) => void;
}

function registryLabel(row: RuntimeHealthRow): { tone: 'emerald' | 'amber' | 'red' | 'secondary'; label: string } {
  if (row.kind === 'provider') {
    const status = row.registryStatus;
    if (status === 'available') return { tone: 'emerald', label: 'Available' };
    if (status === 'not_configured') return { tone: 'secondary', label: 'Not Configured' };
    if (status === 'degraded') return { tone: 'amber', label: 'Degraded' };
    if (status === 'unavailable' || status === 'disabled') return { tone: 'red', label: 'Unavailable' };
    return { tone: 'secondary', label: status || 'Unknown' };
  }
  const config = row.configurationState;
  if (config === 'complete') return { tone: 'emerald', label: 'Configured' };
  if (config === 'partial') return { tone: 'amber', label: 'Partial' };
  if (config === 'missing') return { tone: 'secondary', label: 'Missing' };
  if (config === 'invalid') return { tone: 'red', label: 'Invalid' };
  return { tone: 'secondary', label: config || 'Unknown' };
}

function authLabel(authenticated: boolean | null): string {
  if (authenticated === true) return 'Authenticated';
  if (authenticated === false) return 'Failed';
  return '—';
}

export default function ConnectionTable({ rows, checkingKeys, onCheck }: ConnectionTableProps) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Connections &amp; Providers</h3>
        <span className="text-[10px] font-label text-foreground-600">Registry Health vs Runtime Connectivity</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-2.5 whitespace-nowrap">System</th>
              <th className="px-4 py-2.5 whitespace-nowrap">Category</th>
              <th className="px-4 py-2.5 whitespace-nowrap">Registry State</th>
              <th className="px-4 py-2.5 whitespace-nowrap">Runtime Status</th>
              <th className="px-4 py-2.5 whitespace-nowrap">Last Checked</th>
              <th className="px-4 py-2.5 whitespace-nowrap">Latency</th>
              <th className="px-4 py-2.5 whitespace-nowrap">Auth</th>
              <th className="px-4 py-2.5 whitespace-nowrap">Environment</th>
              <th className="px-4 py-2.5 whitespace-nowrap">Safe Result</th>
              <th className="px-4 py-2.5 whitespace-nowrap text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const registry = registryLabel(row);
              const result = row.result;
              const meta = result ? HEALTH_STATUS_META[result.status] : null;
              const isChecking = checkingKeys.includes(row.key);
              const testable = row.system !== null;

              return (
                <tr key={row.key} className="border-b border-background-200/40 last:border-0 hover:bg-background-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-foreground-100 whitespace-nowrap">{row.name}</span>
                      <span className="text-[9px] font-label text-foreground-600 bg-background-50 border border-background-200/50 rounded px-1 py-0.5 uppercase whitespace-nowrap">
                        {row.kind === 'connection' ? 'Connection' : 'Provider'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">{row.category}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={registry.tone} label={registry.label} />
                  </td>
                  <td className="px-4 py-3">
                    {meta ? (
                      <StatusPill tone={meta.tone} label={meta.label} pulse={result?.status === 'degraded'} />
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-label text-foreground-600 whitespace-nowrap">
                        <i className="ri-time-line w-3.5 h-3.5 flex items-center justify-center"></i>
                        Not Checked
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">
                    {result ? new Date(result.checkedAt).toLocaleTimeString('en-US', { hour12: false }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">
                    {result && result.latencyMs != null ? `${result.latencyMs} ms` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap">
                    {result ? authLabel(result.authenticated) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground-500 whitespace-nowrap capitalize">
                    {row.environment ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground-500 max-w-[260px]">
                    {result ? (
                      <span className="line-clamp-2 leading-relaxed" title={result.safeMessage}>{result.safeMessage}</span>
                    ) : (
                      <span className="text-foreground-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {testable ? (
                      <button
                        onClick={() => onCheck(row.system as string, row.key)}
                        disabled={isChecking}
                        className="inline-flex items-center gap-1.5 text-[11px] font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <i className={`ri-refresh-line text-sm w-3.5 h-3.5 flex items-center justify-center ${isChecking ? 'animate-spin' : ''}`}></i>
                        {isChecking ? 'Checking…' : 'Check Health'}
                      </button>
                    ) : (
                      <Link
                        to={row.kind === 'connection' ? `/ai-operations/tools/${row.key}` : '/ai-operations/models'}
                        className="inline-flex items-center gap-1 text-[11px] font-label text-foreground-600 hover:text-foreground-300 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        View
                        <i className="ri-arrow-right-line w-3 h-3 flex items-center justify-center"></i>
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}