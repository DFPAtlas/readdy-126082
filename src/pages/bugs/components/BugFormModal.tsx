import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';

interface Bug {
  id: number;
  title: string;
  project_id: number;
  severity: string;
  status: string;
  type: string | null;
  description: string | null;
  reported_by: string | null;
  assigned_to: string | null;
  steps_to_reproduce: string | null;
  environment: string | null;
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
  bug: Bug | null;
}

const severities = ['low', 'medium', 'high', 'critical'];
const statuses = ['open', 'investigating', 'in_progress', 'fixed', 'wont_fix', 'duplicate'];

const severityLabels: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export default function BugFormModal({ open, onClose, onSaved, bug }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<number | ''>('');
  const [severity, setSeverity] = useState('medium');
  const [status, setStatus] = useState('open');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [environment, setEnvironment] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('internal_projects').select('id,project_name').order('project_name').then(({ data }) => setProjects(data ?? []));
  }, []);

  useEffect(() => {
    if (!open) return;
    if (bug) {
      setTitle(bug.title);
      setProjectId(bug.project_id);
      setSeverity(bug.severity);
      setStatus(bug.status);
      setDescription(bug.description ?? '');
      setType(bug.type ?? '');
      setStepsToReproduce(bug.steps_to_reproduce ?? '');
      setEnvironment(bug.environment ?? '');
      setNotes(bug.notes ?? '');
    } else {
      setTitle('');
      setProjectId('');
      setSeverity('medium');
      setStatus('open');
      setDescription('');
      setType('');
      setStepsToReproduce('');
      setEnvironment('');
      setNotes('');
    }
    setError('');
  }, [open, bug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || projectId === '') { setError('Title and project are required.'); return; }
    setError('');
    setSaving(true);

    const payload = {
      title: title.trim(),
      project_id: projectId as number,
      severity,
      status,
      description: description.trim() || null,
      type: type.trim() || null,
      steps_to_reproduce: stepsToReproduce.trim() || null,
      environment: environment.trim() || null,
      notes: notes.trim() || null,
    };

    if (bug) {
      await supabase.from('internal_bugs').update(payload).eq('id', bug.id);
      await logActivity('updated', 'bug', bug.id, projectId as number, `Updated bug: ${title.trim()}`);
    } else {
      await supabase.from('internal_bugs').insert(payload);
      await logActivity('created', 'bug', null, projectId as number, `Reported bug: ${title.trim()}`);
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  const handleDelete = async () => {
    if (!bug) return;
    setDeleting(true);
    await supabase.from('internal_bugs').delete().eq('id', bug.id);
    await logActivity('deleted', 'bug', bug.id, bug.project_id, `Deleted bug: ${bug.title}`);
    setDeleting(false);
    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={bug ? 'Edit Bug' : 'Report Bug'}
      className="max-w-2xl"
      footer={
        <>
          <div>
            {bug && (
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
              {saving ? 'Saving...' : bug ? 'Save Changes' : 'Report Bug'}
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
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Bug Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What broke?" className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors" />
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
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize">
              {severities.map((s) => <option key={s} value={s}>{severityLabels[s]}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize">
              {statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the bug and what went wrong" rows={3} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Environment</label>
            <input value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="e.g. Production, Staging" className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors" />
          </div>

          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Type</label>
            <input value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. UI, Backend, API" className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Steps to Reproduce</label>
          <textarea value={stepsToReproduce} onChange={(e) => setStepsToReproduce(e.target.value)} placeholder="1. Go to...\n2. Click on...\n3. Observe error" rows={3} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none" />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes or observations" rows={2} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none" />
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