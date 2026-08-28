import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';
import type { UatJob } from '../types';
import {
  CLAIM_MODES,
  CLAIM_MODE_LABELS,
  VISIBILITIES,
  VISIBILITY_LABELS,
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
  DEVICES,
  DEVICE_LABELS,
  BROWSERS,
  BROWSER_LABELS,
  EVIDENCE_REQUIREMENT_TAGS,
  EVIDENCE_REQUIREMENT_LABELS,
  MINIMUM_RATING_OPTIONS,
  poundsToMinor,
  formatMinorCurrency,
  maxRewardBudget,
  toDatetimeLocal,
  fromDatetimeLocal,
} from '../marketplace';

interface FormState {
  title: string;
  public_summary: string;
  test_instructions: string;
  reward: string;
  estimated_minutes_min: string;
  estimated_minutes_max: string;
  max_testers: string;
  claim_mode: string;
  visibility: string;
  minimum_tester_rating: string;
  required_experience_level: string;
  required_devices: string[];
  required_browsers: string[];
  evidence_requirement_tags: string[];
  application_opens_at: string;
  application_closes_at: string;
}

interface Props {
  open: boolean;
  job: UatJob | null;
  minSlots: number;
  hasTesterActivity: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const SUMMARY_MAX = 300;
const INSTRUCTIONS_MAX = 500;

const EMPTY_FORM: FormState = {
  title: '',
  public_summary: '',
  test_instructions: '',
  reward: '',
  estimated_minutes_min: '',
  estimated_minutes_max: '',
  max_testers: '1',
  claim_mode: 'approval_required',
  visibility: 'internal',
  minimum_tester_rating: '',
  required_experience_level: 'any',
  required_devices: [],
  required_browsers: [],
  evidence_requirement_tags: [],
  application_opens_at: '',
  application_closes_at: '',
};

function jobToForm(job: UatJob): FormState {
  const rewardMinor = job.reward_amount_minor ?? 0;
  return {
    title: job.title || '',
    public_summary: job.public_summary || '',
    test_instructions: job.test_instructions || '',
    reward: rewardMinor === 0 ? '' : (rewardMinor / 100).toFixed(2),
    estimated_minutes_min: job.estimated_minutes_min != null ? String(job.estimated_minutes_min) : '',
    estimated_minutes_max: job.estimated_minutes_max != null ? String(job.estimated_minutes_max) : '',
    max_testers: String(job.max_testers ?? 1),
    claim_mode: job.claim_mode || 'approval_required',
    visibility: job.visibility || 'internal',
    minimum_tester_rating: job.minimum_tester_rating != null ? String(job.minimum_tester_rating) : '',
    required_experience_level: job.required_experience_level || 'any',
    required_devices: job.required_devices || [],
    required_browsers: job.required_browsers || [],
    evidence_requirement_tags: job.evidence_requirement_tags || [],
    application_opens_at: toDatetimeLocal(job.application_opens_at),
    application_closes_at: toDatetimeLocal(job.application_closes_at),
  };
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function TesterMarketplaceModal({ open, job, minSlots, hasTesterActivity, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => (job ? jobToForm(job) : EMPTY_FORM));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (open && job) {
      setForm(jobToForm(job));
      setErrors({});
      setSaveError('');
    }
  }, [open, job]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const rewardNumber = () => {
    if (!form.reward.trim()) return 0;
    const n = Number(form.reward);
    return Number.isFinite(n) ? n : NaN;
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};

    if (!form.title.trim()) e.title = 'Marketplace title is required.';
    if (!form.public_summary.trim()) e.public_summary = 'A short summary is required.';

    const reward = rewardNumber();
    if (Number.isNaN(reward) || reward < 0) {
      e.reward = 'Reward must be a valid amount of 0 or more.';
    }

    const minMin = form.estimated_minutes_min.trim() === '' ? null : Number(form.estimated_minutes_min);
    const minMax = form.estimated_minutes_max.trim() === '' ? null : Number(form.estimated_minutes_max);
    if (minMin !== null && (Number.isNaN(minMin) || minMin <= 0)) {
      e.estimated_minutes_min = 'Minimum must be greater than 0.';
    }
    if (minMin !== null && minMax !== null && !Number.isNaN(minMin) && !Number.isNaN(minMax) && minMax < minMin) {
      e.estimated_minutes_max = 'Maximum must be at least the minimum.';
    }

    const slots = Number(form.max_testers);
    if (Number.isNaN(slots) || slots < 1) {
      e.max_testers = 'At least one tester place is required.';
    } else if (slots < minSlots) {
      e.max_testers = `Tester places cannot be below ${minSlots} (existing reserved/filled assignments).`;
    }

    if (form.application_opens_at && form.application_closes_at) {
      const opens = new Date(form.application_opens_at).getTime();
      const closes = new Date(form.application_closes_at).getTime();
      if (Number.isFinite(opens) && Number.isFinite(closes) && closes <= opens) {
        e.application_closes_at = 'Close time must be after open time.';
      }
    }

    return e;
  };

  const handleSave = async () => {
    if (!job) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    setSaveError('');

    const reward = rewardNumber();
    const minMin = form.estimated_minutes_min.trim() === '' ? null : Number(form.estimated_minutes_min);
    const minMax = form.estimated_minutes_max.trim() === '' ? null : Number(form.estimated_minutes_max);

    const payload = {
      title: form.title.trim(),
      public_summary: form.public_summary.trim(),
      test_instructions: form.test_instructions.trim() || null,
      reward_amount_minor: poundsToMinor(Number.isFinite(reward) ? reward : 0),
      currency: 'GBP',
      estimated_minutes_min: minMin,
      estimated_minutes_max: minMax,
      max_testers: Number(form.max_testers),
      claim_mode: form.claim_mode,
      visibility: form.visibility,
      minimum_tester_rating: form.minimum_tester_rating === '' ? null : Number(form.minimum_tester_rating),
      required_experience_level: form.required_experience_level,
      required_devices: form.required_devices,
      required_browsers: form.required_browsers,
      evidence_requirement_tags: form.evidence_requirement_tags,
      application_opens_at: fromDatetimeLocal(form.application_opens_at),
      application_closes_at: fromDatetimeLocal(form.application_closes_at),
    };

    const { error: updateErr } = await supabase.from('uat_jobs').update(payload).eq('id', job.id);

    if (updateErr) {
      setSaveError(updateErr.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  const budgetMinor = (() => {
    const r = rewardNumber();
    const rewardMinor = Number.isFinite(r) ? poundsToMinor(r) : 0;
    const slots = Number(form.max_testers);
    return { rewardMinor, slots: Number.isFinite(slots) && slots >= 1 ? slots : 0 };
  })();
  const budgetTotalMinor = maxRewardBudget(budgetMinor.rewardMinor, budgetMinor.slots);

  const fieldClass =
    'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2.5 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';
  const labelClass = 'block text-xs font-label text-foreground-400 uppercase tracking-wide mb-1.5';
  const errClass = 'text-xs text-red-400 mt-1';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configure Tester Job"
      className="max-w-2xl"
      lockScroll={true}
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <p className="text-xs text-foreground-500">
            Saving does <span className="font-semibold text-foreground-300">not</span> publish this job.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-foreground-400 hover:text-foreground-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-background-950 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      }
    >
      <div className="p-5 space-y-5">
        {saveError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-sm text-red-400">{saveError}</p>
          </div>
        )}

        {hasTesterActivity && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <p className="text-xs text-amber-400">
              This job already has tester activity ({minSlots} reserved/filled). Changing reward or tester places will not
              retroactively affect existing assignments.
            </p>
          </div>
        )}

        {/* ── Tester-facing copy ── */}
        <div className="space-y-4">
          <div>
            <label className={labelClass}>
              Marketplace Title <span className="text-red-400">*</span>
            </label>
            <input
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="e.g. Tenant Registration & Dashboard UAT"
              className={fieldClass}
            />
            {errors.title && <p className={errClass}>{errors.title}</p>}
          </div>

          <div>
            <label className={labelClass}>
              Short Summary <span className="text-red-400">*</span>
            </label>
            <textarea
              value={form.public_summary}
              onChange={(e) => update('public_summary', e.target.value)}
              placeholder="A short, tester-facing explanation of what this job involves."
              rows={2}
              maxLength={SUMMARY_MAX}
              className={`${fieldClass} resize-none`}
            />
            <div className="flex items-center justify-between mt-1">
              {errors.public_summary ? <p className={errClass}>{errors.public_summary}</p> : <span></span>}
              <p className="text-[10px] text-foreground-600">{form.public_summary.length}/{SUMMARY_MAX}</p>
            </div>
          </div>

          <div>
            <label className={labelClass}>Tester Instructions <span className="text-foreground-600 normal-case font-normal">(optional)</span></label>
            <textarea
              value={form.test_instructions}
              onChange={(e) => update('test_instructions', e.target.value)}
              placeholder="Extra information testers should understand before claiming. Do not include passwords or secrets."
              rows={3}
              maxLength={INSTRUCTIONS_MAX}
              className={`${fieldClass} resize-none`}
            />
            <p className="text-[10px] text-foreground-600 mt-1 text-right">{form.test_instructions.length}/{INSTRUCTIONS_MAX}</p>
          </div>
        </div>

        {/* ── Reward + budget ── */}
        <div>
          <p className="text-xs font-semibold text-foreground-300 mb-3">Reward</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Reward per Tester (GBP) <span className="text-red-400">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-500">£</span>
                <input
                  value={form.reward}
                  onChange={(e) => update('reward', e.target.value)}
                  inputMode="decimal"
                  placeholder="25.00"
                  className={`${fieldClass} pl-7`}
                />
              </div>
              {errors.reward && <p className={errClass}>{errors.reward}</p>}
            </div>
            <div>
              <label className={labelClass}>Currency</label>
              <select value="GBP" disabled className={`${fieldClass} opacity-60 cursor-not-allowed`}>
                <option value="GBP">GBP — British Pound</option>
              </select>
            </div>
          </div>

          <div className="mt-3 bg-background-50 border border-background-200/60 rounded-lg p-3">
            <p className="text-[10px] font-label text-foreground-400 uppercase tracking-wide mb-2">Maximum Tester Reward Budget</p>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div><span className="text-foreground-500">Reward / tester</span><p className="text-foreground-100 font-medium mt-0.5">{formatMinorCurrency(budgetMinor.rewardMinor, 'GBP')}</p></div>
              <div><span className="text-foreground-500">Tester places</span><p className="text-foreground-100 font-medium mt-0.5">{budgetMinor.slots}</p></div>
              <div><span className="text-foreground-500">Max budget</span><p className="text-foreground-100 font-medium mt-0.5">{formatMinorCurrency(budgetTotalMinor, 'GBP')}</p></div>
            </div>
            <p className="text-[10px] text-foreground-600 mt-2">Display only — no payment is created or reserved.</p>
          </div>
        </div>

        {/* ── Time + places ── */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Estimated Time — Min (minutes)</label>
            <input
              type="number"
              min="1"
              value={form.estimated_minutes_min}
              onChange={(e) => update('estimated_minutes_min', e.target.value)}
              placeholder="60"
              className={fieldClass}
            />
            {errors.estimated_minutes_min && <p className={errClass}>{errors.estimated_minutes_min}</p>}
          </div>
          <div>
            <label className={labelClass}>Estimated Time — Max (minutes)</label>
            <input
              type="number"
              min="1"
              value={form.estimated_minutes_max}
              onChange={(e) => update('estimated_minutes_max', e.target.value)}
              placeholder="90"
              className={fieldClass}
            />
            {errors.estimated_minutes_max && <p className={errClass}>{errors.estimated_minutes_max}</p>}
          </div>
        </div>

        <div>
          <label className={labelClass}>Tester Places <span className="text-red-400">*</span></label>
          <input
            type="number"
            min="1"
            value={form.max_testers}
            onChange={(e) => update('max_testers', e.target.value)}
            placeholder="5"
            className={fieldClass}
          />
          {errors.max_testers && <p className={errClass}>{errors.max_testers}</p>}
        </div>

        {/* ── Claim mode + visibility ── */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Claim Mode</label>
            <select value={form.claim_mode} onChange={(e) => update('claim_mode', e.target.value)} className={`${fieldClass} cursor-pointer`}>
              {CLAIM_MODES.map((c) => (
                <option key={c} value={c}>{CLAIM_MODE_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Visibility</label>
            <select value={form.visibility} onChange={(e) => update('visibility', e.target.value)} className={`${fieldClass} cursor-pointer`}>
              {VISIBILITIES.map((v) => (
                <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
              ))}
            </select>
            <p className="text-[10px] text-foreground-600 mt-1">
              Marketplace: approved testers can discover it. Invite only: invited testers only. Internal: not visible to external testers.
            </p>
          </div>
        </div>

        {/* ── Eligibility ── */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Minimum Tester Rating</label>
            <select
              value={form.minimum_tester_rating}
              onChange={(e) => update('minimum_tester_rating', e.target.value)}
              className={`${fieldClass} cursor-pointer`}
            >
              <option value="">No minimum</option>
              {MINIMUM_RATING_OPTIONS.map((r) => (
                <option key={r} value={String(r)}>{r.toFixed(1)}+</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tester Experience</label>
            <select
              value={form.required_experience_level}
              onChange={(e) => update('required_experience_level', e.target.value)}
              className={`${fieldClass} cursor-pointer`}
            >
              {EXPERIENCE_LEVELS.map((l) => (
                <option key={l} value={l}>{EXPERIENCE_LEVEL_LABELS[l]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Devices ── */}
        <div>
          <label className={labelClass}>Device Requirements</label>
          <div className="flex flex-wrap gap-2">
            {DEVICES.map((d) => {
              const active = form.required_devices.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => update('required_devices', toggle(form.required_devices, d))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-accent-500/15 border-accent-500/40 text-accent-400'
                      : 'bg-background-50 border-background-300/60 text-foreground-400 hover:text-foreground-200'
                  }`}
                >
                  {DEVICE_LABELS[d]}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-foreground-600 mt-1">Leave all unselected for no specific device requirement.</p>
        </div>

        {/* ── Browsers ── */}
        <div>
          <label className={labelClass}>Browser Requirements</label>
          <div className="flex flex-wrap gap-2">
            {BROWSERS.map((b) => {
              const active = form.required_browsers.includes(b);
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => update('required_browsers', toggle(form.required_browsers, b))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-accent-500/15 border-accent-500/40 text-accent-400'
                      : 'bg-background-50 border-background-300/60 text-foreground-400 hover:text-foreground-200'
                  }`}
                >
                  {BROWSER_LABELS[b]}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-foreground-600 mt-1">Leave all unselected for no specific browser requirement.</p>
        </div>

        {/* ── Evidence requirements ── */}
        <div>
          <label className={labelClass}>Evidence Requirements</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EVIDENCE_REQUIREMENT_TAGS.map((tag) => {
              const active = form.evidence_requirement_tags.includes(tag);
              return (
                <label
                  key={tag}
                  className="flex items-center gap-2 text-sm text-foreground-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => update('evidence_requirement_tags', toggle(form.evidence_requirement_tags, tag))}
                    className="w-4 h-4 rounded accent-accent-500 cursor-pointer"
                  />
                  {EVIDENCE_REQUIREMENT_LABELS[tag]}
                </label>
              );
            })}
          </div>
        </div>

        {/* ── Availability window ── */}
        <div>
          <label className={labelClass}>Availability Window <span className="text-foreground-600 normal-case font-normal">(optional)</span></label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-foreground-500 mb-1">Opens At</label>
              <input
                type="datetime-local"
                value={form.application_opens_at}
                onChange={(e) => update('application_opens_at', e.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-[10px] text-foreground-500 mb-1">Closes At</label>
              <input
                type="datetime-local"
                value={form.application_closes_at}
                onChange={(e) => update('application_closes_at', e.target.value)}
                className={fieldClass}
              />
              {errors.application_closes_at && <p className={errClass}>{errors.application_closes_at}</p>}
            </div>
          </div>
          <p className="text-[10px] text-foreground-600 mt-1">Shown in your local time. Setting these does not auto-publish the job.</p>
        </div>
      </div>
    </Modal>
  );
}