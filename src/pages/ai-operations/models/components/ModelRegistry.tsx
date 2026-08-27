import { Link } from 'react-router-dom';
import type { AiModel } from '@/pages/ai-operations/types';
import {
  MODEL_STATUS,
  MODEL_PURPOSE_LABELS,
  CONNECTION_HEALTH,
  HOSTING_TYPE_LABELS,
} from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';
import { getModelAssignments } from '@/pages/ai-operations/models/selectors';

export default function ModelRegistry({ models }: { models: AiModel[] }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Model Registry</h3>
        <span className="text-[11px] font-label text-foreground-600">{models.length} models</span>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-background-200/60 text-[10px] font-label text-foreground-600 uppercase tracking-wide">
              <th className="px-4 py-2.5 font-medium">Model</th>
              <th className="px-4 py-2.5 font-medium">Provider</th>
              <th className="px-4 py-2.5 font-medium">Local / Cloud</th>
              <th className="px-4 py-2.5 font-medium">Purpose</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Health</th>
              <th className="px-4 py-2.5 font-medium">Agents</th>
              <th className="px-4 py-2.5 font-medium">Jobs</th>
              <th className="px-4 py-2.5 font-medium">Speed</th>
              <th className="px-4 py-2.5 font-medium">Cost</th>
              <th className="px-4 py-2.5 font-medium">Fallback</th>
              <th className="px-4 py-2.5 font-medium text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => {
              const status = MODEL_STATUS[m.status];
              const health = CONNECTION_HEALTH[m.health];
              const agents = getModelAssignments(m).length;
              return (
                <tr key={m.id} className="border-b border-background-200/30 last:border-0 hover:bg-background-200/30 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <Link to={`/ai-operations/models/${m.id}`} className="font-medium text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer">
                      {m.name}
                    </Link>
                    <p className="text-[10px] font-label text-foreground-600 font-mono mt-0.5">{m.id}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{m.providerName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-label px-2 py-0.5 rounded-full ${m.hostingType === 'local' ? 'bg-accent-500/10 text-accent-300' : 'bg-secondary-500/10 text-secondary-300'}`}>
                      <i className={`${m.hostingType === 'local' ? 'ri-server-line' : 'ri-cloud-line'} w-3 h-3 flex items-center justify-center`}></i>
                      {HOSTING_TYPE_LABELS[m.hostingType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{MODEL_PURPOSE_LABELS[m.purpose]}</td>
                  <td className="px-4 py-3"><StatusPill tone={status.tone} label={status.label} /></td>
                  <td className="px-4 py-3"><StatusPill tone={health.tone} label={health.label} /></td>
                  <td className="px-4 py-3 text-foreground-300">{agents}</td>
                  <td className="px-4 py-3 text-foreground-300">{m.jobsToday}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{m.speed}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{m.cost}</td>
                  <td className="px-4 py-3 text-foreground-300 whitespace-nowrap">{m.fallbackModel}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/ai-operations/models/${m.id}`}
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
        {models.map((m) => {
          const status = MODEL_STATUS[m.status];
          const agents = getModelAssignments(m).length;
          return (
            <Link key={m.id} to={`/ai-operations/models/${m.id}`} className="block px-4 py-3 hover:bg-background-200/30 transition-colors duration-150 cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground-100">{m.name}</p>
                  <p className="text-[10px] font-label text-foreground-600 mt-0.5">{m.providerName} · {HOSTING_TYPE_LABELS[m.hostingType]} · {MODEL_PURPOSE_LABELS[m.purpose]}</p>
                </div>
                <StatusPill tone={status.tone} label={status.label} />
              </div>
              <div className="mt-2 flex items-center gap-4 text-[11px] font-label text-foreground-500 flex-wrap">
                <span>{agents} agents</span>
                <span>{m.jobsToday} jobs</span>
                <span>{m.speed}</span>
                <span>{m.cost}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}