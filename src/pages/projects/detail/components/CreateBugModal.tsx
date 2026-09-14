import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import { logWorkstreamActivity } from '../workstreamUtils';

export interface CreateBugDefaults {
  title: string;
  description: string;
  severity: string;
  source: string;
  uatDefectId?: string | null;
  buildRunId?: number | null;
  buildItemId?: number | null;
  supportTicketId?: string | null;
  maintenanceId?: number | null;
}

interface CreateBugModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  projectId: number;
  projectName: string;
  defaults: CreateBugDefaults;
  /** Display-only provenance label shown in the modal. */
  originLabel: string;
}

const severities = ['low', 'medium', 'high', 'critical'];
const severityLabels: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export default function CreateBugModal({
  open,
  onClose,
  onCreated,
  projectId,
  projectName,
  defaults,
  originLabel,
}: CreateBugModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(defaults.title);
    setDescription(defaults.description);
    setSeverity(defaults.severity || 'medium');
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
        severity,
        status: 'open',
        description: description.trim() || null,
        source: defaults.source,
        uat_defect_id: defaults.uatDefectId ?? null,
        build_run_id: defaults.buildRunId ?? null,
        build_item_id: defaults.buildItemId ?? null,
        support_ticket_id: defaults.supportTicketId ?? null,
        maintenance_id: defaults.maintenanceId ?? null,
      };

      const { data: inserted, error: dbError } = await supabase
        .from('internal_bugs')
        .insert(payload)
        .select('id')
        .single();

      if (dbError) throw dbError;

      // Retain traceability back to the UAT defect when converting a defect.
      if (defaults.source === 'uat' && defaults.uatDefectId && inserted?.id) {
        await supabase
          .from('uat_feedback')
          .update({ internal_bug_id: inserted.id })
          .eq('id', defaults.uatDefectId);
      }

      const action =
        defaults.source === 'uat'
          ? 'Project bug created from UAT defect'
          : defaults.source === 'build'
            ? 'Project bug created from Build blocker'
            : defaults.source === 'support'
              ? 'Project bug created from support ticket'
              : defaults.source === 'maintenance'
                ? 'Bug created from maintenance'
                : 'Project bug created';
      await logWorkstreamActivity(projectId, action, `${action}: ${title.trim()}`);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create project bug.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Project Bug"
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
            {saving ? 'Creating...' : 'Create Bug'}
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
            placeholder="What broke?"
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Severity</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize"
          >
            {severities.map((s) => (
              <option key={s} value={s}>
                {severityLabels[s]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the bug and what went wrong"
            rows={4}
            className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none"
          />
        </div>
      </div>
    </Modal>
  );
}