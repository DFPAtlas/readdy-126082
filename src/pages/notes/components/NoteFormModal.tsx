import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';

interface Note {
  id: number;
  title: string;
  project_id: number | null;
  category: string;
  content: string | null;
  tags: string[] | null;
  pinned: boolean;
}

interface Project {
  id: number;
  project_name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  note: Note | null;
}

const noteTypes = ['general', 'meeting', 'decision', 'legal', 'pricing', 'client_feedback', 'supplier', 'research', 'other'];

const typeLabels: Record<string, string> = {
  general: 'General',
  meeting: 'Meeting',
  decision: 'Decision',
  legal: 'Legal',
  pricing: 'Pricing',
  client_feedback: 'Client Feedback',
  supplier: 'Supplier',
  research: 'Research',
  other: 'Other',
};

export default function NoteFormModal({ open, onClose, onSaved, note }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<number | ''>('');
  const [category, setCategory] = useState('general');
  const [content, setContent] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('internal_projects').select('id,project_name').order('project_name').then(({ data }) => setProjects(data ?? []));
  }, []);

  useEffect(() => {
    if (!open) return;
    if (note) {
      setTitle(note.title);
      setProjectId(note.project_id ?? '');
      setCategory(note.category);
      setContent(note.content ?? '');
      setTagsStr((note.tags ?? []).join(', '));
      setPinned(note.pinned);
    } else {
      setTitle('');
      setProjectId('');
      setCategory('general');
      setContent('');
      setTagsStr('');
      setPinned(false);
    }
    setError('');
  }, [open, note]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    setError('');
    setSaving(true);

    const tagsArray = tagsStr.trim() ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : null;

    const payload = {
      title: title.trim(),
      project_id: projectId === '' ? null : (projectId as number),
      category,
      content: content.trim() || null,
      tags: tagsArray,
      pinned,
    };

    if (note) {
      await supabase.from('internal_notes').update(payload).eq('id', note.id);
      await logActivity('updated', projectId === '' ? null : (projectId as number), `Updated note: ${title.trim()}`);
    } else {
      await supabase.from('internal_notes').insert(payload);
      await logActivity('created', projectId === '' ? null : (projectId as number), `Created note: ${title.trim()}`);
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  const handleDelete = async () => {
    if (!note) return;
    setDeleting(true);
    await supabase.from('internal_notes').delete().eq('id', note.id);
    await logActivity('deleted', note.project_id, `Deleted note: ${note.title}`);
    setDeleting(false);
    onSaved();
    onClose();
  };

  const handlePinToggle = () => {
    setPinned((prev) => !prev);
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={note ? 'Edit Note' : 'New Note'}
      className="max-w-2xl"
      footer={
        <>
          <div>
            {note && (
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
              {saving ? 'Saving...' : note ? 'Save Changes' : 'Create Note'}
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

        <div className="flex items-start gap-3">
          <div className="flex-1">
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors" />
          </div>
          <button
            type="button"
            onClick={handlePinToggle}
            className={`mt-6 w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0 ${pinned ? 'bg-accent-500/10 text-accent-400 border border-accent-500/30' : 'bg-background-50 border border-background-300/60 text-foreground-500 hover:text-foreground-300'}`}
          >
            <i className={`${pinned ? 'ri-pushpin-fill' : 'ri-pushpin-line'} text-sm w-4 h-4 flex items-center justify-center`}></i>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer">
              <option value="">No project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Type</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer">
              {noteTypes.map((t) => <option key={t} value={t}>{typeLabels[t]}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Content</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your note here..." rows={6} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none" />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Tags</label>
          <input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="comma, separated, tags" className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors" />
        </div>
      </form>
    </Modal>
  );
}

async function logActivity(action: string, projectId: number | null, description: string) {
  await supabase.from('internal_activity_log').insert({
    user_id: (await supabase.auth.getSession()).data.session?.user.id ?? null,
    action,
    entity_type: 'note',
    project_id: projectId,
    description,
  });
}