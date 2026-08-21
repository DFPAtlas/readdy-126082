import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { BuildRun, BuildTemplate, Project } from '../types';
import { APP_TYPE_OPTIONS } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  run: BuildRun | null;
  projects: Project[];
  templates: BuildTemplate[];
}

export default function BuildProcessRunModal({ open, onClose, onSaved, run, projects, templates }: Props) {
  const [runName, setRunName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [appType, setAppType] = useState('full_saas');
  const [owner, setOwner] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!run;

  useEffect(() => {
    if (run) {
      setRunName(run.run_name);
      setProjectId(run.project_id ? String(run.project_id) : '');
      setTemplateId(run.template_id ? String(run.template_id) : '');
      setAppType('full_saas');
      setOwner(run.owner || '');
      setNotes(run.notes || '');
    } else {
      setRunName('');
      setProjectId('');
      setTemplateId(templates.length > 0 ? String(templates[0].id) : '');
      setAppType('full_saas');
      setOwner('');
      setNotes('');
    }
    setError('');
  }, [run, open, templates]);

  const handleSave = async () => {
    if (!runName.trim()) { setError('Run name is required.'); return; }

    setSaving(true);
    setError('');

    try {
      if (isEdit) {
        const { error: updateError } = await supabase
          .from('internal_build_process_runs')
          .update({
            run_name: runName,
            project_id: projectId ? Number(projectId) : null,
            template_id: templateId ? Number(templateId) : null,
            owner: owner || null,
            notes: notes || null,
          })
          .eq('id', run!.id);
        if (updateError) throw updateError;
      } else {
        const { data: newRun, error: insertError } = await supabase
          .from('internal_build_process_runs')
          .insert({
            run_name: runName,
            project_id: projectId ? Number(projectId) : null,
            template_id: templateId ? Number(templateId) : null,
            run_status: 'active',
            owner: owner || null,
            notes: notes || null,
            total_items: 0,
            completed_items: 0,
            launch_blockers_remaining: 0,
          })
          .select('id')
          .single();
        if (insertError) throw insertError;

        if (templateId && newRun) {
          const { data: templateItems } = await supabase
            .from('internal_build_process_template_items')
            .select('*')
            .eq('template_id', Number(templateId))
            .order('item_order');

          if (templateItems && templateItems.length > 0) {
            const runItems = templateItems.map((item) => ({
              run_id: newRun.id,
              phase: item.phase,
              stage_number: item.stage_number,
              stage_title: item.stage_title,
              item_order: item.item_order,
              item_title: item.item_title,
              item_description: item.item_description,
              status: 'not_started',
              checked: false,
              is_required: item.is_required,
              is_launch_blocker: item.is_launch_blocker,
            }));

            await supabase.from('internal_build_process_run_items').insert(runItems);

            const total = runItems.length;
            await supabase.from('internal_build_process_runs').update({
              total_items: total,
              completed_items: 0,
              launch_blockers_remaining: runItems.filter((i) => i.is_launch_blocker).length,
            }).eq('id', newRun.id);
          }
        }
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save checklist.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-background-200 border border-background-400/70 ring-1 ring-black/40 rounded-xl w-full max-w-lg shadow-[0_24px_70px_-12px_rgba(0,0,0,0.75)] z-10 max-h-[85vh] overflow-y-auto">
        <div className="p-5 border-b border-background-400/60 flex items-center justify-between">
          <h3 className="text-sm font-heading font-semibold text-foreground-100">
            {isEdit ? 'Edit Checklist' : 'New Build Checklist'}
          </h3>
          <button onClick={onClose} className="text-foreground-500 hover:text-foreground-200 cursor-pointer">
            <i className="ri-close-line text-lg w-5 h-5 flex items-center justify-center"></i>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground-400">Checklist Name *</label>
            <input
              type="text"
              value={runName}
              onChange={(e) => setRunName(e.target.value)}
              placeholder="e.g., Digital Footprint v2 Build"
              className="w-full mt-1 bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none focus:border-accent-500/40 transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground-400">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full mt-1 bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none focus:border-accent-500/40 transition-colors cursor-pointer"
            >
              <option value="">No project (standalone)</option>
              {projects.map((p) => <option key={p.id} value={String(p.id)}>{p.project_name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground-400">Template</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full mt-1 bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none focus:border-accent-500/40 transition-colors cursor-pointer"
            >
              <option value="">No template (empty)</option>
              {templates.map((t) => <option key={t.id} value={String(t.id)}>{t.template_name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground-400">App Type</label>
            <select
              value={appType}
              onChange={(e) => setAppType(e.target.value)}
              className="w-full mt-1 bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none focus:border-accent-500/40 transition-colors cursor-pointer"
            >
              {APP_TYPE_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground-400">Owner</label>
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Assigned owner"
              className="w-full mt-1 bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none focus:border-accent-500/40 transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground-400">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this build..."
              rows={3}
              maxLength={500}
              className="w-full mt-1 bg-background-50 border border-background-300/60 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none focus:border-accent-500/40 transition-colors resize-none"
            ></textarea>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/5 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium text-foreground-400 hover:text-foreground-200 hover:bg-background-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-accent-500 hover:bg-accent-400 text-background-950 text-sm font-semibold py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Checklist'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}