import ReadinessKpis from '@/pages/ai-operations/readiness/components/ReadinessKpis';
import Phase2Closeout from '@/pages/ai-operations/readiness/components/Phase2Closeout';
import RuntimeHealthReadiness from '@/pages/ai-operations/readiness/components/RuntimeHealthReadiness';
import RuntimeConfigurationReadiness from '@/pages/ai-operations/readiness/components/RuntimeConfigurationReadiness';
import RuntimeSafetyReadiness from '@/pages/ai-operations/readiness/components/RuntimeSafetyReadiness';
import RuntimeBoundaryReadiness from '@/pages/ai-operations/readiness/components/RuntimeBoundaryReadiness';
import RuntimeN8nConnectorReadiness from '@/pages/ai-operations/readiness/components/RuntimeN8nConnectorReadiness';
import RuntimeMessageBoundaryReadiness from '@/pages/ai-operations/readiness/components/RuntimeMessageBoundaryReadiness';
import RuntimeBridgeReadiness from '@/pages/ai-operations/readiness/components/RuntimeBridgeReadiness';
import OllamaCatalogueReadiness from '@/pages/ai-operations/readiness/components/OllamaCatalogueReadiness';
import RuntimeTransportReadiness from '@/pages/ai-operations/readiness/components/RuntimeTransportReadiness';
import ModuleReadinessMatrix from '@/pages/ai-operations/readiness/components/ModuleReadinessMatrix';
import MockDataAudit from '@/pages/ai-operations/readiness/components/MockDataAudit';
import DatabasePlan from '@/pages/ai-operations/readiness/components/DatabasePlan';
import LiveIntegrationMap from '@/pages/ai-operations/readiness/components/LiveIntegrationMap';
import N8nPlan from '@/pages/ai-operations/readiness/components/N8nPlan';
import AgentRuntimePlan from '@/pages/ai-operations/readiness/components/AgentRuntimePlan';
import ModelConnectionPlan from '@/pages/ai-operations/readiness/components/ModelConnectionPlan';
import ToolConnectionPlan from '@/pages/ai-operations/readiness/components/ToolConnectionPlan';
import KnowledgeIngestionPlan from '@/pages/ai-operations/readiness/components/KnowledgeIngestionPlan';
import AnalyticsPlan from '@/pages/ai-operations/readiness/components/AnalyticsPlan';
import SecurityGates from '@/pages/ai-operations/readiness/components/SecurityGates';
import RlsReadiness from '@/pages/ai-operations/readiness/components/RlsReadiness';
import Environments from '@/pages/ai-operations/readiness/components/Environments';
import TestingPlan from '@/pages/ai-operations/readiness/components/TestingPlan';
import SiteActivationPlan from '@/pages/ai-operations/readiness/components/SiteActivationPlan';
import ProductionChecklist from '@/pages/ai-operations/readiness/components/ProductionChecklist';
import GoNoGo from '@/pages/ai-operations/readiness/components/GoNoGo';
import ImplementationPhases from '@/pages/ai-operations/readiness/components/ImplementationPhases';

export default function ReadinessPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-heading font-bold text-foreground-50">AI Operations Production Readiness</h1>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-label text-foreground-500 bg-background-100 border border-background-200/60 rounded-full px-2 py-0.5 whitespace-nowrap">
              Audit &amp; plan
            </span>
          </div>
          <p className="text-sm text-foreground-500 mt-1 max-w-3xl">
            Readiness, dependencies and staged activation plan for moving DFP AI Operations from demo architecture to controlled production operation.
          </p>
        </div>
        <div className="shrink-0 inline-flex items-center gap-2 bg-background-100 border border-background-200/60 rounded-lg px-3 py-2">
          <i className="ri-information-line text-accent-400 text-sm w-4 h-4 flex items-center justify-center"></i>
          <span className="text-xs font-label text-foreground-100">Phase 2 Control Plane Complete — Runtime Pending</span>
        </div>
      </div>

      {/* KPIs */}
      <ReadinessKpis />

      {/* Phase 2 closeout */}
      <Phase2Closeout />

      {/* Phase 3 runtime connectivity & health */}
      <RuntimeHealthReadiness />

      {/* Phase 3 runtime configuration & connection gate */}
      <RuntimeConfigurationReadiness />

      {/* Phase 3 runtime safety controls + pilot execution gate */}
      <RuntimeSafetyReadiness />

      {/* Phase 3 trusted runtime boundary (deny-only gateway) */}
      <RuntimeBoundaryReadiness />

      {/* Phase 3 n8n runtime connector (read-only metadata adapter) */}
      <RuntimeN8nConnectorReadiness />

      {/* Phase 3 runtime message boundary (signed callbacks) */}
      <RuntimeMessageBoundaryReadiness />

      {/* Phase 3 private runtime bridge (outbound local runtime connectivity) */}
      <RuntimeBridgeReadiness />

      {/* Phase 3 local Ollama catalogue relay + registry comparison */}
      <OllamaCatalogueReadiness />

      {/* Phase 3 private runtime dry-run transport probe */}
      <RuntimeTransportReadiness />

      {/* Module readiness matrix */}
      <ModuleReadinessMatrix />

      {/* Mock data audit */}
      <MockDataAudit />

      {/* Database plan */}
      <DatabasePlan />

      {/* Integration map */}
      <LiveIntegrationMap />

      {/* n8n plan */}
      <N8nPlan />

      {/* Agent runtime */}
      <AgentRuntimePlan />

      {/* Model connections */}
      <ModelConnectionPlan />

      {/* Tool connections */}
      <ToolConnectionPlan />

      {/* Knowledge ingestion */}
      <KnowledgeIngestionPlan />

      {/* Analytics */}
      <AnalyticsPlan />

      {/* Security gates + kill switch */}
      <SecurityGates />

      {/* RLS */}
      <RlsReadiness />

      {/* Environments */}
      <Environments />

      {/* Testing plan */}
      <TestingPlan />

      {/* Site activation */}
      <SiteActivationPlan />

      {/* Production checklist */}
      <ProductionChecklist />

      {/* Go / No-Go */}
      <GoNoGo />

      {/* Implementation phases */}
      <ImplementationPhases />
    </div>
  );
}