import { Link } from 'react-router-dom';
import type { AiModel } from '@/pages/ai-operations/types';

const TRIGGERS = [
  'Provider unavailable',
  'Rate limit',
  'Model degraded',
  'Context too large',
  'Tool support required',
  'Local capacity unavailable',
];

export default function FallbackRouting({ model }: { model: AiModel }) {
  const f = model.fallback;

  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg p-4 md:p-5">
      <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Fallback Routing</h3>

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <div className="bg-background-50 border border-background-200/40 rounded-lg px-4 py-3">
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Primary model</p>
          {f.primaryModelId ? (
            <Link to={`/ai-operations/models/${f.primaryModelId}`} className="text-sm font-medium text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer mt-0.5 block">
              {f.primaryModel}
            </Link>
          ) : (
            <p className="text-sm font-medium text-foreground-100 mt-0.5">{f.primaryModel}</p>
          )}
        </div>
        <i className="ri-arrow-right-line text-foreground-500 w-5 h-5 flex items-center justify-center"></i>
        <div className="bg-background-50 border border-background-200/40 rounded-lg px-4 py-3">
          <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide">Fallback model</p>
          {f.fallbackModelId ? (
            <Link to={`/ai-operations/models/${f.fallbackModelId}`} className="text-sm font-medium text-foreground-100 hover:text-accent-400 transition-colors cursor-pointer mt-0.5 block">
              {f.fallbackModel}
            </Link>
          ) : (
            <p className="text-sm font-medium text-foreground-100 mt-0.5">{f.fallbackModel}</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        <div className="flex items-baseline justify-between gap-3 border-b border-background-200/40 pb-2">
          <span className="text-xs font-label text-foreground-600 whitespace-nowrap">Fallback trigger</span>
          <span className="text-sm text-foreground-200 text-right">{f.trigger}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-b border-background-200/40 pb-2">
          <span className="text-xs font-label text-foreground-600 whitespace-nowrap">Provider change</span>
          <span className="text-sm text-foreground-200 text-right">{f.providerChange ? 'Yes' : 'No'}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-b border-background-200/40 pb-2">
          <span className="text-xs font-label text-foreground-600 whitespace-nowrap">Cost change</span>
          <span className="text-sm text-foreground-200 text-right">{f.costChange}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-b border-background-200/40 pb-2">
          <span className="text-xs font-label text-foreground-600 whitespace-nowrap">Capability difference</span>
          <span className="text-sm text-foreground-200 text-right">{f.capabilityDifference}</span>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-label text-foreground-600 uppercase tracking-wide mb-2">Example triggers</p>
        <div className="flex flex-wrap gap-1.5">
          {TRIGGERS.map((t) => (
            <span key={t} className="text-xs text-foreground-500 bg-background-50 border border-background-200/60 rounded-md px-2 py-1">{t}</span>
          ))}
        </div>
      </div>

      <p className="text-[11px] font-label text-foreground-600 mt-3">No routing occurs in this demo.</p>
    </section>
  );
}