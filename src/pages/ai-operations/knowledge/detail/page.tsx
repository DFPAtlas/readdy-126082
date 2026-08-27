import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useKnowledge } from '@/pages/ai-operations/knowledge/KnowledgeContext';
import type { KnowledgeSource } from '@/pages/ai-operations/types';
import KnowledgeHeader from '@/pages/ai-operations/knowledge/detail/components/KnowledgeHeader';
import Overview from '@/pages/ai-operations/knowledge/detail/components/Overview';
import AgentAccess from '@/pages/ai-operations/knowledge/detail/components/AgentAccess';
import KnowledgePermissions from '@/pages/ai-operations/knowledge/detail/components/KnowledgePermissions';
import SourceGovernance from '@/pages/ai-operations/knowledge/detail/components/SourceGovernance';
import AiUsageRules from '@/pages/ai-operations/knowledge/detail/components/AiUsageRules';
import SourceRelationships from '@/pages/ai-operations/knowledge/detail/components/SourceRelationships';
import AgentUsage from '@/pages/ai-operations/knowledge/detail/components/AgentUsage';
import ReviewHistory from '@/pages/ai-operations/knowledge/detail/components/ReviewHistory';
import KnowledgeQuality from '@/pages/ai-operations/knowledge/detail/components/KnowledgeQuality';
import SearchPreparation from '@/pages/ai-operations/knowledge/detail/components/SearchPreparation';
import EmbeddingPreparation from '@/pages/ai-operations/knowledge/detail/components/EmbeddingPreparation';
import IncidentMemory from '@/pages/ai-operations/knowledge/detail/components/IncidentMemory';
import ApplicablePolicies from '@/pages/ai-operations/knowledge/detail/components/ApplicablePolicies';
import { getAuditByKnowledge } from '@/pages/ai-operations/audit/selectors';
import RecentAuditEvents from '@/pages/ai-operations/audit/components/RecentAuditEvents';
import KnowledgeFormModal from '@/pages/ai-operations/knowledge/components/KnowledgeFormModal';

export default function KnowledgeDetailPage() {
  const { sourceId } = useParams<{ sourceId: string }>();
  const { sources, updateSource } = useKnowledge();
  const [modalOpen, setModalOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const source = sources.find((s) => s.id === sourceId);

  const handleSave = async (record: KnowledgeSource) => {
    if (!source) return;
    setSaveError(null);
    const res = await updateSource(source.id, record);
    if (res.error) setSaveError(res.error);
  };

  if (!source) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-lg mx-auto mt-16">
        <i className="ri-book-2-line text-4xl text-foreground-600 w-10 h-10 flex items-center justify-center mx-auto"></i>
        <h1 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Knowledge source not found</h1>
        <p className="text-sm text-foreground-500 mt-2">The requested source does not exist in the registry.</p>
        <Link
          to="/ai-operations/knowledge"
          className="inline-flex items-center gap-2 mt-6 text-sm font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
          Back to Knowledge &amp; Memory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <KnowledgeHeader source={source} onEdit={() => setModalOpen(true)} />

      {saveError && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-3 text-sm text-red-400">
          {saveError}
        </div>
      )}

      <div className="bg-accent-500/10 border border-accent-500/20 rounded-lg px-4 py-3 flex items-start gap-3">
        <i className="ri-information-line text-sm text-accent-400 w-4 h-4 flex items-center justify-center mt-0.5"></i>
        <p className="text-[12px] font-label text-foreground-200 leading-relaxed">
          Registry metadata below is live. <strong>Knowledge ingestion runtime is not connected</strong> — no
          document ingestion, indexing, embedding or retrieval is performed. Supporting runtime detail (usage,
          review history, quality and index preview) remains labelled as demo metadata.
        </p>
      </div>

      <Overview source={source} />

      <div className="bg-background-100 border border-dashed border-background-300/60 rounded-lg px-4 py-2.5 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 whitespace-nowrap">
          <i className="ri-flask-line text-xs w-3.5 h-3.5 flex items-center justify-center"></i>
          Demo Supporting Metadata
        </span>
        <span className="text-[11px] font-label text-foreground-600">Sections below are demo-derived until their production tables exist.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AgentAccess source={source} />
        <KnowledgePermissions source={source} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SourceGovernance source={source} />
        <AiUsageRules source={source} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SourceRelationships source={source} />
        <AgentUsage source={source} />
      </div>

      {source.incidentMemory && <IncidentMemory memory={source.incidentMemory} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ReviewHistory source={source} />
        <KnowledgeQuality source={source} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SearchPreparation source={source} />
        <EmbeddingPreparation source={source} />
      </div>

      <ApplicablePolicies sourceId={source.id} />

      <RecentAuditEvents title="Recent Audit Events" events={getAuditByKnowledge(source.id)} emptyMessage="No recent audit events for this knowledge source." />

      <KnowledgeFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        source={source}
        onSave={handleSave}
      />
    </div>
  );
}