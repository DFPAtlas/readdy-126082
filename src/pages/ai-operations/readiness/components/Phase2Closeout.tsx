import {
  phase2ControlPlane,
  phase2Runtime,
  phase3EntryGates,
  noGoReasons,
  phase2ProductionEnabled,
  phase2Overall,
  type Phase2CloseoutItem,
} from '@/mocks/ai-operations-readiness-3';
import Section from '@/pages/ai-operations/readiness/components/Section';

function StatePill({ state }: { state: Phase2CloseoutItem['state'] }) {
  if (state === 'complete') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-label border bg-emerald-500/15 text-emerald-400 border-emerald-500/25 whitespace-nowrap">
        <i className="ri-check-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i>
        Complete
      </span>
    );
  }
  if (state === 'blocked') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-label border bg-red-500/15 text-red-400 border-red-500/25 whitespace-nowrap">
        Blocked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-label border bg-secondary-500/15 text-secondary-300 border-secondary-500/25 whitespace-nowrap">
      Not Started
    </span>
  );
}

function Checklist({ items }: { items: Phase2CloseoutItem[] }) {
  return (
    <div className="space-y-1.5">
      {items.map((i) => (
        <div key={i.name} className="flex items-center justify-between gap-3 border border-background-200/50 rounded-lg px-3 py-2">
          <span className="text-sm text-foreground-100">{i.name}</span>
          <StatePill state={i.state} />
        </div>
      ))}
    </div>
  );
}

export default function Phase2Closeout() {
  return (
    <Section
      icon="ri-flag-2-line"
      title="Phase 2 Closeout — Control Plane Complete, Runtime Pending"
      subtitle="Phase 2 control-plane persistence and cross-module wiring are complete. Runtime execution, monitoring and connectivity remain Not Started, so the platform stays NO-GO."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <h4 className="text-xs font-label font-semibold uppercase tracking-wide text-foreground-500 mb-2">Control Plane</h4>
          <Checklist items={phase2ControlPlane} />
        </div>
        <div>
          <h4 className="text-xs font-label font-semibold uppercase tracking-wide text-foreground-500 mb-2">Runtime</h4>
          <Checklist items={phase2Runtime} />
        </div>
      </div>

      {/* Production status summary */}
      <div className="mt-5 flex flex-col sm:flex-row items-stretch gap-3">
        <div className="flex-1 border border-red-500/30 bg-red-500/5 rounded-lg p-4 flex items-center gap-3">
          <i className="ri-close-circle-line text-red-400 text-2xl w-6 h-6 flex items-center justify-center shrink-0"></i>
          <div>
            <p className="text-lg font-heading font-bold text-red-400">{phase2Overall}</p>
            <p className="text-xs text-foreground-500">Overall production status.</p>
          </div>
        </div>
        <div className="flex-1 border border-background-200/60 bg-background-50 rounded-lg p-4 flex items-center gap-3">
          <i className="ri-toggle-line text-secondary-300 text-2xl w-6 h-6 flex items-center justify-center shrink-0"></i>
          <div>
            <p className="text-lg font-heading font-bold text-foreground-100">Production Enabled · {phase2ProductionEnabled}</p>
            <p className="text-xs text-foreground-500">Runtime execution remains disabled.</p>
          </div>
        </div>
      </div>

      {/* Phase 3 entry gates */}
      <div className="mt-5">
        <h4 className="text-xs font-label font-semibold uppercase tracking-wide text-foreground-500 mb-2">
          Phase 3 Entry Gates (planning only — not implemented)
        </h4>
        <div className="flex flex-wrap gap-2">
          {phase3EntryGates.map((g) => (
            <span key={g} className="inline-flex items-center gap-1.5 text-xs text-foreground-300 border border-background-300/50 rounded-full px-3 py-1 whitespace-nowrap">
              <i className="ri-shield-check-line text-accent-400 w-3.5 h-3.5 flex items-center justify-center"></i>
              {g}
            </span>
          ))}
        </div>
      </div>

      {/* NO-GO reasons */}
      <div className="mt-5">
        <h4 className="text-xs font-label font-semibold uppercase tracking-wide text-foreground-500 mb-2">Why the platform remains NO-GO</h4>
        <ul className="space-y-1.5">
          {noGoReasons.map((r) => (
            <li key={r} className="flex items-center gap-2.5 text-sm text-foreground-300">
              <i className="ri-indeterminate-circle-line text-red-400 text-sm w-4 h-4 flex items-center justify-center shrink-0"></i>
              {r}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-foreground-600 mt-2">
          Persistence completion alone does not make the platform production-ready; runtime, connectivity and enforcement remain outstanding.
        </p>
      </div>
    </Section>
  );
}