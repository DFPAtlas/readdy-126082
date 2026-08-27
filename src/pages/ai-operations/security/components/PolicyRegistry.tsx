import { Link } from 'react-router-dom';
import type { AiSecurityPolicy } from '@/pages/ai-operations/types';
import {
  POLICY_STATUS,
  POLICY_EFFECT,
  POLICY_CATEGORY_LABELS,
  RISK_CLASS,
  ENVIRONMENT_LABELS,
  RISK_LEVEL,
} from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function PolicyRegistry({ policies }: { policies: AiSecurityPolicy[] }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Policy Registry</h3>
        <span className="text-[11px] font-label text-foreground-600">{policies.length} policies</span>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Policy</th>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Scope</th>
              <th className="px-4 py-2.5 font-medium">Effect</th>
              <th className="px-4 py-2.5 font-medium">Risk</th>
              <th className="px-4 py-2.5 font-medium">Environment</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Priority</th>
              <th className="px-4 py-2.5 font-medium">Review Date</th>
              <th className="px-4 py-2.5 font-medium text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => {
              const status = POLICY_STATUS[p.status];
              const effect = POLICY_EFFECT[p.effect];
              const riskClass = RISK_CLASS[p.riskClass];
              const priority = RISK_LEVEL[p.priority];
              return (
                <tr key={p.id} className="border-b border-background-200/30 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <Link to={`/ai-operations/security/policies/${p.id}`} className="font-medium text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer">
                      {p.name}
                    </Link>
                    <p className="text-[10px] font-label text-foreground-600 font-mono mt-0.5">{p.id}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{POLICY_CATEGORY_LABELS[p.category]}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{p.siteName}</td>
                  <td className="px-4 py-3"><StatusPill tone={effect.tone} label={effect.label} /></td>
                  <td className="px-4 py-3"><StatusPill tone={riskClass.tone} label={riskClass.label} /></td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{ENVIRONMENT_LABELS[p.environment]}</td>
                  <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} /></td>
                  <td className="px-4 py-3"><StatusPill tone={priority.tone} label={priority.label} /></td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{p.reviewDate}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/ai-operations/security/policies/${p.id}`}
                      className="inline-flex items-center gap-1 text-xs font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Open
                      <i className="ri-arrow-right-line w-3.5 h-3.5 flex items-center justify-center"></i>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden divide-y divide-background-200/40">
        {policies.map((p) => {
          const status = POLICY_STATUS[p.status];
          const effect = POLICY_EFFECT[p.effect];
          return (
            <Link key={p.id} to={`/ai-operations/security/policies/${p.id}`} className="block px-4 py-3 hover:bg-background-200/30 transition-colors duration-150 cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground-100">{p.name}</p>
                  <p className="text-[10px] font-label text-foreground-600 mt-0.5">{POLICY_CATEGORY_LABELS[p.category]} · {p.siteName}</p>
                </div>
                <StatusPill tone={status.tone} label={status.label} />
              </div>
              <div className="mt-2 flex items-center gap-3 text-[11px] font-label text-foreground-500 flex-wrap">
                <StatusPill tone={effect.tone} label={effect.label} />
                <span>{ENVIRONMENT_LABELS[p.environment]}</span>
                <span>Review {p.reviewDate}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}