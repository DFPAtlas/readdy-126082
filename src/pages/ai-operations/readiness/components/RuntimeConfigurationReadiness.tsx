import { Link } from 'react-router-dom';
import {
  runtimeConfigurationReadiness,
  runtimeConnectionConfigurationGate,
  type RuntimeHealthReadinessState,
  type Phase3GateItemState,
} from '@/mocks/ai-operations-readiness-3';

const STATE_META: Record<RuntimeHealthReadinessState, { label: string; tone: 'emerald' | 'amber' | 'secondary' }> = {
  ready: { label: 'Ready', tone: 'emerald' },
  not_started: { label: 'Not Started', tone: 'secondary' },
  not_configured: { label: 'Not Configured', tone: 'secondary' },
  partial: { label: 'Partial', tone: 'amber' },
};

const TONE_STYLES: Record<'emerald' | 'amber' | 'secondary', string> = {
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  secondary: 'bg-secondary-500/15 text-secondary-300 border-secondary-500/25',
};

const GATE_ITEM_STYLES: Record<Phase3GateItemState, string> = {
  verified: 'text-emerald-400',
  pending: 'text-amber-400',
  blocked: 'text-red-400',
};

export default function RuntimeConfigurationReadiness() {
  return (
    <div className="space-y-4">
      <section className="bg-background-100 border border-background-200/60 rounded-lg">
        <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Phase 3 — Runtime Configuration</h3>
            <span className="inline-flex items-center gap-1 text-[10px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">in progress</span>
          </div>
          <Link
            to="/ai-operations/runtime-health"
            className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-external-link-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Open Configuration
          </Link>
        </div>

        <div className="divide-y divide-background-200/40">
          {runtimeConfigurationReadiness.map((item) => {
            const meta = STATE_META[item.state];
            return (
              <div key={item.name} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-foreground-100">{item.name}</p>
                  <p className="text-xs text-foreground-500 mt-0.5">{item.note}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-label whitespace-nowrap border ${TONE_STYLES[meta.tone]}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.tone === 'emerald' ? 'bg-emerald-400' : meta.tone === 'amber' ? 'bg-amber-400' : 'bg-secondary-400'}`}></span>
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-background-200/60 flex items-center gap-2.5">
          <i className="ri-information-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center"></i>
          <p className="text-xs text-foreground-500">
            Configuration is marked <strong className="text-foreground-300">Ready</strong> only when both required server-side configuration is present and a safe runtime verification has passed. Secret presence is checked server-side — values are never exposed.
          </p>
        </div>
      </section>

      {/* Phase 3 gate */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg">
        <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">{runtimeConnectionConfigurationGate.name}</h3>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
              <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
              Blocked
            </span>
          </div>
        </div>

        <p className="px-4 py-3 text-xs text-foreground-500 leading-relaxed">
          {runtimeConnectionConfigurationGate.summary}
        </p>

        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {runtimeConnectionConfigurationGate.items.map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-3 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
              <span className="text-xs text-foreground-300">{item.name}</span>
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-label capitalize ${GATE_ITEM_STYLES[item.state]}`}>
                <i className={`w-3.5 h-3.5 flex items-center justify-center ${item.state === 'verified' ? 'ri-checkbox-circle-line' : item.state === 'pending' ? 'ri-time-line' : 'ri-close-circle-line'}`}></i>
                {item.state}
              </span>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-background-200/60 flex items-center gap-2.5">
          <i className="ri-information-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center shrink-0"></i>
          <p className="text-xs text-foreground-500">
            This gate stays <strong className="text-foreground-300">Blocked</strong> until the connections required for the first pilot agent are genuinely verified. Not every optional provider needs to be green — future pilot requirements derive from the selected pilot agent's dependencies. Even if all become Ready, agent execution is not enabled here.
          </p>
        </div>
      </section>
    </div>
  );
}