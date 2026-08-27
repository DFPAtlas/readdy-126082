import { getProviderHealth } from '@/pages/ai-operations/live/selectors';
import { HEALTH_STATUS } from '@/pages/ai-operations/constants';
import StatusPill from '@/pages/ai-operations/components/StatusPill';

export default function ModelProviderStatus() {
  const providers = getProviderHealth();

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">AI Model Providers</h3>
      </div>

      <div className="divide-y divide-background-200/40">
        {providers.map((p) => {
          const status = HEALTH_STATUS[p.status];
          return (
            <div key={p.provider} className="px-4 py-3 hover:bg-background-200/30 transition-colors duration-150">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground-200">{p.provider}</p>
                <StatusPill tone={status.tone} label={status.label} pulse={p.status === 'degraded'} />
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-sm font-heading font-bold text-foreground-200">{p.activeRequests}</p>
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Active</p>
                </div>
                <div>
                  <p className={`text-sm font-heading font-bold ${p.failedRequests > 0 ? 'text-red-400' : 'text-foreground-200'}`}>{p.failedRequests}</p>
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Failed</p>
                </div>
                <div>
                  <p className="text-sm font-heading font-bold text-foreground-200">{p.avgResponseTime}</p>
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Resp</p>
                </div>
                <div>
                  <p className="text-sm font-heading font-bold text-foreground-200">{p.estimatedCostToday}</p>
                  <p className="text-[9px] font-label text-foreground-600 uppercase tracking-wide">Cost</p>
                </div>
              </div>
              <p className="mt-2 text-[10px] font-label text-foreground-600">Last activity {p.lastActivity}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}