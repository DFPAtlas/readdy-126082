import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';

const STATUSES = ['idea', 'planning', 'building', 'testing', 'live', 'on_hold', 'archived'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

const STEPS = [
  { key: 'basics' as const, label: 'Basics', icon: 'ri-file-text-line' },
  { key: 'classification' as const, label: 'Classify', icon: 'ri-price-tag-3-line' },
  { key: 'tech' as const, label: 'Tech & Dates', icon: 'ri-code-s-slash-line' },
  { key: 'review' as const, label: 'Review', icon: 'ri-check-double-line' },
];

type StepKey = (typeof STEPS)[number]['key'];

interface FormData {
  project_name: string;
  project_slug: string;
  description: string;
  owner: string;
  status: string;
  priority: string;
  is_saas: boolean;
  is_client_build: boolean;
  is_internal_tool: boolean;
  is_ai_powered: boolean;
  tech_stack: string;
  domain_live: string;
  domain_staging: string;
  target_launch_date: string;
  monthly_revenue: string;
  monthly_costs: string;
  notes: string;
}

interface EditProject {
  id: number;
  project_name: string;
  project_slug: string;
  description: string | null;
  owner: string | null;
  status: string;
  priority: string;
  is_saas: boolean;
  is_client_build: boolean;
  is_internal_tool: boolean;
  is_ai_powered: boolean;
  tech_stack: string | null;
  domain_live: string | null;
  domain_staging: string | null;
  target_launch_date: string | null;
  monthly_revenue: number;
  monthly_costs: number;
  notes: string | null;
}

const INITIAL: FormData = {
  project_name: '',
  project_slug: '',
  description: '',
  owner: '',
  status: 'idea',
  priority: 'medium',
  is_saas: false,
  is_client_build: false,
  is_internal_tool: false,
  is_ai_powered: false,
  tech_stack: '',
  domain_live: '',
  domain_staging: '',
  target_launch_date: '',
  monthly_revenue: '',
  monthly_costs: '',
  notes: '',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  project?: EditProject | null;
}

export default function ProjectWizardModal({ open, onClose, onCreated, project }: Props) {
  const [step, setStep] = useState<StepKey>('basics');
  const [form, setForm] = useState<FormData>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!project;

  // Reset / prefill on open
  useEffect(() => {
    if (open) {
      if (project) {
        setForm({
          project_name: project.project_name || '',
          project_slug: project.project_slug || '',
          description: project.description || '',
          owner: project.owner || '',
          status: project.status || 'idea',
          priority: project.priority || 'medium',
          is_saas: project.is_saas || false,
          is_client_build: project.is_client_build || false,
          is_internal_tool: project.is_internal_tool || false,
          is_ai_powered: project.is_ai_powered || false,
          tech_stack: project.tech_stack || '',
          domain_live: project.domain_live || '',
          domain_staging: project.domain_staging || '',
          target_launch_date: project.target_launch_date || '',
          monthly_revenue: project.monthly_revenue ? String(project.monthly_revenue) : '',
          monthly_costs: project.monthly_costs ? String(project.monthly_costs) : '',
          notes: project.notes || '',
        });
        setSlugManuallyEdited(true);
      } else {
        setForm(INITIAL);
        setSlugManuallyEdited(false);
      }
      setStep('basics');
      setError('');
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [open, project]);

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'project_name' && !slugManuallyEdited) {
        next.project_slug = (value as string)
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
      }
      return next;
    });
  };

  const handleSlugChange = (val: string) => {
    setSlugManuallyEdited(true);
    setForm((prev) => ({
      ...prev,
      project_slug: val
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-'),
    }));
  };

  const currentStepIdx = STEPS.findIndex((s) => s.key === step);

  const goNext = () => {
    setError('');
    if (step === 'basics') {
      if (!form.project_name.trim()) { setError('Project name is required.'); return; }
      if (!form.project_slug.trim()) { setError('Project slug is required.'); return; }
    }
    const next = STEPS[currentStepIdx + 1];
    if (next) setStep(next.key);
  };

  const goPrev = () => {
    setError('');
    const prev = STEPS[currentStepIdx - 1];
    if (prev) setStep(prev.key);
  };

  const handleSubmit = async () => {
    if (!form.project_name.trim()) { setError('Project name is required.'); return; }
    setError('');
    setSaving(true);

    const payload = {
      project_name: form.project_name.trim(),
      project_slug: form.project_slug.trim(),
      description: form.description.trim() || null,
      owner: form.owner.trim() || null,
      status: form.status,
      priority: form.priority,
      is_saas: form.is_saas,
      is_client_build: form.is_client_build,
      is_internal_tool: form.is_internal_tool,
      is_ai_powered: form.is_ai_powered,
      tech_stack: form.tech_stack.trim() || null,
      domain_live: form.domain_live.trim() || null,
      domain_staging: form.domain_staging.trim() || null,
      target_launch_date: form.target_launch_date || null,
      monthly_revenue: form.monthly_revenue ? Number(form.monthly_revenue) : 0,
      monthly_costs: form.monthly_costs ? Number(form.monthly_costs) : 0,
      notes: form.notes.trim() || null,
    };

    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id ?? null;

    if (isEditing && project) {
      const { error: updateErr } = await supabase
        .from('internal_projects')
        .update(payload)
        .eq('id', project.id);

      if (updateErr) {
        setError(updateErr.message);
        setSaving(false);
        return;
      }

      await supabase.from('internal_activity_log').insert({
        user_id: userId,
        action: 'updated',
        entity_type: 'project',
        description: `Updated project: ${payload.project_name}`,
      });
    } else {
      const { error: insertErr } = await supabase.from('internal_projects').insert(payload);

      if (insertErr) {
        setError(insertErr.message);
        setSaving(false);
        return;
      }

      await supabase.from('internal_activity_log').insert({
        user_id: userId,
        action: 'created',
        entity_type: 'project',
        description: `Created project: ${payload.project_name}`,
      });
    }

    setSaving(false);
    onCreated();
    onClose();
  };

  const stepLabel = (s: (typeof STEPS)[number], idx: number) => {
    const isActive = idx === currentStepIdx;
    const isDone = idx < currentStepIdx;
    return (
      <div key={s.key} className="flex items-center gap-2 shrink-0">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-label font-semibold transition-colors ${
            isActive
              ? 'bg-accent-500 text-background-950'
              : isDone
                ? 'bg-accent-500/20 text-accent-400 border border-accent-500/40'
                : 'bg-background-200/70 text-foreground-500 border border-background-300/60'
          }`}
        >
          {isDone ? <i className="ri-check-line w-3.5 h-3.5 flex items-center justify-center"></i> : idx + 1}
        </div>
        <span
          className={`text-xs font-label whitespace-nowrap ${
            isActive ? 'text-foreground-100 font-semibold' : isDone ? 'text-foreground-300' : 'text-foreground-500'
          }`}
        >
          {s.label}
        </span>
      </div>
    );
  };

  const stepConnector = () => (
    <div className="w-6 h-px bg-background-300/60 shrink-0" />
  );

  const allTypes = [form.is_saas, form.is_client_build, form.is_internal_tool, form.is_ai_powered];
  const typeSummary = [
    form.is_saas ? 'SaaS' : null,
    form.is_client_build ? 'Client Build' : null,
    form.is_internal_tool ? 'Internal Tool' : null,
    form.is_ai_powered ? 'AI-Powered' : null,
  ].filter(Boolean);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit Project' : 'New Project'}
      className="max-w-2xl"
      lockScroll={true}
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {currentStepIdx > 0 && (
              <button
                type="button"
                onClick={goPrev}
                className="text-sm text-foreground-400 hover:text-foreground-200 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-arrow-left-line w-4 h-4 inline-flex items-center justify-center mr-1"></i>
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-foreground-400 hover:text-foreground-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              Cancel
            </button>
            {currentStepIdx < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                Next
                <i className="ri-arrow-right-line w-4 h-4 inline-flex items-center justify-center ml-1"></i>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-background-950 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Project'}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="p-5">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-0 mb-6 overflow-x-auto">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              {i > 0 && stepConnector()}
              {stepLabel(s, i)}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* ── Step 1: Basics ── */}
        {step === 'basics' && (
          <div className="space-y-4">
            <p className="text-sm text-foreground-400">Start with the essentials — what are you building?</p>

            <div>
              <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">
                Project Name <span className="text-red-400">*</span>
              </label>
              <input
                ref={nameInputRef}
                value={form.project_name}
                onChange={(e) => update('project_name', e.target.value)}
                placeholder="e.g. GuardianHub"
                className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">
                Slug <span className="text-red-400">*</span>
              </label>
              <input
                value={form.project_slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="auto-generated"
                className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors font-mono"
              />
              <p className="text-[10px] text-foreground-600 mt-1">Used in URLs: /projects/<strong className="text-foreground-400">{form.project_slug || 'your-slug'}</strong></p>
            </div>

            <div>
              <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="What does this project do? Who is it for?"
                rows={3}
                maxLength={500}
                className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none"
              />
              <p className="text-[10px] text-foreground-600 mt-1 text-right">{form.description.length}/500</p>
            </div>

            <div>
              <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Owner</label>
              <input
                value={form.owner}
                onChange={(e) => update('owner', e.target.value)}
                placeholder="Who owns this project?"
                className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
              />
            </div>
          </div>
        )}

        {/* ── Step 2: Classification ── */}
        {step === 'classification' && (
          <div className="space-y-5">
            <p className="text-sm text-foreground-400">Classify the project so the team knows what it is at a glance.</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => update('status', e.target.value)}
                  className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => update('priority', e.target.value)}
                  className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors cursor-pointer capitalize"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-3">Project Type</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'is_saas' as const, label: 'SaaS', desc: 'Subscription-based web app', icon: 'ri-cloud-line' },
                  { key: 'is_client_build' as const, label: 'Client Build', desc: 'Built for a specific client', icon: 'ri-user-3-line' },
                  { key: 'is_internal_tool' as const, label: 'Internal Tool', desc: 'For internal team use', icon: 'ri-tools-line' },
                  { key: 'is_ai_powered' as const, label: 'AI-Powered', desc: 'Uses AI/ML capabilities', icon: 'ri-robot-2-line' },
                ]).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => update(t.key, !form[t.key])}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors text-left cursor-pointer ${
                      form[t.key]
                        ? 'bg-accent-500/10 border-accent-500/40 text-foreground-100'
                        : 'bg-background-50 border-background-300/60 text-foreground-400 hover:border-background-400/60'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      form[t.key] ? 'bg-accent-500/20 text-accent-400' : 'bg-background-100 text-foreground-500'
                    }`}>
                      <i className={`${t.icon} w-4 h-4 flex items-center justify-center`}></i>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{t.label}</p>
                      <p className="text-[10px] opacity-60 mt-0.5">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Tech & Dates ── */}
        {step === 'tech' && (
          <div className="space-y-4">
            <p className="text-sm text-foreground-400">Technical details and timeline for the project.</p>

            <div>
              <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Tech Stack</label>
              <input
                value={form.tech_stack}
                onChange={(e) => update('tech_stack', e.target.value)}
                placeholder="e.g. React, Tailwind, Supabase, Stripe"
                className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Live Domain</label>
                <input
                  value={form.domain_live}
                  onChange={(e) => update('domain_live', e.target.value)}
                  placeholder="e.g. app.example.com"
                  className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Staging Domain</label>
                <input
                  value={form.domain_staging}
                  onChange={(e) => update('domain_staging', e.target.value)}
                  placeholder="e.g. staging.example.com"
                  className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Target Launch Date</label>
              <input
                type="date"
                value={form.target_launch_date}
                onChange={(e) => update('target_launch_date', e.target.value)}
                className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 outline-none transition-colors"
              />
            </div>
          </div>
        )}

        {/* ── Step 4: Review & Financials ── */}
        {step === 'review' && (
          <div className="space-y-5">
            <p className="text-sm text-foreground-400">Almost done — add financial estimates and review everything.</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Monthly Revenue (&pound;)</label>
                <input
                  type="number"
                  value={form.monthly_revenue}
                  onChange={(e) => update('monthly_revenue', e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Monthly Costs (&pound;)</label>
                <input
                  type="number"
                  value={form.monthly_costs}
                  onChange={(e) => update('monthly_costs', e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5">Project Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="Any additional context, setup instructions, or team notes..."
                rows={3}
                maxLength={500}
                className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-none"
              />
              <p className="text-[10px] text-foreground-600 mt-1 text-right">{form.notes.length}/500</p>
            </div>

            {/* Review Card */}
            <div className="bg-background-50 border border-background-200/70 rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-label text-foreground-300 uppercase tracking-wide">Summary</h4>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-foreground-500 text-xs">Name</span>
                  <p className="text-foreground-100 font-semibold">{form.project_name || '(empty)'}</p>
                </div>
                <div>
                  <span className="text-foreground-500 text-xs">Slug</span>
                  <p className="text-foreground-100 font-mono text-xs">{form.project_slug || '(empty)'}</p>
                </div>
                <div>
                  <span className="text-foreground-500 text-xs">Status</span>
                  <p className="text-foreground-100 capitalize">{form.status.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="text-foreground-500 text-xs">Priority</span>
                  <p className="text-foreground-100 capitalize">{form.priority}</p>
                </div>
                <div>
                  <span className="text-foreground-500 text-xs">Owner</span>
                  <p className="text-foreground-100">{form.owner || '(none)'}</p>
                </div>
                <div>
                  <span className="text-foreground-500 text-xs">Types</span>
                  <p className="text-foreground-100">{typeSummary.length ? typeSummary.join(', ') : '(none)'}</p>
                </div>
                {form.tech_stack && (
                  <div className="col-span-2">
                    <span className="text-foreground-500 text-xs">Tech Stack</span>
                    <p className="text-foreground-100">{form.tech_stack}</p>
                  </div>
                )}
                {form.domain_live && (
                  <div>
                    <span className="text-foreground-500 text-xs">Live Domain</span>
                    <p className="text-foreground-100 font-mono text-xs">{form.domain_live}</p>
                  </div>
                )}
                {form.domain_staging && (
                  <div>
                    <span className="text-foreground-500 text-xs">Staging Domain</span>
                    <p className="text-foreground-100 font-mono text-xs">{form.domain_staging}</p>
                  </div>
                )}
                {form.target_launch_date && (
                  <div>
                    <span className="text-foreground-500 text-xs">Target Launch</span>
                    <p className="text-foreground-100">{form.target_launch_date}</p>
                  </div>
                )}
                <div>
                  <span className="text-foreground-500 text-xs">Monthly Revenue</span>
                  <p className="text-foreground-100">&pound;{form.monthly_revenue || '0'}</p>
                </div>
                <div>
                  <span className="text-foreground-500 text-xs">Monthly Costs</span>
                  <p className="text-foreground-100">&pound;{form.monthly_costs || '0'}</p>
                </div>
              </div>

              {form.description && (
                <div>
                  <span className="text-foreground-500 text-xs">Description</span>
                  <p className="text-foreground-100 text-sm mt-0.5 leading-relaxed">{form.description}</p>
                </div>
              )}
              {form.notes && (
                <div>
                  <span className="text-foreground-500 text-xs">Notes</span>
                  <p className="text-foreground-100 text-sm mt-0.5 leading-relaxed">{form.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}