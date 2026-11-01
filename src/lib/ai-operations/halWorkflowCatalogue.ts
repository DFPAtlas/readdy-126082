import { resolveHalWorkflowMapping, type WorkflowMappingContext } from './halWorkflowMapping.ts';

// Observed workflow identities supplied from HAL's authenticated API inventory on 2026-11-01.
// Display metadata only: these entries never register agents, approve dispatch or activate n8n.
export interface HalWorkflowCatalogueEntry {
  instance: string;
  workflowId: string;
  name: string;
  activeAtInventory: boolean;
  siteKey: string | null;
  scopeLabel: string | null;
}
export const HAL_WORKFLOW_INVENTORY_DATE = '2026-11-01';
export const HAL_WORKFLOW_CATALOGUE: readonly HalWorkflowCatalogueEntry[] = [
  {
    "instance": "hall-n8n",
    "workflowId": "2wtdCiZ55DLQrfQg",
    "name": "QuickGuard Dispute & Refund Agent v01",
    "activeAtInventory": true,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "6LMw86OKAGurTJv3",
    "name": "QuickGuard Job Monitoring Agent v01",
    "activeAtInventory": true,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "6Z7iS4QgyDNq44gX",
    "name": "Digital Footprint Lead Engine V16.3 Ollama Fetch FIXED",
    "activeAtInventory": false,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "6pPjYwzIzllLucOX",
    "name": "GuardianHub - Subscription Entitlement Agent",
    "activeAtInventory": false,
    "siteKey": "guardianhub",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "8FjrsNMGNP9UzxQ6",
    "name": "Atlas Tron Repo Status",
    "activeAtInventory": true,
    "siteKey": null,
    "scopeLabel": "Group infrastructure"
  },
  {
    "instance": "hall-n8n",
    "workflowId": "8M4HAkmigFxAH7ck",
    "name": "QuickGuard Review & Reputation Agent v01",
    "activeAtInventory": true,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "B2OoyuHKNR4UVzQX",
    "name": "Digital Footprint Lead Engine V16.4 Mobile Ollama FIXED",
    "activeAtInventory": false,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "Bzq8vZAM4W24vNQi",
    "name": "My workflow",
    "activeAtInventory": false,
    "siteKey": null,
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "Dgd8rf3KUSoxmVfi",
    "name": "QuickGuard Email & Notification Agent v01.2 - Safe Processor",
    "activeAtInventory": true,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "DnRFXly4JS7gi67v",
    "name": "QuickGuard Lead Finder V4 - Working",
    "activeAtInventory": false,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "FdzNPBcdddWKCP2W",
    "name": "QuickGuard Job Intake Agent v01.1 - Legacy Isolation",
    "activeAtInventory": true,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "GumNKeYLQfSufTII",
    "name": "DFP Runtime Sandbox Ping",
    "activeAtInventory": true,
    "siteKey": null,
    "scopeLabel": "Group infrastructure"
  },
  {
    "instance": "hall-n8n",
    "workflowId": "Gx3SKlsHbWCeM2xa",
    "name": "Atlas Tron AI Agent",
    "activeAtInventory": true,
    "siteKey": null,
    "scopeLabel": "Group infrastructure"
  },
  {
    "instance": "hall-n8n",
    "workflowId": "HkKkrBniZ8R5g3q3",
    "name": "QuickGuard Client Selection Agent v01",
    "activeAtInventory": true,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "K5o1yWnaYKJ7TNzW",
    "name": "QuickGuard Guard Discovery Agent v01",
    "activeAtInventory": true,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "KJhJK6fPF7wl5QpU",
    "name": "Digital Footprint Lead Engine V16.4 Mobile Ollama FIXED",
    "activeAtInventory": false,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "Mz39wYS4Fewhyvs0",
    "name": "QuickGuard Diagnostics & Recovery Agent v01",
    "activeAtInventory": true,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "NhDw61DE6HE4nwPa",
    "name": "QuickGuard Agent 20 - Social Media Content Agent",
    "activeAtInventory": false,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "PRQFpqBmfTZzcBa3",
    "name": "LetHub Autonomous Manager 01 V2 CLEAN — Master & Specialist Agents",
    "activeAtInventory": true,
    "siteKey": "lethub",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "Rj9xUvR0IUBAcoNW",
    "name": "Digital Footprint Lead Engine V16.4 Mobile Ollama FIXED",
    "activeAtInventory": false,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "SE3V5Pypmbq20gxF",
    "name": "QuickGuard Completion Agent v01",
    "activeAtInventory": true,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "TG4JyKI67D1Fro4b",
    "name": "QuickGuard Payout Agent v01",
    "activeAtInventory": true,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "XVGzFKlRodUb6Gxb",
    "name": "Digital Footprint Lead Engine V16.4 Mobile Ollama FIXED",
    "activeAtInventory": true,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "Z8KPTUZmKxnaAga8",
    "name": "GuardianHub - 10 Agent Hub Workflow",
    "activeAtInventory": false,
    "siteKey": "guardianhub",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "ZGW3R2dPAvSdWlR7",
    "name": "QuickGuard Lead Finder Agent - Internet Scan to Supabase",
    "activeAtInventory": false,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "aBj0Oc0NBWlzYCuh",
    "name": "QuickGuard Job Funding Agent v01",
    "activeAtInventory": true,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "adtv1EnDe1eblBED",
    "name": "QuickGuard SIA Verification Agent v01.1 - Legacy Flow Suppression",
    "activeAtInventory": true,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "cr3uryti331klEC1",
    "name": "GuardianHub Lead Finder Agent V2 - Local SearXNG",
    "activeAtInventory": false,
    "siteKey": "guardianhub",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "fooVG3xGJ4g9h1s8",
    "name": "QuickGuard Agent 15 - Admin Daily Report",
    "activeAtInventory": false,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "gVzg1ayLiJ32Kxjf",
    "name": "Adminstration",
    "activeAtInventory": false,
    "siteKey": null,
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "hd2rIh2umh83tydj",
    "name": "QuickGuard Master Agent v01.2 - Legacy Detection Fix",
    "activeAtInventory": true,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "jFiHQVazSZv8PQhG",
    "name": "QuickGuard Master Agent v01 - Merge Fix",
    "activeAtInventory": false,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "jyf05cKZtQ3WVtJJ",
    "name": "Atlas Tron RAG Search",
    "activeAtInventory": true,
    "siteKey": null,
    "scopeLabel": "Group infrastructure"
  },
  {
    "instance": "hall-n8n",
    "workflowId": "kxPatqahjmz41MRw",
    "name": "Google Search Lead Agent - Digital Footprint",
    "activeAtInventory": true,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "m0Dy7EjdN6U1QOKJ",
    "name": "Local Audit Preflight",
    "activeAtInventory": true,
    "siteKey": null,
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "nGh3qUcPqry78wm3",
    "name": "QuickGuard Job Matching Agent - Real Schema",
    "activeAtInventory": false,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "p9Ah22TyaCJxR8q0",
    "name": "QuickGuard Applicant Ranking Agent v01",
    "activeAtInventory": true,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "pGoacDSUO4i4dNMN",
    "name": "QuickGuard Subscription Agent v01.1 - Plan + Stripe Sync Fix",
    "activeAtInventory": true,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "q99oUq6bHHzsDBjW",
    "name": "Digital Footprint Lead Engine V16.5 Robust Leads",
    "activeAtInventory": false,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "wBcwPwhoTMYIIEVS",
    "name": "QuickGuard Agent Registry & Heartbeat Bootstrap v01",
    "activeAtInventory": false,
    "siteKey": "quickguard",
    "scopeLabel": null
  },
  {
    "instance": "hall-n8n",
    "workflowId": "yZLj21MnXkubIB2W",
    "name": "LetHub Autonomous Manager 01 V2 — Master & Specialist Agents",
    "activeAtInventory": false,
    "siteKey": "lethub",
    "scopeLabel": null
  },
  {
    "instance": "leadgen_n8n",
    "workflowId": "CX5Bx5r0gX62eIuu",
    "name": "DFP Support - AI Ticket Triage (Ollama)",
    "activeAtInventory": true,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "leadgen_n8n",
    "workflowId": "G390SedsKXS24uoU",
    "name": "DFP Email Scanner - 01 Discovery (Direct Postgres)",
    "activeAtInventory": false,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "leadgen_n8n",
    "workflowId": "HdgVX4dE348WHFi1",
    "name": "DFP Lead Gen - Service Business Discovery",
    "activeAtInventory": false,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "leadgen_n8n",
    "workflowId": "N1xMJMQLZtt3gUBZ",
    "name": "DFP Support - Diagnostics Agent",
    "activeAtInventory": true,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "leadgen_n8n",
    "workflowId": "NelDFklpSgRsS7Mc",
    "name": "DFP Runtime Sandbox Ping",
    "activeAtInventory": true,
    "siteKey": null,
    "scopeLabel": "Group infrastructure"
  },
  {
    "instance": "leadgen_n8n",
    "workflowId": "YL6XFzsNo2c8kB5T",
    "name": "DFP Email Scanner - 01 Discovery",
    "activeAtInventory": false,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "leadgen_n8n",
    "workflowId": "YYKgfhIzNZy2gcqG",
    "name": "DFP Support - Repair Executor SAFE",
    "activeAtInventory": true,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "leadgen_n8n",
    "workflowId": "YsO43l98gweJGdpV",
    "name": "DFP Email Scanner - 03 Approve Selected Contacts",
    "activeAtInventory": false,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "leadgen_n8n",
    "workflowId": "bFmKYCeCja2UyXux",
    "name": "DFP Email Scanner - 02 Review Pending Contacts",
    "activeAtInventory": false,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "leadgen_n8n",
    "workflowId": "bSe8NHr3zxJgxuuH",
    "name": "DFP Support - AI Reply Assistant (Ollama)",
    "activeAtInventory": true,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "leadgen_n8n",
    "workflowId": "f2bT3bj7qKAV5SCf",
    "name": "DFP LeadGen - Discovery Agent v2 (Direct Postgres)",
    "activeAtInventory": false,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "leadgen_n8n",
    "workflowId": "fwDyEaL1mfgI2nya",
    "name": "DFP Email Scanner - 06 Create Resend Draft (Environment Key)",
    "activeAtInventory": false,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "leadgen_n8n",
    "workflowId": "l6fHq1YQywAYnM1a",
    "name": "DFP Support - AI Reply Assistant (Ollama)",
    "activeAtInventory": false,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "leadgen_n8n",
    "workflowId": "mcKMeXZ6nRRM5Vxl",
    "name": "DFP Email Scanner - 04 Stage Campaign for Approval",
    "activeAtInventory": false,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "leadgen_n8n",
    "workflowId": "oGE0jpEiQ7hNbOgI",
    "name": "DFP Support - Repair Executor SAFE SHELL",
    "activeAtInventory": false,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "leadgen_n8n",
    "workflowId": "pZR7b2jtD987juXL",
    "name": "DFP Email Scanner - 05 Approve Campaign Batch",
    "activeAtInventory": false,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "leadgen_n8n",
    "workflowId": "r8nBconE6M4CvVvr",
    "name": "DFP Email Scanner - 06 Create Resend Broadcast Draft",
    "activeAtInventory": false,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  },
  {
    "instance": "leadgen_n8n",
    "workflowId": "xa66PMtEpabHfjg4",
    "name": "DFP Lead Gen - Service Business Discovery",
    "activeAtInventory": true,
    "siteKey": "digital-footprint",
    "scopeLabel": null
  }
];

export function resolveHalRunIdentity(instance: string, workflowId: string, registryWorkflowKey: string | null | undefined,
  context: WorkflowMappingContext, catalogue: readonly HalWorkflowCatalogueEntry[] = HAL_WORKFLOW_CATALOGUE) {
  const registered = resolveHalWorkflowMapping(workflowId, registryWorkflowKey, context);
  const base = { ...registered, catalogueMatched: false, scopeLabel: null as string | null,
    observedOn: null as string | null, workflowActiveAtInventory: null as boolean | null };
  // Explicit configured registry relationships always win, including conflicts/failures.
  if (registryWorkflowKey || context.environment !== 'production') return base;
  const matches = catalogue.filter(entry => entry.instance === instance && entry.workflowId === workflowId);
  if (matches.length !== 1) return base;
  const entry = matches[0];
  const sites = context.available && entry.siteKey
    ? context.sites.filter(site => site.site_key === entry.siteKey && site.environment === 'production' && site.is_active)
    : [];
  return { ...base, title: entry.name, siteName: sites.length === 1 ? sites[0].name : null,
    catalogueMatched: true, scopeLabel: entry.scopeLabel, observedOn: HAL_WORKFLOW_INVENTORY_DATE,
    workflowActiveAtInventory: entry.activeAtInventory,
    label: 'CATALOGUE · 01 NOV' + (entry.siteKey && sites.length !== 1 ? ' · SITE UNRESOLVED' : '') };
}
