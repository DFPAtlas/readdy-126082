import { useState, type FormEvent } from 'react';
import Modal from '@/components/base/Modal';
import type { AiProvider, ProviderType, ModelStatus } from '@/pages/ai-operations/types';
import { PROVIDER_TYPE_OPTIONS, PROVIDER_TYPE_LABELS, MODEL_STATUS_OPTIONS, MODEL_STATUS } from '@/pages/ai-operations/constants';

interface ProviderFormModalProps {
  open: boolean;
  onClose: () => void;
  provider: AiProvider | null;
  onSave: (provider: AiProvider) => void;
}

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';

const labelCls = 'block text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1.5';

export default function ProviderFormModal({ open, onClose, provider, onSave }: ProviderFormModalProps) {
  const [name, setName] = useState(provider?.name ?? '');
  const [key, setKey] = useState(provider?.id ?? '');
  const [type, setType] = useState<ProviderType>(provider?.type ?? 'cloud');
  const [status, setStatus] = useState<ModelStatus>(provider?.status ?? 'available');
  const [description, setDescription] = useState(provider?.description ?? '');
  const [credentialRef, setCredentialRef] = useState(provider?.credentialReference ?? '');
  const [endpointRef, setEndpointRef] = useState(provider?.endpointReference ?? '');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const record: AiProvider = {
      id: provider ? provider.id : (key.trim() || `PROV-${name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '-')}`),
      name: name.trim(),
      type,
      status,
      description: description.trim() || 'Newly added provider (draft metadata only).',
      availableModels: provider?.availableModels ?? '0',
      activeRequests: provider?.activeRequests ?? 0,
      failures: provider?.failures ?? 0,
      avgResponseTime: provider?.avgResponseTime ?? '—',
      estimatedCostToday: provider?.estimatedCostToday ?? '£0.00',
      lastActivity: provider?.lastActivity ?? 'Just now',
      connectionId: provider?.connectionId ?? null,
      credentialReference: credentialRef.trim() || undefined,
      endpointReference: endpointRef.trim() || undefined,
      ownerTeam: provider?.ownerTeam ?? 'DFP Core Team',
      isActive: provider?.isActive ?? true,
    };

    onSave(record);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={provider ? 'Edit Provider' : 'Add Provider'}
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Display name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} placeholder="e.g. OpenAI" />
          </div>
          <div>
            <label className={labelCls}>Provider key</label>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={Boolean(provider)}
              className={`${inputCls} ${provider ? 'opacity-60' : ''}`}
              placeholder="e.g. PROV-OPENAI"
              required={!provider}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Provider type</label>
            <select value={type} onChange={(e) => setType(e.target.value as ProviderType)} className={inputCls}>
              {PROVIDER_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{PROVIDER_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ModelStatus)} className={inputCls}>
              {MODEL_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{MODEL_STATUS[s].label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} className={inputCls} placeholder="Optional description" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Credential reference (label)</label>
            <input value={credentialRef} onChange={(e) => setCredentialRef(e.target.value)} className={inputCls} placeholder="e.g. openai-group-prod" />
          </div>
          <div>
            <label className={labelCls}>Endpoint reference (label)</label>
            <input value={endpointRef} onChange={(e) => setEndpointRef(e.target.value)} className={inputCls} placeholder="e.g. api.openai.com" />
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/25 rounded-md p-3">
          <p className="text-[11px] font-label text-amber-300 leading-relaxed">
            <span className="font-semibold">Credential value hidden / managed externally.</span> Only safe reference
            labels are stored here — no API keys, tokens or secrets are saved. No provider connectivity is performed.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-xs font-label text-foreground-300 bg-background-50 border border-background-300/60 rounded-md px-3 py-2 hover:text-foreground-100 hover:border-background-400/60 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 text-xs font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-3 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            {provider ? 'Save Changes' : 'Add Provider'}
          </button>
        </div>
      </form>
    </Modal>
  );
}