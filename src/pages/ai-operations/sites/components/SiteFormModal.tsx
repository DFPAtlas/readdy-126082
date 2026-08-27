import { useEffect, useState } from 'react';
import Modal from '@/components/base/Modal';
import type { SiteRegistryRecord } from '@/pages/ai-operations/types';
import type { SiteDataSourceMode } from '@/pages/ai-operations/sites/SitesContext';
import {
  ENVIRONMENT_OPTIONS,
  BUSINESS_TYPE_OPTIONS,
  CRITICALITY_OPTIONS,
  ENVIRONMENT_LABELS,
  BUSINESS_TYPE_LABELS,
  RISK_LEVEL,
} from '@/pages/ai-operations/constants';

interface SiteFormModalProps {
  open: boolean;
  onClose: () => void;
  /** null = create new site; otherwise edit this site. */
  site: SiteRegistryRecord | null;
  /** Current data-source mode — controls the save label and behaviour. */
  mode: SiteDataSourceMode;
  onSave: (record: SiteRegistryRecord) => Promise<{ error: string | null }>;
}

interface FormState {
  name: string;
  domain: string;
  description: string;
  businessType: string;
  environment: string;
  criticality: string;
  ownerTeam: string;
  repository: string;
  readdyProject: string;
  supabaseProject: string;
  n8nConnection: string;
  billingProvider: string;
  emailProvider: string;
  authProvider: string;
  hosting: string;
}

const empty: FormState = {
  name: '',
  domain: '',
  description: '',
  businessType: 'website',
  environment: 'production',
  criticality: 'medium',
  ownerTeam: '',
  repository: '',
  readdyProject: '',
  supabaseProject: '',
  n8nConnection: '',
  billingProvider: '',
  emailProvider: '',
  authProvider: '',
  hosting: '',
};

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export default function SiteFormModal({ open, onClose, site, mode, onSave }: SiteFormModalProps) {
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isLive = mode === 'live';

  useEffect(() => {
    if (open) {
      setForm(
        site
          ? {
              name: site.name,
              domain: site.domain,
              description: site.description,
              businessType: site.businessType,
              environment: site.environment,
              criticality: site.criticality,
              ownerTeam: site.ownerTeam,
              repository: site.repository,
              readdyProject: site.readdyProject,
              supabaseProject: site.supabaseProject,
              n8nConnection: site.n8nConnection,
              billingProvider: site.billingProvider,
              emailProvider: site.emailProvider,
              authProvider: site.authProvider,
              hosting: site.hosting,
            }
          : empty,
      );
      setError('');
      setSubmitting(false);
    }
  }, [open, site]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Site name is required.');
      return;
    }
    if (!form.domain.trim()) {
      setError('Domain is required.');
      return;
    }

    const now = 'Just now';
    const base = (site ?? {}) as Partial<SiteRegistryRecord>;

    const record: SiteRegistryRecord = {
      id: site?.id ?? slugify(form.name),
      name: form.name.trim(),
      productName: base.productName ?? form.name.trim(),
      domain: form.domain.trim(),
      description: form.description.trim(),
      businessType: (form.businessType as SiteRegistryRecord['businessType']) ?? 'website',
      environment: (form.environment as SiteRegistryRecord['environment']) ?? 'production',
      operationalStatus: base.operationalStatus ?? 'unknown',
      aiStatus: base.aiStatus ?? 'not_configured',
      criticality: (form.criticality as SiteRegistryRecord['criticality']) ?? 'medium',
      ownerTeam: form.ownerTeam.trim(),
      repository: form.repository.trim(),
      readdyProject: form.readdyProject.trim(),
      supabaseProject: form.supabaseProject.trim(),
      n8nConnection: form.n8nConnection.trim(),
      billingProvider: form.billingProvider.trim(),
      emailProvider: form.emailProvider.trim(),
      authProvider: form.authProvider.trim(),
      hosting: form.hosting.trim(),
      lastHealthCheck: base.lastHealthCheck ?? 'Never',
      lastAgentActivity: base.lastAgentActivity ?? 'Never',
      activeAgentCount: base.activeAgentCount ?? 0,
      currentJobs: base.currentJobs ?? 0,
      failedJobs: base.failedJobs ?? 0,
      pendingApprovals: base.pendingApprovals ?? 0,
      openAlerts: base.openAlerts ?? 0,
      openTickets: base.openTickets ?? 0,
      uatStatus: base.uatStatus ?? 'Not started',
      notes: base.notes ?? 'Draft entry.',
      createdAt: base.createdAt ?? '2026-08-25',
      updatedAt: now,
      connections: base.connections ?? [],
      capabilities: base.capabilities ?? [],
      dependencies: base.dependencies ?? [],
      ownership: base.ownership ?? {
        businessOwner: '',
        technicalOwner: '',
        supportTeam: '',
        escalationTeam: '',
        defaultSeverity: 'Medium',
        supportQueue: '',
      },
      agents: base.agents ?? [],
    };

    setSubmitting(true);
    const { error: saveError } = await onSave(record);
    if (saveError) {
      // Preserve entered form data and surface a sanitised error.
      setError(saveError);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onClose();
  };

  const saveLabel = isLive ? (site ? 'Update Site' : 'Create Site') : 'Save Draft';

  return (
    <Modal open={open} onClose={onClose} title={site ? 'Edit Site' : 'Add Site'} className="max-w-2xl">
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Site name *</label>
            <input type="text" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. GuardianHub" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Domain *</label>
            <input type="text" value={form.domain} onChange={(e) => set({ domain: e.target.value })} placeholder="e.g. example.com" className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-label text-foreground-500 mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={2} maxLength={500} placeholder="What this site does..." className={`${inputCls} resize-y`} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Business type</label>
            <select value={form.businessType} onChange={(e) => set({ businessType: e.target.value })} className={`${inputCls} cursor-pointer`}>
              {BUSINESS_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{BUSINESS_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Environment</label>
            <select value={form.environment} onChange={(e) => set({ environment: e.target.value })} className={`${inputCls} cursor-pointer`}>
              {ENVIRONMENT_OPTIONS.map((e) => (
                <option key={e} value={e}>{ENVIRONMENT_LABELS[e]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Criticality</label>
            <select value={form.criticality} onChange={(e) => set({ criticality: e.target.value })} className={`${inputCls} cursor-pointer`}>
              {CRITICALITY_OPTIONS.map((c) => (
                <option key={c} value={c}>{RISK_LEVEL[c].label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Owner / team</label>
            <input type="text" value={form.ownerTeam} onChange={(e) => set({ ownerTeam: e.target.value })} placeholder="e.g. QuickGuard Ops" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Repository</label>
            <input type="text" value={form.repository} onChange={(e) => set({ repository: e.target.value })} placeholder="org/repo" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Readdy project reference</label>
            <input type="text" value={form.readdyProject} onChange={(e) => set({ readdyProject: e.target.value })} placeholder="RDDY-XXX-000" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Supabase project reference</label>
            <input type="text" value={form.supabaseProject} onChange={(e) => set({ supabaseProject: e.target.value })} placeholder="supabase-xxx" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">n8n reference</label>
            <input type="text" value={form.n8nConnection} onChange={(e) => set({ n8nConnection: e.target.value })} placeholder="n8n-xxx" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Billing provider</label>
            <input type="text" value={form.billingProvider} onChange={(e) => set({ billingProvider: e.target.value })} placeholder="Stripe" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Email provider</label>
            <input type="text" value={form.emailProvider} onChange={(e) => set({ emailProvider: e.target.value })} placeholder="Resend" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Authentication provider</label>
            <input type="text" value={form.authProvider} onChange={(e) => set({ authProvider: e.target.value })} placeholder="Supabase Auth" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-label text-foreground-500 mb-1">Hosting provider</label>
            <input type="text" value={form.hosting} onChange={(e) => set({ hosting: e.target.value })} placeholder="Vercel" className={inputCls} />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
          <p className="text-[11px] font-label text-foreground-600">
            {isLive ? 'Saves directly to the live site registry (Supabase).' : 'Local draft only — not written to the live registry.'}
          </p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-400 disabled:opacity-60 disabled:cursor-not-allowed text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              {submitting && <i className="ri-loader-4-line text-sm w-4 h-4 flex items-center justify-center animate-spin"></i>}
              {submitting ? 'Saving…' : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}