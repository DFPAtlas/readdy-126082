import { useState, type FormEvent } from 'react';
import Modal from '@/components/base/Modal';
import type { AiModel, AiProvider, RiskLevel } from '@/pages/ai-operations/types';
import {
  PROVIDER_TYPE_OPTIONS,
  PROVIDER_TYPE_LABELS,
  MODEL_PURPOSE_OPTIONS,
  MODEL_PURPOSE_LABELS,
  ENVIRONMENT_OPTIONS,
  ENVIRONMENT_LABELS,
  RISK_LEVEL,
} from '@/pages/ai-operations/constants';

interface ModelFormModalProps {
  open: boolean;
  onClose: () => void;
  model: AiModel | null;
  providers: AiProvider[];
  onSave: (model: AiModel) => void;
}

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';

const labelCls = 'block text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1.5';

const RISK_OPTIONS: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

export default function ModelFormModal({ open, onClose, model, providers, onSave }: ModelFormModalProps) {
  const [name, setName] = useState(model?.name ?? '');
  const [providerId, setProviderId] = useState(model?.providerId ?? (providers[0]?.id ?? ''));
  const [providerType, setProviderType] = useState(model?.providerType ?? 'cloud');
  const [reference, setReference] = useState(model?.id ?? '');
  const [purpose, setPurpose] = useState(model?.purpose ?? 'general');
  const [hostingType, setHostingType] = useState(model?.hostingType ?? 'cloud');
  const [environment, setEnvironment] = useState(model?.environment ?? 'production');
  const [status, setStatus] = useState(model?.status ?? 'not_configured');
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(model?.riskLevel ?? 'medium');
  const [enabled, setEnabled] = useState(model?.enabled ?? true);
  const [fallback, setFallback] = useState(model?.fallbackModel ?? '');
  const [notes, setNotes] = useState(model?.notes ?? '');

  const selectedProvider = providers.find((p) => p.id === providerId);

  const handleProviderChange = (value: string) => {
    setProviderId(value);
    const p = providers.find((pr) => pr.id === value);
    if (p) setProviderType(p.type);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const now = 'Just now';
    const id = model?.id ?? `MOD-${Date.now().toString(36).toUpperCase()}`;

    const record: AiModel = {
      id,
      name: name.trim(),
      providerId,
      providerName: selectedProvider?.name ?? 'Unknown',
      providerType,
      description: notes.trim() || 'Newly added model (draft metadata only).',
      family: 'Custom',
      purpose,
      hostingLocation: hostingType === 'local' ? 'Local (DFP on-prem)' : 'Cloud',
      environment,
      status,
      health: 'unknown',
      enabled,
      hostingType,
      contextWindow: '—',
      maxOutput: '—',
      visionSupport: false,
      toolSupport: false,
      structuredOutputSupport: false,
      embeddingSupport: purpose === 'embeddings',
      speed: '—',
      quality: '—',
      cost: '—',
      inputCost: '—',
      outputCost: '—',
      localComputeCost: '—',
      jobsToday: 0,
      failuresToday: 0,
      avgResponseTime: '—',
      fallbackModelId: null,
      fallbackModel: fallback.trim() || '—',
      configurationState: 'missing',
      lastChecked: now,
      notes: notes.trim(),
      riskLevel,
      capabilities: {
        text: 'supported',
        reasoning: purpose === 'reasoning' ? 'supported' : 'unsupported',
        coding: purpose === 'coding' ? 'supported' : 'unsupported',
        vision: purpose === 'vision' ? 'supported' : 'unsupported',
        tools: 'unsupported',
        structuredOutput: 'unsupported',
        embeddings: purpose === 'embeddings' ? 'supported' : 'unsupported',
        longContext: 'unsupported',
      },
      limits: { contextWindow: '—', maxOutput: '—', rate: '—', concurrency: '—', localResource: null },
      fallback: {
        primaryModelId: id,
        primaryModel: name.trim(),
        fallbackModelId: null,
        fallbackModel: fallback.trim() || '—',
        trigger: 'Not configured',
        providerChange: false,
        costChange: '—',
        capabilityDifference: '—',
      },
      usage: {
        jobsToday: 0,
        estimatedInputTokens: '—',
        estimatedOutputTokens: '—',
        estimatedProviderCost: '£0.00',
        localComputeEstimate: '—',
        avgCostPerRun: '—',
        avgResponseTime: '—',
        failureRate: '—',
      },
      usageEvents: [],
      healthMeta: { status, lastChecked: now, responseHealth: '—', capacityState: 'offline', recentFailures: 0, failureSummary: 'Not yet configured.', recommendedAction: 'Configure through secure connections in a later phase.' },
      security: {
        localProcessingAvailable: hostingType === 'local',
        externalProviderInvolved: hostingType === 'cloud',
        credentialsHidden: true,
        environmentSeparation: true,
        sensitiveDataRestricted: true,
        approvalForRestricted: true,
        loggingPolicyRef: 'security/logging-models',
      },
      localMeta: hostingType === 'local'
        ? { hostRef: 'unassigned', runtime: 'Ollama', modelName: reference.trim() || name.trim(), loaded: false, capacity: '—', queue: 0, estimatedMemory: '—', availability: 'Not loaded' }
        : null,
    };

    onSave(record);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={model ? 'Edit Model' : 'Add Model'}
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div>
          <label className={labelCls}>Display name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} placeholder="e.g. My Custom Model" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Provider</label>
            <select value={providerId} onChange={(e) => handleProviderChange(e.target.value)} className={inputCls}>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Provider type</label>
            <select value={providerType} onChange={(e) => setProviderType(e.target.value as AiModel['providerType'])} className={inputCls}>
              {PROVIDER_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{PROVIDER_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Model / reference name</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} placeholder="e.g. my-model:latest" />
          </div>
          <div>
            <label className={labelCls}>Purpose</label>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value as AiModel['purpose'])} className={inputCls}>
              {MODEL_PURPOSE_OPTIONS.map((p) => (
                <option key={p} value={p}>{MODEL_PURPOSE_LABELS[p]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Local / Cloud</label>
            <select value={hostingType} onChange={(e) => setHostingType(e.target.value as AiModel['hostingType'])} className={inputCls}>
              <option value="cloud">Cloud</option>
              <option value="local">Local</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Environment</label>
            <select value={environment} onChange={(e) => setEnvironment(e.target.value as AiModel['environment'])} className={inputCls}>
              {ENVIRONMENT_OPTIONS.map((env) => (
                <option key={env} value={env}>{ENVIRONMENT_LABELS[env]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as AiModel['status'])} className={inputCls}>
              <option value="not_configured">Not Configured</option>
              <option value="available">Available</option>
              <option value="degraded">Degraded</option>
              <option value="unavailable">Unavailable</option>
              <option value="disabled">Disabled</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Risk level</label>
            <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value as RiskLevel)} className={inputCls}>
              {RISK_OPTIONS.map((r) => (
                <option key={r} value={r}>{RISK_LEVEL[r].label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Fallback model</label>
            <input value={fallback} onChange={(e) => setFallback(e.target.value)} className={inputCls} placeholder="Optional fallback model name" />
          </div>
          <div>
            <label className={labelCls}>Enabled</label>
            <select value={enabled ? 'yes' : 'no'} onChange={(e) => setEnabled(e.target.value === 'yes')} className={inputCls}>
              <option value="yes">Enabled</option>
              <option value="no">Disabled</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} className={inputCls} placeholder="Optional notes (no credentials)" />
        </div>

        <div className="bg-amber-500/10 border border-amber-500/25 rounded-md p-3">
          <p className="text-[11px] font-label text-amber-300 leading-relaxed">
            Provider credentials and live model connectivity will be configured separately through secure connections. No API keys or secrets are stored here.
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
            Save Draft
          </button>
        </div>
      </form>
    </Modal>
  );
}