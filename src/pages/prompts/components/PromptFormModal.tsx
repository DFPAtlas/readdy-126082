import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';

interface Prompt {
  id: number;
  prompt_name: string;
  project_id: number;
  category: string;
  prompt_text: string | null;
  ai_model: string | null;
  result_summary: string | null;
  status: string;
  worked: boolean;
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
  prompt: Prompt | null;
}

const typeOptions = ['readdy', 'supabase', 'stripe', 'n8n', 'image_ai', 'logo', 'email', 'audit', 'bug_fix', 'other'];
const statuses = ['draft', 'used', 'worked', 'failed', 'archived'];

const typeLabels: Record<string, string> = {
  readdy: 'Readdy',
  supabase: 'Supabase',
  stripe: 'Stripe',
  n8n: 'n8n',
  image_ai: 'Image AI',
  logo: 'Logo',
  email: 'Email',
  audit: 'Audit',
  bug_fix: 'Bug Fix',
  other: 'Other',
};

export default function PromptFormModal({ open, onClose, onSaved, prompt }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [promptName, setPromptName] = useState('');
  const [projectId, setProjectId] = useState<number | ''>('');
  const [category, setCategory] = useState('readdy');
  const [promptText, setPromptText] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [resultSummary, setResultSummary] = useState('');
  const [status, setStatus] = useState('draft');
  const [worked, setWorked] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('internal_projects').select('id,project_name').order('project_name').then(({ data }) => setProjects(data ?? []));
  }, []);

  useEffect(() => {
    if (!open) return;
    if (prompt) {
      setPromptName(prompt.prompt_name);
      setProjectId(prompt.project_id);
      setCategory(prompt.category);
      setPromptText(prompt.prompt_text ?? '');
      setAiModel(prompt.ai_model ?? '');
      setResultSummary(prompt.result_summary ?? '');
      setStatus(prompt.status);
      setWorked(prompt.worked);
      setNotes(prompt.notes ?? '');
    } else {
      setPromptName('');
      setProjectId('');
      setCategory('readdy');
      setPromptText('');
      setAiModel('');
      setResultSummary('');
      setStatus('draft');
      setWorked(false);
      setNotes('');
    }
    setError('');
  }, [open, prompt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptName.trim()) { setError('Title is required.'); return; }
    if (projectId === '') { setError('Project is required.'); return; }
    if (!promptText.trim()) { setError('Prompt text is required.'); return; }
    setError('');
    setSaving(true);

    const payload = {
      prompt_name: promptName.trim(),
      project_id: projectId as number,
      category,
      prompt_text: promptText.trim(),
      ai_model: aiModel.trim() || null,
      result_summary: resultSummary.trim() || null,
      status,
      worked,
      notes: notes.trim() || null,
    };

    if (prompt) {
      await supabase.from('internal_prompts').update(payload).eq('id', prompt.id);
      await logActivity('updated', 'prompt', prompt.id, projectId as number, `Updated prompt: ${promptName.trim()}`);
    } else {
      await supabase.from('internal_prompts').insert(payload);
      await logActivity('created', 'prompt', null, projectId as number, `Created prompt: ${promptName.trim()}`);
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  const handleDelete = async () => {
    if (!prompt) return;
    setDeleting(true);
    await supabase.from('internal_prompts').delete().eq('id', prompt.id);
    await logActivity('deleted', 'prompt', prompt.id, prompt.project_id, `Deleted prompt: ${prompt.prompt_name}`);
    setDeleting(false);
    onSaved();
    onClose();
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={prompt ? 'Edit Prompt' : 'New Prompt'}
      className="max-w-2xl"
      footer={
        <>
          <div>
            {prompt && (
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
              {saving ? 'Saving...' : prompt ? 'Save Changes' : 'Add Prompt'}
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
          <input value={promptName} onChange={(e) => setPromptName(e.target.value)} placeholder="What does this prompt do?" className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors" />
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
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Type *</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer">
              {typeOptions.map((t) => <option key={t} value={t}>{typeLabels[t] ?? t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize">
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">AI Model</label>
            <input value={aiModel} onChange={(e) => setAiModel(e.target.value)} placeholder="e.g. GPT-4, Claude" className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Prompt Text *</label>
          <textarea value={promptText} onChange={(e) => setPromptText(e.target.value)} placeholder="Paste your full prompt here..." rows={8} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none font-mono" />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Result Notes</label>
          <textarea value={resultSummary} onChange={(e) => setResultSummary(e.target.value)} placeholder="How did this prompt perform? Any tips?" rows={3} className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none" />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes" className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors" />
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