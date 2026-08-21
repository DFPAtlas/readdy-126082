import { supabase } from '@/lib/supabase';
import type { Idea } from './types';

const priorityColors: Record<string, string> = {
  low: 'bg-foreground-500/10 text-foreground-400',
  medium: 'bg-secondary-500/10 text-secondary-300',
  high: 'bg-primary-500/10 text-primary-400',
  critical: 'bg-red-500/10 text-red-400',
};

interface Props {
  idea: Idea;
  onEdit: (idea: Idea) => void;
  onStatusChange: () => void;
}

const statuses = ['new', 'reviewing', 'approved', 'building', 'done', 'rejected'];

export default function IdeaCard({ idea, onEdit, onStatusChange }: Props) {
  const handleStatusChange = async (newStatus: string) => {
    await supabase.from('internal_ideas').update({ status: newStatus }).eq('id', idea.id);
    await supabase.from('internal_activity_log').insert({
      user_id: (await supabase.auth.getSession()).data.session?.user.id ?? null,
      action: 'updated',
      entity_type: 'idea',
      entity_id: idea.id,
      project_id: idea.related_project_id,
      description: `Moved idea "${idea.idea_name}" to ${newStatus.replace('_', ' ')}`,
    });
    onStatusChange();
  };

  return (
    <div className="bg-background-50 border border-background-200/60 rounded-lg p-3.5 hover:border-accent-500/30 transition-colors duration-150 group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-foreground-100 leading-snug flex-1 min-w-0">{idea.idea_name}</h4>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(idea)} className="w-6 h-6 flex items-center justify-center text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer">
            <i className="ri-edit-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i>
          </button>
        </div>
      </div>

      {idea.category && (
        <span className="inline-block text-[10px] font-label text-foreground-500 bg-background-200/50 px-1.5 py-0.5 rounded mb-2 whitespace-nowrap">
          {idea.category}
        </span>
      )}

      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-label px-1.5 py-0.5 rounded whitespace-nowrap ${priorityColors[idea.priority] ?? ''}`}>
            {idea.priority}
          </span>
        </div>

        <select
          value={idea.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] font-label bg-background-100 border border-background-300/40 rounded px-1.5 py-0.5 text-foreground-400 outline-none cursor-pointer capitalize hover:border-accent-500/30 transition-colors"
        >
          {statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {idea.project_name && (
        <p className="text-[10px] text-foreground-600 mt-2 truncate">{idea.project_name}</p>
      )}
    </div>
  );
}