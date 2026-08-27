import { rlsRoles } from '@/mocks/ai-operations-readiness-2';
import Section from '@/pages/ai-operations/readiness/components/Section';

export default function RlsReadiness() {
  return (
    <Section
      icon="ri-key-2-line"
      title="RLS Readiness"
      subtitle="Planning matrix for role-based access scopes. No RLS changes are made."
    >
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[11px] font-label uppercase tracking-wide text-foreground-500 border-b border-background-200/60">
              <th className="py-2 pr-4 font-semibold">Role</th>
              <th className="py-2 pr-3 font-semibold">Read Scope</th>
              <th className="py-2 pr-3 font-semibold">Write Scope</th>
              <th className="py-2 pr-3 font-semibold">Approval Permissions</th>
              <th className="py-2 pr-3 font-semibold">Admin Permissions</th>
              <th className="py-2 font-semibold">State</th>
            </tr>
          </thead>
          <tbody>
            {rlsRoles.map((r) => (
              <tr key={r.role} className="border-b border-background-200/40 last:border-0 hover:bg-background-50/50 transition-colors">
                <td className="py-2.5 pr-4 font-label font-medium text-foreground-100 whitespace-nowrap">{r.role}</td>
                <td className="py-2.5 pr-3 text-xs text-foreground-400">{r.readScope}</td>
                <td className="py-2.5 pr-3 text-xs text-foreground-500">{r.writeScope}</td>
                <td className="py-2.5 pr-3 text-xs text-foreground-500">{r.approvalPermissions}</td>
                <td className="py-2.5 pr-3 text-xs text-foreground-500">{r.adminPermissions}</td>
                <td className="py-2.5 text-xs text-foreground-500 capitalize">{r.state.replace('_', ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}