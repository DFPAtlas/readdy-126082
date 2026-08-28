import type { RunnerCase, Draft } from '../lib';

interface Props {
  cases: RunnerCase[];
  drafts: Record<string, Draft>;
  currentIndex: number;
  onSelect: (index: number) => void;
}

/** Compact, accessible case navigator: ○ not started · ✓ pass · ! fail · — blocked. */
export default function CaseNavigator({ cases, drafts, currentIndex, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5" role="navigation" aria-label="Test cases">
      {cases.map((c, i) => {
        const draft = drafts[c.atcId];
        const status = draft?.status || (c.existing?.status && c.existing.status !== 'in_progress' ? c.existing.status : '');
        const isCurrent = i === currentIndex;

        let marker = '○';
        let markerClass = 'text-foreground-400';
        if (status === 'passed') {
          marker = '✓';
          markerClass = 'text-emerald-400';
        } else if (status === 'failed') {
          marker = '!';
          markerClass = 'text-red-400';
        } else if (status === 'blocked') {
          marker = '—';
          markerClass = 'text-orange-400';
        }

        return (
          <button
            key={c.atcId}
            type="button"
            onClick={() => onSelect(i)}
            aria-label={`Case ${i + 1}${status ? ` — ${status}` : ' — not started'}`}
            aria-current={isCurrent ? 'step' : undefined}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
              isCurrent
                ? 'bg-accent-500 border-accent-500 text-background-950'
                : 'bg-background-100 border-background-200/60 text-foreground-300 hover:border-accent-400'
            }`}
          >
            <span className={`flex items-center justify-center ${isCurrent ? '' : markerClass}`}>
              {isCurrent ? i + 1 : marker}
            </span>
          </button>
        );
      })}
    </div>
  );
}