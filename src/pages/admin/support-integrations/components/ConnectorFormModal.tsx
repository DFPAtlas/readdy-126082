import { useEffect, useState } from 'react';
import Modal from '@/components/base/Modal';
import { supabase } from '@/lib/supabase';
import type { ConnectorType, SupportSiteConnector } from '@/types/support-tickets';
import { CONNECTOR_TYPES } from '../onboarding-constants';

interface ConnectorFormModalProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  initial: SupportSiteConnector | null;
  onSaved: () => void;
}

interface FormState {
  connector_type: ConnectorType;
  api_base_reference: string;
  credential_configured: boolean;
  n8n_workflow_reference: string;
}

const EMPTY: FormState = {
  connector_type: 'rest_api',
  api_base_reference: '',
  credential_configured: false,
  n8n_workflow_reference: '',
};

export default function ConnectorFormModal({ open, onClose, siteId, initial, onSaved }: ConnectorFormModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        connector_type: initial.connector_type,
        api_base_reference: initial.api_base_reference ?? '',
        credential_configured: initial.credential_configured,
        n8n_workflow_reference: initial.n8n_workflow_reference ?? '',
      });
    } else {
      setForm(EMPTY);
    }
    setError('');
  }, [open, initial]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('support_upsert_site_connector', {
        p_site_id: siteId,
        p_connector_type: form.connector_type,
        p_api_base_reference: form.api_base_reference.trim() || null,
        p_credential_configured: form.credential_configured,
        p_n8n_workflow_reference: form.n8n_workflow_reference.trim() || null,
        p_connector_id: initial?.id ?? null,
      });
      if (rpcError) throw rpcError;
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save connector.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full text-sm bg-background-50 border border-background-300/60 rounded-md px-3 py-2 text-foreground-100 placeholder:text-foreground-600 focus:outline-none focus:ring-2 focus:ring-accent-500/40';

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit connector' : 'Add connector'} className="max-w-lg">
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="cf-type">Connector type</label>
          <select
            id="cf-type"
            value={form.connector_type}
            onChange={(e) => set('connector_type', e.target.value as ConnectorType)}
            className={inputCls}
          >
            {CONNECTOR_TYPES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="cf-base">API base reference</label>
          <input
            id="cf-base"
            value={form.api_base_reference}
            onChange={(e) => set('api_base_reference', e.target.value)}
            className={inputCls}
            placeholder="e.g. internal service name or endpoint reference"
          />
          <p className="text-xs text-foreground-600 mt-1">A non-secret reference only — never paste keys or tokens here.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground-400 mb-1" htmlFor="cf-n8n">n8n workflow reference</label>
          <input
            id="cf-n8n"
            value={form.n8n_workflow_reference}
            onChange={(e) => set('n8n_workflow_reference', e.target.value)}
            className={inputCls}
            placeholder="e.g. workflow name or internal reference"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.credential_configured}
            onChange={(e) => set('credential_configured', e.target.checked)}
            className="w-4 h-4 rounded border-background-300/60 text-accent-500 focus:ring-accent-500/40"
            id="cf-cred"
          />
          <div>
            <label htmlFor="cf-cred" className="text-sm text-foreground-200 cursor-pointer">API credential configured</label>
            <p className="text-xs text-foreground-600">Mark once the secret is stored in Supabase Secrets / n8n. The value itself is never shown or stored here.</p>
          </div>
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-background-400/60">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-accent-500 hover:bg-accent-400 text-background-950 px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40"
        >
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add connector'}
        </button>
      </div>
    </Modal>
  );
}