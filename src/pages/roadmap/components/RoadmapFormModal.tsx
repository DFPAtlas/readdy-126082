import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';

interface RoadmapItem {
  id: number;
  title: string;
  project_id: number;
  phase: string;
  status: string;
  priority: string;
  target_date: string | null;
  description: string | null;
  completed_at: string | null;
  created_by: string | null;
}

interface Project {
  id: number;
  project_name: string;
}

interface Idea {
  id: number;
  title: string;
}

interface ChangeRequest {
  id: number;
  title: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  item: RoadmapItem | null;
}

const phases = ['phase_1', 'phase_2', 'phase_3', 'future'];
const statuses = ['planned', 'in_progress', 'blocked', 'completed'];
const priorities = ['low', 'medium', 'high', 'critical'];

const phaseLabels: Record<string, string> = {
  phase_1: 'Phase 1',
  phase_2: 'Phase 2',
  phase_3: 'Phase 3',
  future: 'Future',
};

export default function RoadmapFormModal({ open, onClose, onSaved, item }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<number | ''>('');
  const [phase, setPhase] = useState('phase_1');
  const [status, setStatus] = useState('planned');
  const [priority, setPriority] = useState('medium');
  const [targetDate, setTargetDate] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('internal_projects').select('id,project_name').order('project_name').then(({ data }) => setProjects(data ?? []));
  }, []);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setTitle(item.title);
      setProjectId(item.project_id);
      setPhase(item.phase);
      setStatus(item.status);
      setPriority(item.priority);
      setTargetDate(item.target_date ?? '');
      setDescription(item.description ?? '');
    } else {
      setTitle('');
      setProjectId('');
      setPhase('phase_1');
      setStatus('planned');
      setPriority('medium');
      setTargetDate('');
      setDescription('');
    }
    setError('');
  }, [open, item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || projectId === '') { setError('Title and project are required.'); return; }
    setError('');
    setSaving(true);

    const payload = {
      title: title.trim(),
      project_id: projectId as number,
      phase,
      status,
      priority,
      target_date: targetDate || null,
      description: description.trim() || null,
    };

    if (item) {
      await supabase.from('internal_roadmap').update(payload).eq('id', item.id);
      await logActivity('updated', 'roadmap', item.id, projectId as number, `Updated roadmap item: ${title.trim()}`);
    } else {
      await supabase.from('internal_roadmap').insert(payload);
      await logActivity('created', 'roadmap', null, projectId as number, `Added to roadmap: ${title.trim()}`);
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  const handleDelete = async () => {
    if (!item) return;
    await supabase.from('internal_roadmap').delete().eq('id', item.id);
    await logActivity('deleted', 'roadmap', item.id, item.project_id, `Removed from roadmap: ${item.title}`);
    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? 'Edit Roadmap Item' : 'Add to Roadmap'}
      className="max-w-2xl"
      footer={
        <>
          <div>
            {item && (
              <button type="button" onClick={handleDelete} className="text-sm text-red-400 hover:text-red-300 transition-colors whitespace-nowrap cursor-pointer">
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="text-sm text-foreground-400 hover:text-foreground-200 transition-colors whitespace-nowrap cursor-pointer">
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={saving} className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-background-950 text-sm font-semibold px-5 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer">
              {saving ? 'Saving...' : item ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be built?" className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Project *</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer">
              <option value="">Select project...</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Phase</label>
            <select value={phase} onChange={(e) => setPhase(e.target.value)} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer">
              {phases.map((p) => <option key={p} value={p}>{phaseLabels[p]}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize">
              {statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize">
              {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Target Date</label>
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Scope, key deliverables, and any dependencies" rows={3} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none" />
        </div>
      </form>
    </Modal>
  );
}

async function logActivity(action: string, entity: string, entityId: number | null, projectId: number, description: string) {
  await supabase.from('internal_activity_log').insert({
    user_id: (await supabase.auth.getSession()).data.session?.user.id ?? null,
    action,
    entity_type: entity,
    entity_id: entityId,
    project_id: projectId,
    description,
  });
}