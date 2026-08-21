import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';

interface ChangeRequest {
  id: number;
  title: string;
  project_id: number;
  description: string | null;
  priority: string;
  status: string;
  type: string | null;
  requested_by: string | null;
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
  cr: ChangeRequest | null;
}

const priorities = ['low', 'medium', 'high', 'critical'];
const statuses = ['requested', 'approved', 'in_progress', 'testing', 'completed', 'rejected'];
const typeOptions = ['bug_fix', 'feature', 'enhancement', 'security', 'performance', 'other'];

export default function ChangeRequestFormModal({ open, onClose, onSaved, cr }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('requested');
  const [type, setType] = useState('');
  const [requestedBy, setRequestedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('internal_projects').select('id,project_name').order('project_name').then(({ data }) => setProjects(data ?? []));
  }, []);

  useEffect(() => {
    if (!open) return;
    if (cr) {
      setTitle(cr.title);
      setProjectId(cr.project_id);
      setDescription(cr.description ?? '');
      setPriority(cr.priority);
      setStatus(cr.status);
      setType(cr.type ?? '');
      setRequestedBy(cr.requested_by ?? '');
      setNotes(cr.notes ?? '');
    } else {
      setTitle('');
      setProjectId('');
      setDescription('');
      setPriority('medium');
      setStatus('requested');
      setType('');
      setRequestedBy('');
      setNotes('');
    }
    setError('');
  }, [open, cr]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || projectId === '') { setError('Title and project are required.'); return; }
    setError('');
    setSaving(true);

    const payload = {
      title: title.trim(),
      project_id: projectId as number,
      description: description.trim() || null,
      priority,
      status,
      type: type.trim() || null,
      requested_by: requestedBy.trim() || null,
      notes: notes.trim() || null,
    };

    if (cr) {
      await supabase.from('internal_change_requests').update(payload).eq('id', cr.id);
      await logActivity('updated', 'change_request', cr.id, projectId as number, `Updated change request: ${title.trim()}`);
    } else {
      await supabase.from('internal_change_requests').insert(payload);
      await logActivity('created', 'change_request', null, projectId as number, `Created change request: ${title.trim()}`);
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  const handleDelete = async () => {
    if (!cr) return;
    setDeleting(true);
    await supabase.from('internal_change_requests').delete().eq('id', cr.id);
    await logActivity('deleted', 'change_request', cr.id, cr.project_id, `Deleted change request: ${cr.title}`);
    setDeleting(false);
    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={cr ? 'Edit Change Request' : 'New Change Request'}
      className="max-w-2xl"
      footer={
        <>
          <div>
            {cr && (
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
              {saving ? 'Saving...' : cr ? 'Save Changes' : 'Create Request'}
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
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What change is needed?" className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Project *</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer">
              <option value="">Select project...</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize">
              {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize">
              {statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer">
              <option value="">None</option>
              {typeOptions.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Requested By</label>
            <input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} placeholder="Team member name" className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the change request in detail..." rows={4} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none" />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none" />
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