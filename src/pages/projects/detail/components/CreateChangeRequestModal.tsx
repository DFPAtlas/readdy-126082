import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import { logWorkstreamActivity } from '../workstreamUtils';

export interface CreateChangeRequestDefaults {
  title: string;
  description: string;
  priority: string;
  origin: string;
  type?: string | null;
  sourceBugId?: number | null;
  supportTicketId?: string | null;
  maintenanceId?: number | null;
}

interface CreateChangeRequestModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  projectId: number;
  projectName: string;
  defaults: CreateChangeRequestDefaults;
  originLabel: string;
}

const priorities = ['low', 'medium', 'high', 'critical'];

export default function CreateChangeRequestModal({
  open,
  onClose,
  onCreated,
  projectId,
  projectName,
  defaults,
  originLabel,
}: CreateChangeRequestModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(defaults.title);
    setDescription(defaults.description);
    setPriority(defaults.priority || 'medium');
    setError('');
  }, [open, defaults]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('A title is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        project_id: projectId,
        priority,
        status: 'requested',
        description: description.trim() || null,
        origin: defaults.origin,
        type: defaults.type ?? null,
        source_bug_id: defaults.sourceBugId ?? null,
        support_ticket_id: defaults.supportTicketId ?? null,
        maintenance_id: defaults.maintenanceId ?? null,
      };

      const { error: dbError } = await supabase.from('internal_change_requests').insert(payload);
      if (dbError) throw dbError;

      const originAction =
        defaults.origin === 'support'
          ? 'Change request created from support ticket'
          : defaults.origin === 'bug'
            ? 'Change request created from bug'
            : defaults.origin === 'uat'
              ? 'Change request created from UAT'
              : defaults.origin === 'maintenance'
                ? 'Change request created from maintenance'
                : 'Improvement Change Request created';
      await logWorkstreamActivity(projectId, originAction, `${originAction}: ${title.trim()}`);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create change request.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Change Request"
      className="max-w-xl"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-foreground-400 hover:text-foreground-200 transition-colors whitespace-nowrap cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-background-950 text-sm font-semibold px-5 py-2.5 rounded-full transition-colors whitespace-nowrap cursor-pointer"
          >
            {saving ? 'Creating...' : 'Create Request'}
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs text-foreground-500">
          <span className="text-[10px] font-label px-2 py-0.5 rounded-full bg-foreground-500/10 text-foreground-400 uppercase whitespace-nowrap">
            Origin: {originLabel}
          </span>
          <span>for {projectName}</span>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What change is needed?"
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize"
          >
            {priorities.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the change request in detail..."
            rows={4}
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none"
          />
        </div>
      </div>
    </Modal>
  );
}