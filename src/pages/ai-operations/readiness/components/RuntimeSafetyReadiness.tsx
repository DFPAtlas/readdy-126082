import { Link } from 'react-router-dom';
import {
  runtimeSafetyControls,
  pilotExecutionGate,
  type RuntimeHealthReadinessState,
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

export default function RuntimeSafetyReadiness() {
  return (
    <div className="space-y-4">
      <section className="bg-background-100 border border-background-200/60 rounded-lg">
        <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Phase 3 — Runtime Safety Controls</h3>
            <span className="inline-flex items-center gap-1 text-[10px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">control ready</span>
          </div>
          <Link
            to="/ai-operations/runtime-controls"
            className="inline-flex items-center gap-1.5 text-xs font-label text-accent-400 bg-accent-500/10 border border-accent-500/20 rounded-md px-2.5 py-1.5 hover:bg-accent-500/20 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-external-link-line w-3.5 h-3.5 flex items-center justify-center"></i>
            Open Runtime Controls
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
          {runtimeSafetyControls.map((item) => {
            const meta = STATE_META[item.state];
            return (
              <div key={item.name} className="bg-background-50 border border-background-200/60 rounded-md px-3 py-2.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm text-foreground-100">{item.name}</p>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-label whitespace-nowrap border ${TONE_STYLES[meta.tone]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${meta.tone === 'emerald' ? 'bg-emerald-400' : meta.tone === 'amber' ? 'bg-amber-400' : 'bg-secondary-400'}`}></span>
                    {meta.label}
                  </span>
                </div>
                <p className="text-xs text-foreground-500">{item.note}</p>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-background-200/60 flex items-center gap-2.5">
          <i className="ri-information-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center shrink-0"></i>
          <p className="text-xs text-foreground-500">
            <strong className="text-foreground-300">Control exists ≠ execution authorised.</strong> These controls are Ready as governance, but production remains <strong className="text-foreground-300">NO-GO</strong> with <strong className="text-foreground-300">Production Enabled = 0</strong>.
          </p>
        </div>
      </section>

      {/* Pilot execution gate */}
      <section className="bg-background-100 border border-background-200/60 rounded-lg">
        <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">{pilotExecutionGate.name}</h3>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-red-400 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap">
              <i className="ri-lock-line w-3 h-3 flex items-center justify-center"></i>
              Blocked
            </span>
          </div>
        </div>

        <p className="px-4 py-3 text-xs text-foreground-500 leading-relaxed">{pilotExecutionGate.summary}</p>

        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {pilotExecutionGate.requirements.map((req) => (
            <div key={req.label} className="flex items-center gap-2 bg-background-50 border border-background-200/60 rounded-md px-3 py-2">
              <i className={`${req.met ? 'ri-checkbox-circle-line text-emerald-400' : 'ri-indeterminate-circle-line text-red-400'} w-4 h-4 flex items-center justify-center shrink-0`}></i>
              <span className="text-xs text-foreground-300">{req.label}</span>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-background-200/60 flex items-center gap-2.5">
          <i className="ri-information-line text-foreground-600 text-sm w-4 h-4 flex items-center justify-center shrink-0"></i>
          <p className="text-xs text-foreground-500">
            A future prompt will control pilot runtime activation. Turning off the master kill switch or allowing a site/agent is <strong className="text-foreground-300">not</strong> performed in this phase.
          </p>
        </div>
      </section>
    </div>
  );
}