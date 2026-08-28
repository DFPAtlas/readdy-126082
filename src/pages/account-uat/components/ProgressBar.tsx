interface Props {
  completed: number;
  total: number;
}

export default function ProgressBar({ completed, total }: Props) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-foreground-500 whitespace-nowrap">
          {completed} / {total} completed
        </span>
        <span className="text-xs font-medium text-foreground-300 whitespace-nowrap">{pct}%</span>
      </div>
      <div className="h-1.5 w-full bg-background-200/60 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}