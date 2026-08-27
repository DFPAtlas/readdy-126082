import { Link } from 'react-router-dom';
import type { AiProvider } from '@/pages/ai-operations/types';
import { MODEL_STATUS, PROVIDER_TYPE_LABELS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function ProviderStatus({ providers }: { providers: AiProvider[] }) {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Provider Status</h3>
        <span className="text-[10px] font-label text-foreground-600">Registry metadata — no live checks</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-background-200/40">
        {providers.map((p) => {
          const status = MODEL_STATUS[p.status];
          return (
            <div key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground-100">{p.name}</p>
                  <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide mt-0.5">{PROVIDER_TYPE_LABELS[p.type]}</p>
                </div>
                <StatusPill tone={status.tone} label={status.label} pulse={p.status === 'degraded'} />
              </div>

              <p className="text-xs text-foreground-500 mt-3 line-clamp-2 leading-relaxed">{p.description}</p>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-sm font-heading font-bold text-foreground-100">{p.availableModels}</p>
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Models</p>
                </div>
                <div>
                  <p className={`text-sm font-heading font-bold ${p.failures > 0 ? 'text-red-400' : 'text-foreground-100'}`}>{p.failures}</p>
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Failures</p>
                </div>
                <div>
                  <p className="text-sm font-heading font-bold text-foreground-100">{p.estimatedCostToday}</p>
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Cost</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[10px] font-label text-foreground-600">Active {p.activeRequests} · Resp {p.avgResponseTime}</p>
                {p.connectionId ? (
                  <Link
                    to={`/ai-operations/tools/${p.connectionId}`}
                    className="inline-flex items-center gap-1 text-[11px] font-label text-accent-400 hover:text-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Connection
                    <i className="ri-arrow-right-line w-3 h-3 flex items-center justify-center"></i>
                  </Link>
                ) : (
                  <span className="text-[10px] font-label text-foreground-600">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}