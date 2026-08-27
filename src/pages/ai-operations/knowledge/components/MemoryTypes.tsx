const MEMORY_TYPES = [
  {
    key: 'long_term',
    label: 'Long-Term Knowledge',
    icon: 'ri-book-2-line',
    description: 'Approved persistent documentation — SOPs, policies and product guides.',
    state: 'Prepared',
  },
  {
    key: 'operational',
    label: 'Operational Memory',
    icon: 'ri-history-line',
    description: 'Previous incidents, run outcomes and known fixes used to spot repeated problems.',
    state: 'Prepared',
  },
  {
    key: 'session',
    label: 'Session Context',
    icon: 'ri-chat-3-line',
    description: 'Temporary task-specific context scoped to a single run.',
    state: 'Future phase',
  },
  {
    key: 'agent',
    label: 'Agent Memory',
    icon: 'ri-robot-2-line',
    description: 'Agent-specific learned / approved operational references.',
    state: 'Future phase',
  },
];

export default function MemoryTypes() {
  return (
    <section className="bg-background-100 border border-background-200/60 rounded-lg">
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-3">
        <h3 className="text-sm font-label font-semibold text-foreground-200 uppercase tracking-wide">Memory Architecture</h3>
        <span className="text-[11px] font-label text-foreground-600">Prepared for future phases</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4">
        {MEMORY_TYPES.map((m) => (
          <div key={m.key} className="bg-background-50 border border-background-200/40 rounded-lg p-3.5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center shrink-0">
                <i className={`${m.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
              </div>
              <span className="text-xs font-label font-semibold text-foreground-100">{m.label}</span>
            </div>
            <p className="text-[11px] text-foreground-500 leading-relaxed">{m.description}</p>
            <span className="mt-auto inline-flex items-center text-[10px] font-label text-foreground-600 whitespace-nowrap">
              {m.state}
            </span>
          </div>
        ))}
      </div>
      <div className="px-4 pb-4">
        <p className="text-[11px] font-label text-foreground-600 leading-relaxed">
          No autonomous learning or persistent agent memory is implemented — this structure is prepared for a later phase.
        </p>
      </div>
    </section>
  );
}