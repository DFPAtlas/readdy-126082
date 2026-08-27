import type { AgentDataPermission } from '@/pages/ai-operations/types';
import { ACCESS_LEVEL_LABELS, ENVIRONMENT_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

function accessTone(level: string) {
  switch (level) {
    case 'read':
    case 'read_write':
      return 'emerald' as const;
    case 'create':
    case 'update':
      return 'accent' as const;
    case 'delete':
      return 'red' as const;
    case 'restricted':
      return 'amber' as const;
    default:
      return 'secondary' as const;
  }
}

export default function DataPermissions({ permissions }: { permissions: AgentDataPermission[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Data Permissions</h3>
        <span className="text-xs font-label text-foreground-600">{permissions.length} permissions</span>
      </div>

      {permissions.length === 0 ? (
        <div className="bg-background-100 border border-background-200/60 rounded-lg p-8 text-center">
          <p className="text-sm text-foreground-500">No data permissions defined yet.</p>
        </div>
      ) : (
        <div className="bg-background-100 border border-background-200/60 rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-label text-foreground-600 uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Resource / Table</th>
                  <th className="px-4 py-3 font-medium">Scope</th>
                  <th className="px-4 py-3 font-medium">Access</th>
                  <th className="px-4 py-3 font-medium">Environment</th>
                  <th className="px-4 py-3 font-medium">Approval</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((p) => (
                  <tr key={p.resource} className="border-t border-background-200/40 hover:bg-background-200/30 transition-colors duration-150">
                    <td className="px-4 py-3 font-medium text-foreground-200 font-mono text-xs whitespace-nowrap">{p.resource}</td>
                    <td className="px-4 py-3 text-foreground-500 whitespace-nowrap">{p.scope}</td>
                    <td className="px-4 py-3"><StatusPill tone={accessTone(p.accessLevel)} label={ACCESS_LEVEL_LABELS[p.accessLevel]} /></td>
                    <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{ENVIRONMENT_LABELS[p.environment]}</td>
                    <td className="px-4 py-3 text-foreground-500 font-label whitespace-nowrap">{p.approvalRequired ? 'Required' : 'Not required'}</td>
                    <td className="px-4 py-3 text-foreground-400">{p.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}