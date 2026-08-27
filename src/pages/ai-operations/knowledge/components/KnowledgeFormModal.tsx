import { useState, type FormEvent } from 'react';
import Modal from '@/components/base/Modal';
import type { KnowledgeSource } from '@/pages/ai-operations/types';
import {
  KNOWLEDGE_SOURCE_TYPE_OPTIONS,
  KNOWLEDGE_SOURCE_TYPE_LABELS,
  KNOWLEDGE_SCOPE_OPTIONS,
  KNOWLEDGE_SCOPE_LABELS,
  INFORMATION_CLASSIFICATION_OPTIONS,
  INFORMATION_CLASSIFICATION,
} from '@/pages/ai-operations/constants';
import { demoSites } from '@/mocks/ai-operations-sites';

interface KnowledgeFormModalProps {
  open: boolean;
  onClose: () => void;
  source: KnowledgeSource | null;
  onSave: (source: KnowledgeSource) => void;
}

const inputCls =
  'w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-md px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors';

const labelCls = 'block text-[11px] font-label text-foreground-500 uppercase tracking-wide mb-1.5';

export default function KnowledgeFormModal({ open, onClose, source, onSave }: KnowledgeFormModalProps) {
  const [title, setTitle] = useState(source?.title ?? '');
  const [description, setDescription] = useState(source?.description ?? '');
  const [type, setType] = useState(source?.type ?? 'documentation');
  const [scope, setScope] = useState(source?.scope ?? 'group');
  const [siteId, setSiteId] = useState(source?.siteId ?? '');
  const [ownerTeam, setOwnerTeam] = useState(source?.ownerTeam ?? '');
  const [classification, setClassification] = useState(source?.classification ?? 'internal');
  const [version, setVersion] = useState(source?.version ?? 'v1.0');
  const [reference, setReference] = useState(source?.reference ?? '');
  const [aiUsageAllowed, setAiUsageAllowed] = useState(source?.aiUsageAllowed ?? true);
  const [nextReview, setNextReview] = useState(source?.nextReview ?? '');
  const [notes, setNotes] = useState(source?.notes ?? '');

  const selectedSite = demoSites.find((s) => s.id === siteId);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const now = 'Just now';
    const id = source?.id ?? `KNOW-${Date.now().toString(36).toUpperCase()}`;
    const isGroup = scope === 'group';

    const record: KnowledgeSource = {
      id,
      title: title.trim(),
      description: description.trim() || 'Newly added knowledge source (draft metadata only).',
      type,
      scope,
      siteId: isGroup ? null : siteId || null,
      siteName: isGroup ? 'Group-wide' : selectedSite?.name ?? 'Unassigned',
      assignedAgentIds: [],
      ownerTeam: ownerTeam.trim() || 'Unassigned',
      status: 'draft',
      classification,
      sensitivity: classification === 'restricted' ? 'Critical' : 'Medium',
      version: version.trim() || 'v1.0',
      reference: reference.trim() || 'kb/draft',
      contentFormat: 'Markdown',
      reviewState: 'current',
      lastReviewed: '—',
      nextReview: nextReview.trim() || '—',
      createdAt: now,
      updatedAt: now,
      trustedSource: false,
      aiUsageAllowed,
      retrievalAllowed: aiUsageAllowed,
      summarisationAllowed: aiUsageAllowed,
      modificationAllowed: false,
      vectorReady: false,
      indexingState: 'Not indexed',
      notes: notes.trim(),
      keywords: [],
      tags: ['draft'],
      topics: [],
      permissions: [
        { permission: 'Read', state: 'allowed', note: 'Read permitted for assigned agents.' },
        { permission: 'Retrieve', state: 'allowed', note: 'Retrieval within permitted scope.' },
        { permission: 'Summarise', state: 'allowed', note: 'Summarisation allowed where enabled.' },
        { permission: 'Reference in answer', state: 'allowed', note: 'May be cited in agent answers.' },
        { permission: 'Use for planning', state: 'allowed', note: 'Usable for planning tasks.' },
        { permission: 'Use for diagnostics', state: 'allowed', note: 'Usable for diagnostics.' },
        { permission: 'Update', state: 'restricted', note: 'Edits require human curation.' },
        { permission: 'Delete', state: 'denied', note: 'Destructive — denied by default.' },
      ],
      agentAccess: [],
      governance: {
        trustedSource: false,
        owner: ownerTeam.trim() || 'Unassigned',
        reviewRequired: true,
        reviewFrequency: 'Quarterly',
        lastReviewer: '—',
        versionControl: 'Versioned',
        expiryDate: nextReview.trim() || '—',
        auditRequired: true,
      },
      aiUsageRules: ['Internal only', 'Citations / reference required'],
      relationships: [],
      usageEvents: [],
      reviewHistory: [],
      quality: [
        { name: 'Trusted source', state: 'fail', note: 'Not yet marked trusted.' },
        { name: 'Current version', state: 'unknown', note: 'Draft.' },
        { name: 'Review current', state: 'unknown', note: 'Not reviewed.' },
        { name: 'Owner assigned', state: ownerTeam.trim() ? 'pass' : 'warning', note: ownerTeam.trim() ? 'Owner set.' : 'Owner not set.' },
        { name: 'Classification set', state: 'pass', note: 'Classification defined.' },
        { name: 'Agent scope defined', state: 'warning', note: 'No agents assigned yet.' },
        { name: 'Source reachable', state: 'unknown', note: 'Not yet validated.' },
        { name: 'Conflicting source detected', state: 'unknown', note: 'No conflict scan run.' },
      ],
      index: {
        vectorReady: false,
        indexed: false,
        indexProvider: '—',
        embeddingModelId: null,
        embeddingModel: '—',
        lastIndexed: 'Never',
        chunkCount: 0,
      },
      incidentMemory: null,
    };

    onSave(record);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={source ? 'Edit Knowledge Source' : 'Add Knowledge Source'} className="max-w-xl">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div>
          <label className={labelCls}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputCls} placeholder="e.g. New Operating Procedure" />
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} className={inputCls} placeholder="Short description of this source" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as KnowledgeSource['type'])} className={inputCls}>
              {KNOWLEDGE_SOURCE_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{KNOWLEDGE_SOURCE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Scope</label>
            <select value={scope} onChange={(e) => setScope(e.target.value as KnowledgeSource['scope'])} className={inputCls}>
              {KNOWLEDGE_SCOPE_OPTIONS.map((s) => (
                <option key={s} value={s}>{KNOWLEDGE_SCOPE_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>

        {scope === 'site' && (
          <div>
            <label className={labelCls}>Site</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={inputCls}>
              <option value="">Select a site…</option>
              {demoSites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Owner / team</label>
            <input value={ownerTeam} onChange={(e) => setOwnerTeam(e.target.value)} className={inputCls} placeholder="e.g. DFP Core Team" />
          </div>
          <div>
            <label className={labelCls}>Classification</label>
            <select value={classification} onChange={(e) => setClassification(e.target.value as KnowledgeSource['classification'])} className={inputCls}>
              {INFORMATION_CLASSIFICATION_OPTIONS.map((c) => (
                <option key={c} value={c}>{INFORMATION_CLASSIFICATION[c].label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Version</label>
            <input value={version} onChange={(e) => setVersion(e.target.value)} className={inputCls} placeholder="e.g. v1.0" />
          </div>
          <div>
            <label className={labelCls}>Reference / location</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} placeholder="e.g. kb/group/example" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>AI usage allowed</label>
            <select value={aiUsageAllowed ? 'yes' : 'no'} onChange={(e) => setAiUsageAllowed(e.target.value === 'yes')} className={inputCls}>
              <option value="yes">Allowed</option>
              <option value="no">Not allowed</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Review date</label>
            <input value={nextReview} onChange={(e) => setNextReview(e.target.value)} className={inputCls} placeholder="e.g. 2026-11-20" />
          </div>
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className={inputCls} placeholder="Optional notes (no credentials or private data)" />
        </div>

        <div className="bg-amber-500/10 border border-amber-500/25 rounded-md p-3">
          <p className="text-[11px] font-label text-amber-300 leading-relaxed">
            Document ingestion, indexing and persistence will be connected in a later phase. No files, credentials or private data are accepted here.
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