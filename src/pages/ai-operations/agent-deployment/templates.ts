// ============================================================================
// DFP AI Operations — Agent Deployment templates (Prompt 03).
//
// A "Blank" template is available for any site. For LetHub only, a set of
// optional draft templates is offered. Templates are DRAFT DEFINITIONS ONLY:
// selecting one pre-fills the wizard and creates NOTHING until the operator
// explicitly saves. None of the 12 are auto-created or activated.
// ============================================================================

import type { DeploymentTemplate } from '@/pages/ai-operations/agent-deployment/types';

export const LETHUB_SITE_KEY = 'lethub';

export const BLANK_TEMPLATE_KEY = 'blank';

export const BLANK_TEMPLATE: DeploymentTemplate = {
  key: BLANK_TEMPLATE_KEY,
  label: 'Blank Agent',
  role: 'sub_agent',
  category: 'monitoring',
  name: '',
  responsibility: '',
  description: 'Start from scratch — choose role, site, category and every field yourself.',
};

// LetHub draft templates (role defaults to sub-agent; a manager can be chosen
// per template below). These are definitions only — never auto-created.
export const LETHUB_TEMPLATES: DeploymentTemplate[] = [
  {
    key: 'lethub-platform-health',
    label: 'Platform Health',
    role: 'sub_agent',
    category: 'monitoring',
    name: 'Platform Health Agent',
    responsibility: 'Continuously assess LetHub platform availability and surface degradations.',
    description: 'Monitors core platform health, uptime and service-level signals for LetHub.',
  },
  {
    key: 'lethub-agent-watchdog',
    label: 'Agent Watchdog',
    role: 'sub_agent',
    category: 'monitoring',
    name: 'Agent Watchdog Agent',
    responsibility: 'Watch other LetHub agents for stalls, failures and silent errors.',
    description: 'Supervises sibling agents, flagging stalls, repeated failures and drift.',
  },
  {
    key: 'lethub-compliance-monitor',
    label: 'Compliance Monitor',
    role: 'sub_agent',
    category: 'compliance',
    name: 'Compliance Monitor Agent',
    responsibility: 'Track tenancy compliance obligations, certificates and renewals.',
    description: 'Monitors regulatory and tenancy compliance deadlines for LetHub.',
  },
  {
    key: 'lethub-maintenance-coordinator',
    label: 'Maintenance Coordinator',
    role: 'sub_agent',
    category: 'operations',
    name: 'Maintenance Coordinator Agent',
    responsibility: 'Coordinate maintenance jobs, contractors and follow-ups.',
    description: 'Triages and coordinates maintenance requests and contractor follow-ups.',
  },
  {
    key: 'lethub-rent-arrears',
    label: 'Rent & Arrears Monitor',
    role: 'sub_agent',
    category: 'billing',
    name: 'Rent & Arrears Monitor Agent',
    responsibility: 'Monitor rent collection, arrears and payment exceptions.',
    description: 'Tracks rent ledger, arrears and payment exceptions for LetHub.',
  },
  {
    key: 'lethub-subscription-monitor',
    label: 'Subscription Monitor',
    role: 'sub_agent',
    category: 'billing',
    name: 'Subscription Monitor Agent',
    responsibility: 'Monitor plan subscriptions, renewals and failed payments.',
    description: 'Tracks subscription renewals and failed payment events for LetHub.',
  },
  {
    key: 'lethub-communications-monitor',
    label: 'Communications Monitor',
    role: 'sub_agent',
    category: 'communications',
    name: 'Communications Monitor Agent',
    responsibility: 'Monitor outgoing communications, delivery and reply health.',
    description: 'Tracks messaging delivery, reply health and communication exceptions.',
  },
  {
    key: 'lethub-onboarding-portal',
    label: 'Onboarding & Portal Access',
    role: 'sub_agent',
    category: 'support',
    name: 'Onboarding & Portal Access Agent',
    responsibility: 'Assist tenant and portal onboarding and access provisioning.',
    description: 'Coordinates tenant onboarding and portal access provisioning for LetHub.',
  },
  {
    key: 'lethub-inspection-coordinator',
    label: 'Inspection Coordinator',
    role: 'sub_agent',
    category: 'operations',
    name: 'Inspection Coordinator Agent',
    responsibility: 'Coordinate inspections, scheduling and evidence collection.',
    description: 'Schedules and coordinates property inspections and evidence collection.',
  },
  {
    key: 'lethub-document-signature',
    label: 'Document & Signature Monitor',
    role: 'sub_agent',
    category: 'compliance',
    name: 'Document & Signature Monitor Agent',
    responsibility: 'Monitor documents, signatures and contract completeness.',
    description: 'Tracks document completion and e-signature status for LetHub.',
  },
  {
    key: 'lethub-contractor-quote',
    label: 'Contractor & Quote Coordinator',
    role: 'sub_agent',
    category: 'operations',
    name: 'Contractor & Quote Coordinator Agent',
    responsibility: 'Coordinate contractor quotes, comparisons and approvals.',
    description: 'Coordinates contractor quotes, comparisons and approval requests.',
  },
  {
    key: 'lethub-data-integrity',
    label: 'Data Integrity & Reporting',
    role: 'sub_agent',
    category: 'data',
    name: 'Data Integrity & Reporting Agent',
    responsibility: 'Monitor data quality, integrity and scheduled reporting.',
    description: 'Monitors data quality and produces integrity and reporting signals.',
  },
];

/** Templates offered for a chosen site. Blank is always available; the LetHub
 *  set is offered only when the selected site is LetHub (never for other sites). */
export function templatesForSite(siteKey: string | null): DeploymentTemplate[] {
  if (siteKey === LETHUB_SITE_KEY) {
    return [BLANK_TEMPLATE, ...LETHUB_TEMPLATES];
  }
  return [BLANK_TEMPLATE];
}