import { useEffect, useState } from 'react';
import Modal from '@/components/base/Modal';
import { supabase } from '@/lib/supabase';
import type { SupportSite } from '@/types/support-tickets';
import { isValidDomain, isValidEmail, isValidSlug } from '../constants';
import { logAdminEvent } from '../audit';
import OriginEditor from './OriginEditor';

interface WebsiteOption {
  id: string;
  name: string;
  primary_domain: string | null;
  production_url: string | null;
}
interface ProjectOption {
  id: number;
  project_name: string;
  project_slug: string;
}

interface SiteFormModalProps {
  open: boolean;
  onClose: () => void;
  initial: SupportSite | null;
  websites: WebsiteOption[];
  projects: ProjectOption[];
  onSaved: () => void;
}

interface FormState {
  site_name: string;
  site_slug: string;
  domain: string;
  support_email: string;
  website_id: string;
  project_id: string;
  integration_mode: 'public_form' | 'server_to_server';
  is_active: boolean;
  allowed_origins: string[];
}

const EMPTY: FormState = {
  site_name: '',
  site_slug: '',
  domain: '',
  support_email: '',
  website_id: '',
  project_id: '',
  integration_mode: 'public_form',
  is_active: true,
  allowed_origins: [],
};

export default function SiteFormModal({ open, onClose, initial, websites, projects, onSaved }: SiteFormModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        site_name: initial.site_name,
        site_slug: initial.site_slug,
        domain: initial.domain ?? '',
        support_email: initial.support_email ?? '',
        website_id: initial.website_id ?? '',
        project_id: initial.project_id != null ? String(initial.project_id) : '',
        integration_mode: initial.integration_mode,
        is_active: initial.is_active,
        allowed_origins: initial.allowed_origins ?? [],
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
    setSubmitError('');
  }, [open, initial]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.site_name.trim()) e.site_name = 'Site name is required.';
    if (!form.site_slug.trim()) {
      e.site_slug = 'Site slug is required.';
    } else if (!isValidSlug(form.site_slug)) {
      e.site_slug = 'Slug must be lowercase, URL-safe (letters, numbers, hyphens).';
    }
    if (form.domain && !isValidDomain(form.domain)) e.domain = 'Enter a valid domain (e.g. example.com).';
    if (form.support_email && !isValidEmail(form.support_email)) e.support_email = 'Enter a valid email address.';
    if (form.integration_mode === 'public_form' && form.allowed_origins.length === 0) {
      e.allowed_origins = 'Public-form integrations need at least one allowed origin.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    setSubmitError('');
    try {
      const payload = {
        site_name: form.site_name.trim(),
        site_slug: form.site_slug.trim(),
        domain: form.domain.trim() || null,
        support_email: form.support_email.trim() || null,
        website_id: form.website_id || null,
        project_id: form.project_id ? Number(form.project_id) : null,
        integration_mode: form.integration_mode,
        is_active: form.is_active,
        allowed_origins: form.allowed_origins,
      };

      let siteId = initial?.id;
      if (initial) {
        const { error } = await supabase
          .from('internal_support_sites')
          .update(payload)
          .eq('id', initial.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('internal_support_sites').insert(payload).select('id').single();
        if (error) {
          if (error.message?.includes('site_slug')) {
            setSubmitError('A site with that slug already exists.');
            setSaving(false);
            return;
          }
          throw error;
        }
        siteId = data?.id;
      }

      await logAdminEvent(
        'support_site',
        initial ? 'updated' : 'created',
        initial ? `Support site "${form.site_name}" updated` : `Support site "${form.site_name}" registered`,
        { site_id: siteId, site_slug: form.site_slug, integration_mode: form.integration_mode },
      );

      onSaved();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save site.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = (k: string) =>
    `w-full text-sm bg-background-50 border rounded-md px-3 py-2 text-foreground-100 placeholder:text-foreground-600 focus:outline-none focus:ring-2 focus:ring-accent-500/40 ${
      errors[k] ? 'border-red-500/60' : 'border-background-300/60'
    }`;

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit support site' : 'Register support site'} className="max-w-xl">
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="sf-name">Site name</label>
            <input id="sf-name" value={form.site_name} onChange={(e) => set('site_name', e.target.value)} className={inputCls('site_name')} placeholder="Digital Footprint" />
            {errors.site_name && <p className="text-xs text-red-400 mt-1">{errors.site_name}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="sf-slug">Site slug</label>
            <input id="sf-slug" value={form.site_slug} onChange={(e) => set('site_slug', e.target.value.toLowerCase())} className={inputCls('site_slug')} placeholder="digital-footprint" />
            {errors.site_slug && <p className="text-xs text-red-400 mt-1">{errors.site_slug}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="sf-domain">Domain</label>
            <input id="sf-domain" value={form.domain} onChange={(e) => set('domain', e.target.value)} className={inputCls('domain')} placeholder="example.com" />
            {errors.domain && <p className="text-xs text-red-400 mt-1">{errors.domain}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="sf-email">Support email</label>
            <input id="sf-email" type="email" value={form.support_email} onChange={(e) => set('support_email', e.target.value)} className={inputCls('support_email')} placeholder="support@example.com" />
            {errors.support_email && <p className="text-xs text-red-400 mt-1">{errors.support_email}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="sf-website">Linked website</label>
            <select id="sf-website" value={form.website_id} onChange={(e) => set('website_id', e.target.value)} className={inputCls('website_id')}>
              <option value="">None</option>
              {websites.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="sf-project">Linked project</label>
            <select id="sf-project" value={form.project_id} onChange={(e) => set('project_id', e.target.value)} className={inputCls('project_id')}>
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.project_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="sf-mode">Integration mode</label>
          <select id="sf-mode" value={form.integration_mode} onChange={(e) => set('integration_mode', e.target.value as FormState['integration_mode'])} className={inputCls('integration_mode')}>
            <option value="public_form">Public form</option>
            <option value="server_to_server">Server-to-server</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground-400 mb-1">Allowed origins</label>
          <OriginEditor origins={form.allowed_origins} onChange={(o) => set('allowed_origins', o)} />
          {errors.allowed_origins && <p className="text-xs text-red-400 mt-1">{errors.allowed_origins}</p>}
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set('is_active', e.target.checked)}
            className="w-4 h-4 rounded border-background-300/60 text-accent-500 focus:ring-accent-500/40"
          />
          <span className="text-sm text-foreground-200">Active (accept new submissions)</span>
        </label>

        {!initial && form.is_active === false && (
          <p className="text-xs text-foreground-500">You are creating an inactive site — it will reject new submissions until enabled.</p>
        )}

        {initial && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3 text-xs text-foreground-300 leading-relaxed">
            Deactivating a site keeps existing tickets accessible but rejects new submissions.
            Credentials are revoked separately and are not rotated automatically on re-enable.
          </div>
        )}

        {submitError && <p className="text-sm text-red-400">{submitError}</p>}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
          >
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Register site'}
          </button>
        </div>
      </div>
    </Modal>
  );
}