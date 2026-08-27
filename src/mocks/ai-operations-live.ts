// ============================================================================
// AI OPERATIONS — LIVE OPERATIONS / MISSION CONTROL — DEMO DATA (NOT PRODUCTION).
//
// ⚠️  Every value below is static placeholder data used to render the Live
//     Operations screen. No live subscription, polling, model call, n8n
//     workflow or production write occurs. Activity events, alerts and model
//     provider health are operational summaries only — no credentials, keys,
//     tokens or raw logs are stored here.
//
//     Later prompts will replace these with real operational feeds and a
//     dedicated wallboard route.
// ============================================================================

// Chronological operational activity feed (most recent first).
export const demoLiveActivityEvents = [
  { id: 'evt-01', timestamp: '10:45:31', site: 'The Forge', sourceType: 'run', actor: 'Testing Agent', event: 'Release validation failed — 3 cases failing', status: 'failed', severity: 'critical', referenceType: 'run', referenceId: 'RUN-7F11B' },
  { id: 'evt-02', timestamp: '10:44:02', site: 'GuardianHub', sourceType: 'approval', actor: 'Support Agent', event: 'Repair approved by Group AI Operations', status: 'approved', severity: 'medium', referenceType: 'approval', referenceId: 'APR-4409' },
  { id: 'evt-03', timestamp: '10:42:18', site: 'QuickGuard', sourceType: 'agent', actor: 'Guard Matching Agent', event: 'Scoring candidate guards for open shift', status: 'working', severity: 'low', referenceType: 'run', referenceId: 'RUN-8F21A' },
  { id: 'evt-04', timestamp: '10:41:05', site: 'GuardianHub', sourceType: 'agent', actor: 'Diagnostics Agent', event: 'Tracing check-call latency request path', status: 'working', severity: 'medium', referenceType: 'run', referenceId: 'RUN-3C9B7' },
  { id: 'evt-05', timestamp: '10:40:12', site: 'GuardianHub', sourceType: 'monitoring', actor: 'Monitoring Agent', event: 'Welfare check-call latency threshold breached', status: 'alert', severity: 'high', referenceType: 'site', referenceId: 'guardianhub' },
  { id: 'evt-06', timestamp: '10:39:51', site: 'Digital Footprint', sourceType: 'agent', actor: 'Lead Qualification Agent', event: 'New business enquiry enriched and scored', status: 'success', severity: 'low', referenceType: 'run', referenceId: 'RUN-71D2E' },
  { id: 'evt-07', timestamp: '10:38:22', site: 'The Forge', sourceType: 'uat', actor: 'UAT Agent', event: 'Release validation test cycle started', status: 'running', severity: 'medium', referenceType: 'run', referenceId: 'RUN-7F11B' },
  { id: 'evt-08', timestamp: '10:36:47', site: 'GuardianHub', sourceType: 'run', actor: 'Check-Call Agent', event: 'Check-call batch failed — 2 records', status: 'failed', severity: 'high', referenceType: 'run', referenceId: 'RUN-5D88F' },
  { id: 'evt-09', timestamp: '10:35:02', site: 'QuickGuard', sourceType: 'run', actor: 'Guard Matching Agent', event: 'Shift matching run started', status: 'working', severity: 'low', referenceType: 'run', referenceId: 'RUN-8F21A' },
  { id: 'evt-10', timestamp: '10:33:00', site: 'Group-wide', sourceType: 'agent', actor: 'Security Agent', event: 'Group auth anomaly scan in progress', status: 'working', severity: 'high', referenceType: 'agent', referenceId: 'core-security' },
  { id: 'evt-11', timestamp: '10:30:14', site: 'Wedora', sourceType: 'monitoring', actor: 'Monitoring Agent', event: 'Duplicate invitation flag raised', status: 'alert', severity: 'low', referenceType: 'site', referenceId: 'wedora' },
  { id: 'evt-12', timestamp: '10:28:00', site: 'LetHub', sourceType: 'approval', actor: 'Rent Agent', event: 'Rent arrears recovery approval requested', status: 'pending', severity: 'medium', referenceType: 'approval', referenceId: 'APR-4510' },
  { id: 'evt-13', timestamp: '10:25:24', site: 'Wedora', sourceType: 'run', actor: 'RSVP Agent', event: 'RSVP batch retry scheduled (DB lock)', status: 'retry', severity: 'low', referenceType: 'run', referenceId: 'RUN-4C77E' },
  { id: 'evt-14', timestamp: '10:22:00', site: 'Group-wide', sourceType: 'system', actor: 'Orchestrator', event: 'Daily routing policy refresh completed', status: 'success', severity: 'info', referenceType: null, referenceId: null },
  { id: 'evt-15', timestamp: '10:20:00', site: 'Digital Footprint', sourceType: 'site', actor: 'Site Registry Agent', event: 'Site metadata sync completed', status: 'success', severity: 'info', referenceType: 'site', referenceId: 'digital-footprint' },
  { id: 'evt-16', timestamp: '10:17:30', site: 'The Forge', sourceType: 'run', actor: 'Code Agent', event: 'Feature page generation failed validation', status: 'failed', severity: 'high', referenceType: 'run', referenceId: 'RUN-8D22F' },
  { id: 'evt-17', timestamp: '10:12:00', site: 'The Forge', sourceType: 'approval', actor: 'Publishing Agent', event: 'Production publish approval requested (critical)', status: 'pending', severity: 'critical', referenceType: 'approval', referenceId: 'APR-4500' },
  { id: 'evt-18', timestamp: '10:08:00', site: 'GuardianHub', sourceType: 'system', actor: 'Orchestrator', event: 'Multi-agent support incident run closed', status: 'success', severity: 'info', referenceType: 'run', referenceId: 'RUN-A1000' },
];

// Active operational alerts (reference real central records where possible).
export const demoOperationsAlerts = [
  { id: 'ALT-1001', site: 'the-forge', siteName: 'The Forge', source: 'Testing Agent', message: 'Release validation failed on latest build — 3 test cases failing.', severity: 'critical', detectedAt: '09:17', state: 'Open', recommendedAction: 'Investigate failing test cases before release.', referenceType: 'run', referenceId: 'RUN-7F11B' },
  { id: 'ALT-1002', site: 'guardianhub', siteName: 'GuardianHub', source: 'Monitoring Agent', message: 'Welfare check-call latency elevated.', severity: 'high', detectedAt: '10:40', state: 'Investigating', recommendedAction: 'Diagnostics agent is tracing the request path.', referenceType: 'run', referenceId: 'RUN-3C9B7' },
  { id: 'ALT-1003', site: 'guardianhub', siteName: 'GuardianHub', source: 'Check-Call Agent', message: 'Notification service returned 503 during check-call batch.', severity: 'high', detectedAt: '10:28', state: 'Retry scheduled', recommendedAction: 'Retry failed send batch.', referenceType: 'run', referenceId: 'RUN-5D88F' },
  { id: 'ALT-1004', site: 'the-forge', siteName: 'The Forge', source: 'Code Agent', message: 'Model output failed schema validation during page generation.', severity: 'high', detectedAt: '10:17', state: 'Retry scheduled', recommendedAction: 'Retry with stricter prompt.', referenceType: 'run', referenceId: 'RUN-8D22F' },
  { id: 'ALT-1005', site: 'the-forge', siteName: 'The Forge', source: 'Forge Master Agent', message: 'n8n connection degraded — build pipeline throttled.', severity: 'high', detectedAt: '11:00', state: 'Open', recommendedAction: 'Verify n8n workflow connectivity.', referenceType: 'site', referenceId: 'the-forge' },
  { id: 'ALT-1006', site: 'group', siteName: 'Group-wide', source: 'Monitoring Agent', message: 'One AI model provider reporting elevated latency.', severity: 'medium', detectedAt: '10:50', state: 'Watching', recommendedAction: 'Monitor provider response times.', referenceType: null, referenceId: null },
  { id: 'ALT-1007', site: 'wedora', siteName: 'Wedora', source: 'Seating Agent', message: 'Duplicate invitation flag detected.', severity: 'low', detectedAt: '10:31', state: 'Open', recommendedAction: 'Review duplicate invitations.', referenceType: 'site', referenceId: 'wedora' },
];

// AI model provider health (metadata only — no keys).
export const demoProviderHealth = [
  { provider: 'Anthropic', status: 'operational', activeRequests: 38, failedRequests: 0, avgResponseTime: '1.2s', estimatedCostToday: '£6.10', lastActivity: '1m ago' },
  { provider: 'OpenAI', status: 'operational', activeRequests: 21, failedRequests: 1, avgResponseTime: '1.4s', estimatedCostToday: '£4.32', lastActivity: '1m ago' },
  { provider: 'Google Gemini', status: 'degraded', activeRequests: 6, failedRequests: 2, avgResponseTime: '2.8s', estimatedCostToday: '£1.02', lastActivity: '4m ago' },
  { provider: 'Azure OpenAI', status: 'operational', activeRequests: 9, failedRequests: 0, avgResponseTime: '1.6s', estimatedCostToday: '£0.88', lastActivity: '2m ago' },
  { provider: 'Mistral', status: 'unknown', activeRequests: 0, failedRequests: 0, avgResponseTime: '—', estimatedCostToday: '£0.00', lastActivity: '1h ago' },
];

// In-progress multi-agent workflow chain (derived demo; highlights active node).
export const demoActiveWorkflowChain = [
  { agent: 'Support Agent', status: 'success', runId: 'RUN-A1001', duration: '41s', outcome: 'Ticket triaged' },
  { agent: 'Diagnostics Agent', status: 'running', runId: 'RUN-3C9B7', duration: '4m 05s', outcome: 'Tracing request path' },
  { agent: 'Data Health Agent', status: 'queued', runId: '—', duration: '—', outcome: 'Pending integrity check' },
  { agent: 'Repair Recommendation Agent', status: 'queued', runId: '—', duration: '—', outcome: 'Pending recommendation' },
  { agent: 'Human Approval', status: 'queued', runId: '—', duration: '—', outcome: 'Awaiting approval' },
  { agent: 'UAT Agent', status: 'queued', runId: '—', duration: '—', outcome: 'Pending UAT' },
];