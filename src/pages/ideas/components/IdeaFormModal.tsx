import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';

interface Idea {
  id: number;
  idea_name: string;
  related_project_id: number;
  category: string | null;
  priority: string;
  status: string;
  description: string | null;
  owner: string | null;
  ai_generated: boolean;
  notes: string | null;
}

interface Project {
  id: number;
  project_name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  idea: Idea | null;
}

const statuses = ['new', 'reviewing', 'approved', 'building', 'done', 'rejected'];
const priorities = ['low', 'medium', 'high', 'critical'];
const categorySuggestions = ['Core Feature', 'Security', 'Architecture', 'Mobile', 'Partnerships', 'AI/ML', 'Revenue', 'Compliance', 'UX/UI', 'Performance', 'Other'];

export default function IdeaFormModal({ open, onClose, onSaved, idea }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [ideaName, setIdeaName] = useState('');
  const [projectId, setProjectId] = useState<number | ''>('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState(false);
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('new');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('internal_projects').select('id,project_name').order('project_name').then(({ data }) => setProjects(data ?? []));
  }, []);

  useEffect(() => {
    if (!open) return;
    if (idea) {
      setIdeaName(idea.idea_name);
      setProjectId(idea.related_project_id);
      setCategory(idea.category ?? '');
      setCustomCategory(!!(idea.category && !categorySuggestions.includes(idea.category)));
      setPriority(idea.priority);
      setStatus(idea.status);
      setDescription(idea.description ?? '');
      setOwner(idea.owner ?? '');
      setNotes(idea.notes ?? '');
    } else {
      setIdeaName('');
      setProjectId('');
      setCategory('');
      setCustomCategory(false);
      setPriority('medium');
      setStatus('new');
      setDescription('');
      setOwner('');
      setNotes('');
    }
    setError('');
  }, [open, idea]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ideaName.trim() || projectId === '') { setError('Title and project are required.'); return; }
    setError('');
    setSaving(true);

    const payload = {
      idea_name: ideaName.trim(),
      related_project_id: projectId as number,
      category: category.trim() || null,
      priority,
      status,
      description: description.trim() || null,
      owner: owner.trim() || null,
      notes: notes.trim() || null,
    };

    if (idea) {
      await supabase.from('internal_ideas').update(payload).eq('id', idea.id);
      await logActivity('updated', projectId as number, `Updated idea: ${ideaName.trim()}`);
    } else {
      await supabase.from('internal_ideas').insert(payload);
      await logActivity('created', projectId as number, `Created idea: ${ideaName.trim()}`);
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  const handleDelete = async () => {
    if (!idea) return;
    setDeleting(true);
    await supabase.from('internal_ideas').delete().eq('id', idea.id);
    await logActivity('deleted', idea.related_project_id, `Deleted idea: ${idea.idea_name}`);
    setDeleting(false);
    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={idea ? 'Edit Idea' : 'New Idea'}
      className="max-w-2xl"
      footer={
        <>
          <div>
            {idea && (
              <button type="button" onClick={handleDelete} disabled={deleting} className="text-sm text-red-400 hover:text-red-300 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="text-sm text-foreground-400 hover:text-foreground-200 transition-colors whitespace-nowrap cursor-pointer">
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={saving} className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-background-950 text-sm font-semibold px-5 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer">
              {saving ? 'Saving...' : idea ? 'Save Changes' : 'Create Idea'}
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
          <input value={ideaName} onChange={(e) => setIdeaName(e.target.value)} placeholder="Idea title" className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors" />
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
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Owner</label>
            <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Team member" className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors" />
          </div>

          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Category</label>
            {customCategory ? (
              <div className="flex gap-2">
                <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Custom category" className="flex-1 bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors" />
                <button type="button" onClick={() => { setCustomCategory(false); setCategory(''); }} className="text-xs text-accent-400 hover:text-accent-300 whitespace-nowrap cursor-pointer">Presets</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="flex-1 bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer">
                  <option value="">None</option>
                  {categorySuggestions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button type="button" onClick={() => { setCustomCategory(true); setCategory(''); }} className="text-xs text-accent-400 hover:text-accent-300 whitespace-nowrap cursor-pointer">Custom</button>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this idea about?" rows={3} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none" />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none" />
        </div>
      </form>
    </Modal>
  );
}

async function logActivity(action: string, projectId: number, description: string) {
  await supabase.from('internal_activity_log').insert({
    user_id: (await supabase.auth.getSession()).data.session?.user.id ?? null,
    action,
    entity_type: 'idea',
    project_id: projectId,
    description,
  });
}