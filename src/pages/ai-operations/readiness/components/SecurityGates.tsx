import { securityGates } from '@/mocks/ai-operations-readiness-2';
import Section from '@/pages/ai-operations/readiness/components/Section';

function StatePill({ state }: { state: 'pass' | 'blocked' | 'partial' }) {
  const map = {
    pass: { tone: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', label: 'Pass' },
    blocked: { tone: 'bg-red-500/15 text-red-400 border-red-500/25', label: 'Blocked' },
    partial: { tone: 'bg-amber-500/15 text-amber-400 border-amber-500/25', label: 'Partial' },
  } as const;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-label whitespace-nowrap border ${map[state].tone}`}>
      {map[state].label}
    </span>
  );
}

export default function SecurityGates() {
  const blockedCount = securityGates.filter((g) => g.state === 'blocked').length;
  return (
    <Section
      icon="ri-shield-keyhole-line"
      title="Production Security Gates"
      subtitle="All gates must PASS before live execution. Execution remains blocked until then."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
        {securityGates.map((g) => (
          <div key={g.id} className="flex items-start justify-between gap-3 border border-background-200/60 rounded-lg px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-label font-medium text-foreground-100">{g.label}</p>
              <p className="text-[11px] text-foreground-500">{g.owner}{g.note ? ` · ${g.note}` : ''}</p>
            </div>
            <StatePill state={g.state} />
          </div>
        ))}
      </div>

      {/* Kill switch requirement */}
      <div className="border border-red-500/25 bg-red-500/5 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <i className="ri-shut-down-line text-red-400 text-sm w-4 h-4 flex items-center justify-center"></i>
          <h3 className="text-sm font-label font-semibold text-foreground-100">AI Operations Master Kill Switch</h3>
        </div>
        <p className="text-xs text-foreground-400 mb-3">
          <span className="font-label font-semibold text-red-400">Required before production agent execution.</span>{' '}
          Will support: stop new orchestration, stop new agent work, preserve monitoring, preserve audit, allow staff access, and not destroy queued records.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {['Stop new orchestration', 'Stop new agent work', 'Preserve monitoring', 'Preserve audit', 'Allow staff access', 'Not destroy queued records'].map((cap) => (
            <span key={cap} className="inline-flex items-center gap-1 text-[11px] font-label text-foreground-500 bg-background-50 border border-background-300/60 rounded-full px-2 py-0.5">
              <i className="ri-lock-2-line text-foreground-600 text-xs w-3 h-3 flex items-center justify-center"></i>
              {cap}
            </span>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-foreground-600 mt-3">{blockedCount} of {securityGates.length} security gates currently blocked.</p>
    </Section>
  );
}