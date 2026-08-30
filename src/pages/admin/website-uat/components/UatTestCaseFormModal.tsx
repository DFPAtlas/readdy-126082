import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import type { UatJob, UatTestCase } from '../types';
import {
  TEST_CASE_PRIORITIES,
  TEST_CASE_PRIORITY_LABELS,
  resolvePlanAndScenario,
  generateReference,
  nextSortOrder,
} from '../testCaseHelpers';

interface Step {
  action: string;
  expected: string;
}

interface FormData {
  title: string;
  description: string;
  reference: string;
  priority: string;
  estimated_minutes: string;
  preconditions: string;
  expected_result: string;
  required_evidence: string;
  is_required: boolean;
}

const INITIAL: FormData = {
  title: '',
  description: '',
  reference: '',
  priority: 'medium',
  estimated_minutes: '',
  preconditions: '',
  expected_result: '',
  required_evidence: '',
  is_required: true,
};

interface Props {
  open: boolean;
  job: UatJob;
  projectName: string;
  existingCase?: UatTestCase | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function UatTestCaseFormModal({
  open,
  job,
  projectName,
  existingCase,
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormData>(INITIAL);
  const [steps, setSteps] = useState<Step[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const isEdit = Boolean(existingCase);

  const reset = useCallback(() => {
    if (existingCase) {
      setForm({
        title: existingCase.title ?? '',
        description: existingCase.description ?? '',
        reference: existingCase.reference ?? '',
        priority: existingCase.priority ?? 'medium',
        estimated_minutes: existingCase.estimated_minutes != null ? String(existingCase.estimated_minutes) : '',
        preconditions: existingCase.preconditions ?? '',
        expected_result: existingCase.expected_result ?? '',
        required_evidence: existingCase.required_evidence ?? '',
        is_required: existingCase.is_required ?? true,
      });
      setSteps(
        Array.isArray(existingCase.steps)
          ? existingCase.steps.map((s) => ({
              action: s.action ?? '',
              expected: s.expected ?? '',
            }))
          : [],
      );
    } else {
      setForm(INITIAL);
      setSteps([]);
    }
    setErrors({});
    setSaveError('');
  }, [existingCase]);

  useEffect(() => {
    if (open) {
      reset();
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [open, reset]);

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addStep = () => setSteps((prev) => [...prev, { action: '', expected: '' }]);
  const removeStep = (i: number) => setSteps((prev) => prev.filter((_, idx) => idx !== i));
  const moveStep = (i: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev];
      const target = i + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[i], next[target]] = [next[target], next[i]];
      return next;
    });
  };
  const updateStep = (i: number, key: keyof Step, value: string) => {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)));
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required.';
    if (form.expected_result.trim() === '') e.expected_result = 'Expected result is required.';
    const usableSteps = steps.filter((s) => s.action.trim() !== '');
    if (usableSteps.length === 0) e.steps = 'At least one step with an action is required.';
    if (form.estimated_minutes.trim() !== '') {
      const n = Number(form.estimated_minutes);
      if (!Number.isInteger(n) || n < 1) e.estimated_minutes = 'Estimated minutes must be a positive whole number.';
    }
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    setSaveError('');

    try {
      const cleanSteps: Step[] = steps.filter((s) => s.action.trim() !== '');

      let reference = form.reference.trim();
      if (!reference) {
        if (isEdit && existingCase?.reference) {
          reference = existingCase.reference;
        } else {
          reference = await generateReference(job.project_id);
        }
      }

      const basePayload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        reference,
        priority: form.priority,
        estimated_minutes: form.estimated_minutes.trim() !== '' ? Number(form.estimated_minutes) : null,
        preconditions: form.preconditions.trim() || null,
        steps: cleanSteps,
        expected_result: form.expected_result.trim(),
        required_evidence: form.required_evidence.trim() || null,
        is_required: form.is_required,
      };

      let newCaseId: string | null = null;

      if (isEdit && existingCase) {
        const { error: updateErr } = await supabase
          .from('uat_test_cases')
          .update(basePayload)
          .eq('id', existingCase.id);
        if (updateErr) throw updateErr;
      } else {
        const { scenarioId } = await resolvePlanAndScenario(job.project_id, projectName, job.title);
        const sortOrder = await nextSortOrder(job.id);

        const { data: inserted, error: insertErr } = await supabase
          .from('uat_test_cases')
          .insert({
            ...basePayload,
            project_id: job.project_id,
            job_id: job.id,
            scenario_id: scenarioId,
            suite_id: null,
            case_status: 'draft',
            sort_order: sortOrder,
          })
          .select('id')
          .single();
        if (insertErr) throw insertErr;
        newCaseId = inserted?.id ?? null;
      }

      // Best-effort audit — a failure must never undo a successful create.
      if (newCaseId) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          await supabase.from('uat_audit_log').insert({
            actor_id: session?.user?.id ?? null,
            action: 'uat_test_case_created',
            entity_type: 'uat_test_case',
            entity_id: newCaseId,
            new_value: {
              project_id: job.project_id,
              job_id: job.id,
              title: form.title.trim(),
              reference,
              priority: form.priority,
            },
          });
        } catch {
          /* audit is best-effort */
        }
      }

      onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save test case.');
      setSaving(false);
    }
  };

  const fieldClass =
    'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';
  const labelClass = 'block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5';
  const errClass = 'text-xs text-red-400 mt-1';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Test Case' : 'Add Test Case'}
      className="max-w-2xl"
      lockScroll={true}
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-sm text-foreground-400 hover:text-foreground-200 transition-colors whitespace-nowrap cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-background-950 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Test Case'}
          </button>
        </div>
      }
    >
      <div className="p-5 space-y-4">
        {saveError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-sm text-red-400">{saveError}</p>
          </div>
        )}

        <p className="text-sm text-foreground-400">
          {isEdit
            ? 'Update the test case definition for this test run.'
            : `Add a test case to "${job.title}". It is saved as a draft.`}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass}>
              Title <span className="text-red-400">*</span>
            </label>
            <input
              ref={titleInputRef}
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="e.g. Homepage Load"
              className={fieldClass}
            />
            {errors.title && <p className={errClass}>{errors.title}</p>}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass}>Reference</label>
            <input
              value={form.reference}
              onChange={(e) => update('reference', e.target.value)}
              placeholder="Auto-generated if left blank (e.g. UAT-001)"
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={2}
            placeholder="What does this test case verify?"
            className={`${fieldClass} resize-none`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Priority</label>
            <select
              value={form.priority}
              onChange={(e) => update('priority', e.target.value)}
              className={`${fieldClass} cursor-pointer`}
            >
              {TEST_CASE_PRIORITIES.map((p) => (
                <option key={p} value={p}>{TEST_CASE_PRIORITY_LABELS[p]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Estimated Minutes</label>
            <input
              type="number"
              min="1"
              value={form.estimated_minutes}
              onChange={(e) => update('estimated_minutes', e.target.value)}
              placeholder="e.g. 3"
              className={fieldClass}
            />
            {errors.estimated_minutes && <p className={errClass}>{errors.estimated_minutes}</p>}
          </div>
        </div>

        <div>
          <label className={labelClass}>Preconditions</label>
          <textarea
            value={form.preconditions}
            onChange={(e) => update('preconditions', e.target.value)}
            rows={2}
            placeholder="Any prerequisites before running this case."
            className={`${fieldClass} resize-none`}
          />
        </div>

        {/* Steps */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-label text-foreground-400 uppercase tracking-wide">
              Steps <span className="text-red-400">*</span>
            </label>
            <button
              type="button"
              onClick={addStep}
              className="flex items-center gap-1 text-xs text-accent-400 hover:text-accent-300 font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Add Step
            </button>
          </div>
          {steps.length === 0 ? (
            <p className="text-xs text-foreground-500 bg-background-50 border border-dashed border-background-300/60 rounded-lg px-3 py-3">
              No steps yet — click "Add Step" to define ordered actions and their expected outcomes.
            </p>
          ) : (
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={i} className="bg-background-50 border border-background-200/60 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-label text-foreground-500 uppercase tracking-wide">Step {i + 1}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveStep(i, -1)}
                        disabled={i === 0}
                        className="w-6 h-6 flex items-center justify-center text-foreground-500 hover:text-foreground-200 disabled:opacity-30 rounded transition-colors cursor-pointer"
                      >
                        <i className="ri-arrow-up-s-line text-sm w-4 h-4 flex items-center justify-center"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(i, 1)}
                        disabled={i === steps.length - 1}
                        className="w-6 h-6 flex items-center justify-center text-foreground-500 hover:text-foreground-200 disabled:opacity-30 rounded transition-colors cursor-pointer"
                      >
                        <i className="ri-arrow-down-s-line text-sm w-4 h-4 flex items-center justify-center"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStep(i)}
                        className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-300 rounded transition-colors cursor-pointer"
                      >
                        <i className="ri-delete-bin-line text-sm w-4 h-4 flex items-center justify-center"></i>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input
                        value={s.action}
                        onChange={(e) => updateStep(i, 'action', e.target.value)}
                        placeholder="Action (e.g. Open https://…)"
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <input
                        value={s.expected}
                        onChange={(e) => updateStep(i, 'expected', e.target.value)}
                        placeholder="Expected"
                        className={fieldClass}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {errors.steps && <p className={errClass}>{errors.steps}</p>}
        </div>

        <div>
          <label className={labelClass}>
            Expected Result <span className="text-red-400">*</span>
          </label>
          <textarea
            value={form.expected_result}
            onChange={(e) => update('expected_result', e.target.value)}
            rows={2}
            placeholder="Overall expected outcome for this test case."
            className={`${fieldClass} resize-none`}
          />
          {errors.expected_result && <p className={errClass}>{errors.expected_result}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Required Evidence</label>
            <input
              value={form.required_evidence}
              onChange={(e) => update('required_evidence', e.target.value)}
              placeholder="e.g. Screenshot"
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Required</label>
            <div className="flex gap-2">
              {[
                { value: true, label: 'Yes' },
                { value: false, label: 'No' },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => update('is_required', opt.value)}
                  className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                    form.is_required === opt.value
                      ? 'bg-accent-500/15 border-accent-500/40 text-accent-400'
                      : 'bg-background-50 border-background-300/60 text-foreground-400 hover:text-foreground-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}