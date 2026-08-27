import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { AiModel } from '@/pages/ai-operations/types';
import { useModels } from '@/pages/ai-operations/models/ModelsContext';
import { useAuth } from '@/components/feature/AuthGuard';
import { ROLE_LABELS } from '@/lib/permissions';
import ModelHeader from '@/pages/ai-operations/models/detail/components/ModelHeader';
import Overview from '@/pages/ai-operations/models/detail/components/Overview';
import Capabilities from '@/pages/ai-operations/models/detail/components/Capabilities';
import Limits from '@/pages/ai-operations/models/detail/components/Limits';
import AgentAssignments from '@/pages/ai-operations/models/detail/components/AgentAssignments';
import FallbackRouting from '@/pages/ai-operations/models/detail/components/FallbackRouting';
import UsageCost from '@/pages/ai-operations/models/detail/components/UsageCost';
import RecentUsage from '@/pages/ai-operations/models/detail/components/RecentUsage';
import Health from '@/pages/ai-operations/models/detail/components/Health';
import SecurityDataHandling from '@/pages/ai-operations/models/detail/components/SecurityDataHandling';
import LocalModel from '@/pages/ai-operations/models/detail/components/LocalModel';
import ApplicablePolicies from '@/pages/ai-operations/models/detail/components/ApplicablePolicies';
import { getAuditByModel } from '@/pages/ai-operations/audit/selectors';
import RecentAuditEvents from '@/pages/ai-operations/audit/components/RecentAuditEvents';
import ModelFormModal from '@/pages/ai-operations/models/components/ModelFormModal';

export default function ModelDetailPage() {
  const { modelId } = useParams<{ modelId: string }>();
  const { models, providers, updateModel } = useModels();
  const { user, role } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  const actor = user?.email ?? (role ? ROLE_LABELS[role] : 'Authenticated staff');

  const model = models.find((m) => m.id === modelId);

  if (!model) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg p-10 text-center max-w-lg mx-auto mt-16">
        <i className="ri-cpu-line text-4xl text-foreground-600 w-10 h-10 flex items-center justify-center mx-auto"></i>
        <h1 className="text-lg font-heading font-semibold text-foreground-50 mt-4">Model not found</h1>
        <p className="text-sm text-foreground-500 mt-2">The requested model does not exist in the registry.</p>
        <Link
          to="/ai-operations/models"
          className="inline-flex items-center gap-2 mt-6 text-sm font-label bg-accent-500 hover:bg-accent-400 text-background-950 rounded-md px-4 py-2 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
          Back to Models
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModelHeader model={model} onEdit={() => setModalOpen(true)} />

      <Overview model={model} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Capabilities model={model} />
        <Limits model={model} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AgentAssignments model={model} />
        <FallbackRouting model={model} />
      </div>

      <UsageCost model={model} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RecentUsage model={model} />
        <div className="space-y-5">
          <Health model={model} />
          <SecurityDataHandling model={model} />
        </div>
      </div>

      {model.localMeta && <LocalModel meta={model.localMeta} />}

      <ApplicablePolicies modelId={model.id} />

      <div className="bg-background-100 border border-amber-500/20 rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
        <i className="ri-flask-line text-sm text-amber-400 w-4 h-4 flex items-center justify-center"></i>
        <p className="text-xs text-foreground-500">
          Identity, provider, type, hosting, environment, status, health, capabilities, limits, cost and risk metadata are
          live registry data. Runtime usage, health telemetry, cost accounting and local resource state are labelled
          <span className="font-semibold text-foreground-300"> Demo Supporting Metadata</span> (not yet connected).
        </p>
      </div>

      <RecentAuditEvents title="Recent Audit Events" events={getAuditByModel(model.id)} emptyMessage="No recent audit events for this model." />

      <ModelFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        model={model}
        providers={providers}
        onSave={(record) => updateModel(model.id, record, actor)}
      />
    </div>
  );
}