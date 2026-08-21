import type { Idea } from './types';
import IdeaCard from './IdeaCard';

const statusMeta: Record<string, { label: string; color: string; dotColor: string }> = {
  new: { label: 'New', color: 'bg-secondary-500/5 border-secondary-500/20', dotColor: 'bg-secondary-400' },
  reviewing: { label: 'Reviewing', color: 'bg-yellow-500/5 border-yellow-500/20', dotColor: 'bg-yellow-400' },
  approved: { label: 'Approved', color: 'bg-sky-500/5 border-sky-500/20', dotColor: 'bg-sky-400' },
  building: { label: 'Building', color: 'bg-accent-500/5 border-accent-500/20', dotColor: 'bg-accent-400' },
  done: { label: 'Done', color: 'bg-emerald-500/5 border-emerald-500/20', dotColor: 'bg-emerald-400' },
  rejected: { label: 'Rejected', color: 'bg-foreground-500/5 border-foreground-500/20', dotColor: 'bg-foreground-400' },
};

interface Props {
  status: string;
  ideas: Idea[];
  onEdit: (idea: Idea) => void;
  onStatusChange: () => void;
}

export default function KanbanColumn({ status, ideas, onEdit, onStatusChange }: Props) {
  const meta = statusMeta[status] ?? { label: status, color: '', dotColor: 'bg-foreground-400' };

  return (
    <div className={`flex-shrink-0 w-[280px] rounded-xl border ${meta.color} flex flex-col`}>
      <div className="flex items-center gap-2 px-3.5 py-3 border-b border-background-200/40">
        <div className={`w-2 h-2 rounded-full ${meta.dotColor} shrink-0`}></div>
        <span className="text-xs font-label font-semibold text-foreground-300 uppercase tracking-wide whitespace-nowrap">{meta.label}</span>
        <span className="text-[11px] text-foreground-500 tabular-nums ml-auto">{ideas.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]">
        {ideas.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-xs text-foreground-600">
            No ideas
          </div>
        ) : (
          ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} onEdit={onEdit} onStatusChange={onStatusChange} />
          ))
        )}
      </div>
    </div>
  );
}