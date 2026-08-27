import type { AiSecurityPolicy } from '@/pages/ai-operations/types';
import { EXCEPTION_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function Exceptions({ policy }: { policy: AiSecurityPolicy }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Exceptions</h3>
        <span className="text-[11px] font-label text-foreground-600">{policy.exceptions.length} exceptions</span>
      </div>

      {policy.exceptions.length === 0 ? (
        <p className="px-4 py-5 text-sm text-foreground-500">
          {policy.exceptionAllowed
            ? 'No active exceptions. Exceptions are governed and time-bound.'
            : 'Exceptions are not permitted for this policy.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Exception</th>
                <th className="px-4 py-2.5 font-medium">Reason</th>
                <th className="px-4 py-2.5 font-medium">Scope</th>
                <th className="px-4 py-2.5 font-medium">Requested by</th>
                <th className="px-4 py-2.5 font-medium">Approved by</th>
                <th className="px-4 py-2.5 font-medium">Start</th>
                <th className="px-4 py-2.5 font-medium">Expiry</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {policy.exceptions.map((e) => {
                const status = EXCEPTION_STATUS[e.status];
                return (
                  <tr key={e.id} className="border-b border-background-200/30 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                    <td className="px-4 py-3 font-mono text-xs text-foreground-300">{e.id}</td>
                    <td className="px-4 py-3 text-foreground-400">{e.reason}</td>
                    <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{e.scope}</td>
                    <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{e.requestedByTeam}</td>
                    <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{e.approvedByTeam}</td>
                    <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{e.start}</td>
                    <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{e.expiry}</td>
                    <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="px-4 py-2.5 text-[11px] font-label text-foreground-600">
        Exceptions never change production behaviour — they are governance records only.
      </p>
    </section>
  );
}