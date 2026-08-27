import { createContext, useContext, useMemo, useState } from 'react';
import type { AiOrchestration, RoutingSimulationResult } from '@/pages/ai-operations/types';
import { demoOrchestrations } from '@/mocks/ai-operations-orchestrator';

interface OrchestratorContextValue {
  orchestrations: AiOrchestration[];
  addSimulation: (result: RoutingSimulationResult, form: { title: string; description: string; source: string; environment: string; priority: string; risk: string }) => AiOrchestration;
}

const OrchestratorContext = createContext<OrchestratorContextValue | null>(null);

function nextId(orchestrations: AiOrchestration[]): string {
  const max = orchestrations.reduce((acc, o) => {
    const n = parseInt(o.id.replace('ORC-', ''), 10);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 7000);
  return `ORC-${max + 1}`;
}

export function OrchestratorProvider({ children }: { children: React.ReactNode }) {
  const [orchestrations, setOrchestrations] = useState<AiOrchestration[]>(() => demoOrchestrations as AiOrchestration[]);

  const addSimulation = (
    result: RoutingSimulationResult,
    form: { title: string; description: string; source: string; environment: string; priority: string; risk: string },
  ): AiOrchestration => {
    const now = 'Just now';
    const record: AiOrchestration = {
      id: nextId(orchestrations),
      correlationId: `COR-SIM-${Date.now()}`,
      title: form.title || 'Routing simulation',
      description: form.description || 'Frontend-only routing simulation (not executed).',
      triggerSource: 'manual',
      requestedBy: 'Simulation',
      siteId: 'group',
      siteName: 'Group-wide',
      detectedIntent: 'Routing simulation',
      taskType: 'other',
      priority: (form.priority as AiOrchestration['priority']) || 'normal',
      risk: (form.risk as AiOrchestration['risk']) || 'low',
      riskClass: 'green',
      environment: (form.environment as AiOrchestration['environment']) || 'production',
      status: 'received',
      currentStage: 'receive',
      primaryAgentId: result.recommendedAgentId,
      primaryAgentName: result.recommendedAgentName,
      supportingAgentIds: [],
      candidateAgentIds: result.candidates.map((c) => c.agentId),
      rootRunId: null,
      approvalId: null,
      approvalRequired: result.approvalRequired,
      verificationRequired: false,
      uatRequired: false,
      auditRequired: false,
      estimatedCost: result.estimatedCost,
      resultSummary: 'Simulation saved locally — not executed.',
      failureSummary: null,
      createdAt: now,
      updatedAt: now,
      startedAt: '—',
      completedAt: '—',
      stages: [
        { stage: 'receive', state: 'current' },
        { stage: 'classify', state: 'pending' },
        { stage: 'identify_site', state: 'pending' },
        { stage: 'assess_risk', state: 'pending' },
        { stage: 'select_agent', state: 'pending' },
        { stage: 'plan', state: 'pending' },
        { stage: 'check_permissions', state: 'pending' },
        { stage: 'approval_gate', state: 'pending' },
        { stage: 'execute', state: 'pending' },
        { stage: 'verify', state: 'pending' },
        { stage: 'uat', state: 'pending' },
        { stage: 'audit', state: 'pending' },
        { stage: 'complete', state: 'pending' },
      ],
      classification: {
        requestSummary: form.description || form.title || 'Simulated request',
        trigger: 'manual',
        detectedIntent: 'Routing simulation',
        detectedSite: result.detectedSite,
        confidence: '—',
        taskType: 'other',
        priority: (form.priority as AiOrchestration['priority']) || 'normal',
        risk: (form.risk as AiOrchestration['risk']) || 'low',
        environment: (form.environment as AiOrchestration['environment']) || 'production',
      },
      siteResolution: {
        selectedSite: result.detectedSite,
        confidence: '—',
        alternatives: [],
        operationalStatus: 'healthy',
        aiStatus: 'active',
        capabilityMatch: 'Simulated',
      },
      agentSelection: {
        name: result.recommendedAgentName,
        scope: 'Group-wide',
        category: 'other',
        status: 'active',
        health: 'healthy',
        autonomy: 'limited_automatic',
        workload: '—',
        queue: 0,
        capabilityMatch: '—',
        permissionMatch: '—',
        tools: result.tools,
        selectionScore: 0,
        selectionReason: 'Simulated recommendation',
      },
      candidates: result.candidates,
      plan: [],
      workflow: [],
      permissionGate: [
        { name: 'Agent enabled', state: 'not_required', note: 'Simulation' },
        { name: 'Site assignment valid', state: 'not_required', note: 'Simulation' },
        { name: 'Environment allowed', state: 'not_required', note: 'Simulation' },
        { name: 'Data permission', state: 'not_required', note: 'Simulation' },
        { name: 'Tool permission', state: 'not_required', note: 'Simulation' },
        { name: 'Action permission', state: 'not_required', note: 'Simulation' },
        { name: 'Risk / autonomy compatible', state: 'not_required', note: 'Simulation' },
        { name: 'Approval satisfied', state: 'not_required', note: 'Simulation' },
        { name: 'Audit enabled', state: 'not_required', note: 'Simulation' },
      ],
      riskAssessment: {
        overallRisk: (form.risk as AiOrchestration['risk']) || 'low',
        riskClass: 'green',
        dataImpact: 'Simulated',
        customerImpact: 'None',
        financialImpact: 'None',
        securityImpact: 'None',
        complianceImpact: 'None',
        reversibility: 'Not applicable',
        approvalRequired: result.approvalRequired,
      },
      approvalGate: {
        approvalId: null,
        status: 'draft',
        risk: (form.risk as AiOrchestration['risk']) || 'low',
        requiredTeam: '—',
        minApprovers: 0,
        currentApprovals: 0,
        expiry: '—',
        blocking: false,
      },
      capacity: {
        primaryAgent: result.recommendedAgentName,
        capacity: 'available',
        activeTasks: 0,
        queue: 0,
        availability: '—',
        fallbackAgent: '—',
        fallbackReason: '—',
        estimatedWait: '—',
      },
      failureStrategy: { policy: 'retry same agent', failedStep: '—', retryCount: 0, fallback: '—', nextAction: 'None' },
      tools: [],
      verification: { required: false, agent: '—', checks: '—', expectedOutcome: '—', evidence: '—' },
      uat: { required: false, agent: '—', testRef: '—', tests: 0, requiredPassState: '—', status: 'Not required' },
      audit: { required: false, runRefs: [], approvalRef: '—', evidenceRequired: '—', completionRequired: false },
      events: [
        { timestamp: now, event: 'Simulation saved', actor: 'Orchestrator', summary: 'Routing simulation saved locally (not executed).' },
      ],
    };
    setOrchestrations((prev) => [record, ...prev]);
    return record;
  };

  const value = useMemo(() => ({ orchestrations, addSimulation }), [orchestrations]);

  return <OrchestratorContext.Provider value={value}>{children}</OrchestratorContext.Provider>;
}

export function useOrchestrator(): OrchestratorContextValue {
  const ctx = useContext(OrchestratorContext);
  if (!ctx) throw new Error('useOrchestrator must be used within OrchestratorProvider');
  return ctx;
}