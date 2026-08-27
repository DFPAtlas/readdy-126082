import type { ToolConnection } from '@/pages/ai-operations/types';
import { RISK_CLASS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

function Cell({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <i className="ri-check-line text-emerald-400 text-sm w-4 h-4 flex items-center justify-center"></i>
  ) : (
    <i className="ri-close-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center"></i>
  );
}

const COLS: { key: 'read' | 'write' | 'execute' | 'admin' | 'restricted'; label: string }[] = [
  { key: 'read', label: 'Read' },
  { key: 'write', label: 'Write' },
  { key: 'execute', label: 'Execute' },
  { key: 'admin', label: 'Admin' },
  { key: 'restricted', label: 'Restricted' },
];

export default function Permissions({ connection }: { connection: ToolConnection }) {
  if (connection.permissions.length === 0) {
    return (
      <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Connection Permissions</h3>
        <p className="text-sm text-foreground-500">No explicit permission model defined for this connection.</p>
      </section>
    );
  }

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide mb-3">Connection Permissions</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-2 py-2 font-medium">Operation</th>
              {COLS.map((c) => (
                <th key={c.key} className="px-2 py-2 font-medium text-center">{c.label}</th>
              ))}
              <th className="px-2 py-2 font-medium">Risk</th>
            </tr>
          </thead>
          <tbody>
            {connection.permissions.map((p) => (
              <tr key={p.operation} className="border-t border-background-200/40">
                <td className="px-2 py-2.5 text-foreground-200 whitespace-nowrap">{p.operation}</td>
                {COLS.map((c) => (
                  <td key={c.key} className="px-2 py-2.5 text-center">
                    <Cell allowed={p[c.key]} />
                  </td>
                ))}
                <td className="px-2 py-2.5"><StatusPill tone={RISK_CLASS[p.riskClass].tone} label={RISK_CLASS[p.riskClass].label} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] font-label text-foreground-600 mt-3">Least-privilege model — high-risk operations require explicit approval.</p>
    </section>
  );
}