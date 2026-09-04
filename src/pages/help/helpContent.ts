// ============================================================================
// DFP Command Help Centre — typed, local help content (Help Centre 01).
//
// All content is stored here (not in a Supabase table) for this first version.
// No passwords, secrets, MFA codes or personal customer data are included.
// ============================================================================

import type { Permission } from '@/lib/permissions';

export type HelpCategoryId =
  | 'start-here'
  | 'projects-delivery'
  | 'support-operations'
  | 'website-uat'
  | 'ai-operations'
  | 'security-access';

export interface HelpCategory {
  id: HelpCategoryId;
  label: string;
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: 'start-here', label: 'Start Here' },
  { id: 'projects-delivery', label: 'Projects & Delivery' },
  { id: 'support-operations', label: 'Support Operations' },
  { id: 'website-uat', label: 'Website UAT' },
  { id: 'ai-operations', label: 'AI Operations' },
  { id: 'security-access', label: 'Security & Access' },
];

export interface HelpStep {
  action: string;
  expected: string;
}

export interface HelpArticle {
  id: string;
  title: string;
  summary: string;
  keywords: string[];
  steps?: HelpStep[];
  points?: string[];
  roleTable?: boolean;
  note?: string;
  warning?: string;
  relatedLinks?: { label: string; route: string }[];
  commonMistakes?: string[];
  safetyRules?: string[];
}

export const ARTICLES: HelpArticle[] = [
  {
    id: 'getting-access',
    title: 'Getting access to DFP Command',
    summary: 'How new staff members are invited and gain access to DFP Command.',
    keywords: ['invite', 'access', 'sign in', 'email', 'invitation', 'role', 'no access', 'onboarding', 'administrator'],
    steps: [
      {
        action: 'Receive an invitation from an Owner or authorised administrator.',
        expected: 'DFP Command is invite-only — you cannot self-register.',
      },
      {
        action: 'Open DFP Command and sign in with the email address that was invited.',
        expected: 'The system recognises your email and loads your assigned internal role.',
      },
      {
        action: 'Complete multi-factor authentication (MFA) setup on your first sign-in.',
        expected: 'Your account is verified and you reach the dashboard.',
      },
      {
        action: 'If you see the "No access" screen, contact your administrator.',
        expected: 'A user without an active internal role is denied access until an invitation or role is issued.',
      },
    ],
    warning:
      'DFP Command is invite-only. If your invitation or role is missing, contact your administrator. Do not attempt to sign in with a different account to bypass access.',
  },
  {
    id: 'setting-up-mfa',
    title: 'Setting up two-factor authentication',
    summary: 'How mandatory two-factor authentication (MFA) works for DFP Command staff.',
    keywords: ['mfa', 'two-factor', '2fa', 'authenticator', 'qr code', 'six-digit', 'code', 'security', 'setup'],
    steps: [
      {
        action: 'On first sign-in, you are redirected to the MFA setup page.',
        expected: 'MFA is mandatory — you cannot skip this step.',
      },
      {
        action: 'Open your authenticator app and scan the QR code.',
        expected: 'Your DFP Command account is linked to the authenticator app.',
      },
      {
        action: 'Enter the current six-digit code shown in your authenticator app.',
        expected: 'The code is validated against your account.',
      },
      {
        action: 'After verification, you are taken to the dashboard.',
        expected: 'Your MFA setup is complete.',
      },
      {
        action: 'On later sign-ins, enter a fresh authenticator code when prompted.',
        expected: 'A new code is required each time — codes are single-use and time-limited.',
      },
    ],
    warning:
      'Never share your MFA code or secret key with anyone, including staff or support. Legitimate DFP Command prompts will never ask you to reveal them.',
  },
  {
    id: 'navigating',
    title: 'Navigating DFP Command',
    summary: 'How to move around DFP Command and find the main modules.',
    keywords: ['navigate', 'sidebar', 'menu', 'collapse', 'mobile', 'dashboard', 'search', 'ctrl', 'command', 'k', 'role badge', 'sign out'],
    steps: [
      {
        action: 'Use the left sidebar to open the main modules.',
        expected: 'The sidebar lists Dashboard, Projects, Support, AI Operations and more.',
      },
      {
        action: 'Collapse or expand the sidebar on desktop using the toggle.',
        expected: 'Collapsed mode shows icons only, saving space.',
      },
      {
        action: 'On mobile, tap the menu button to open the sidebar.',
        expected: 'The sidebar slides in over the content.',
      },
      {
        action: 'Look for the highlighted item to confirm where you are.',
        expected: 'The active page is highlighted in the sidebar.',
      },
      {
        action: 'Start from the Dashboard.',
        expected: 'Dashboard shows group overview, recent activity, critical bugs and budget warnings.',
      },
      {
        action: 'Open AI Operations global search with Ctrl/Cmd + K.',
        expected: 'Search across AI registries — sites, agents, runs, models and more.',
      },
      {
        action: 'Check your role badge in the sidebar footer.',
        expected: 'The badge shows your current access level.',
      },
      {
        action: 'Use Sign out to safely end the session.',
        expected: 'Your session is cleared and you return to the sign-in page.',
      },
    ],
  },
  {
    id: 'understanding-role',
    title: 'Understanding your role',
    summary: 'What each DFP Command role permits and how restrictions are applied.',
    keywords: ['role', 'permission', 'owner', 'admin', 'support manager', 'support agent', 'developer', 'viewer', 'access level', 'restricted'],
    roleTable: true,
    note:
      'Your role controls which buttons and administration pages are available. If an action is missing or marked Restricted, request access from an Owner or Admin rather than attempting to bypass the restriction.',
  },
  {
    id: 'working-safely',
    title: 'Working safely',
    summary: 'The safety rules every DFP Command staff member must follow.',
    keywords: ['safety', 'rules', 'repair', 'diagnose', 'approval', 'session', 'read-only', 'audit', 'secret', 'password', 'emergency freeze', 'internal note', 'customer reply'],
    points: [
      'Check the selected site, customer and ticket before making changes.',
      'Customer Reply and Internal Note are different actions.',
      'Internal notes must never be sent to the customer.',
      'Diagnostics should be reviewed before requesting a repair.',
      'Repairs follow Diagnose → Recommend → Human Approval → Secure Execution → Verify → Audit.',
      'Support sessions are read-only, time-limited and linked to a support reason.',
      'AI recommendations are not automatic permission to execute an action.',
      'Approval, verification and audit evidence must be preserved.',
      'Never paste passwords, API keys, service-role keys, MFA secrets or payment information into notes, tickets or AI prompts.',
      'Use the Emergency Freeze controls only under the defined operational procedure.',
    ],
    warning:
      'Safety rules are mandatory. Bypassing a restriction or mishandling customer data can cause serious operational and compliance issues.',
  },
];

// Role-table descriptions for the "Understanding your role" guide. These are
// help text only — the actual permission matrix remains in src/lib/permissions.ts.
export const ROLE_TABLE_DESCRIPTIONS: Record<string, string> = {
  owner: 'Full authority across staff, roles, tickets, diagnostics, repairs, sessions, integrations and audit.',
  admin: 'Manages operational features, staff and most LOW/MEDIUM approval actions, but cannot grant or replace the Owner role.',
  support_manager: 'Manages support queues, assignments, escalations, permitted repair approvals, sessions, knowledge and reporting.',
  support_agent: 'Works tickets, replies to customers, adds internal notes, runs AI triage, requests repairs and starts permitted read-only sessions.',
  developer: 'Reviews technical tickets and diagnostics, adds technical information and requests authorised repairs.',
  viewer: 'Read-only access to permitted support and operational information.',
};

export interface HelpModule {
  title: string;
  description: string;
  route: string;
  icon: string;
}

export interface HelpModuleGroup {
  id: HelpCategoryId;
  title: string;
  description?: string;
  modules: HelpModule[];
}

export const MODULE_GROUPS: HelpModuleGroup[] = [
  {
    id: 'projects-delivery',
    title: 'Projects & Delivery',
    modules: [
      { title: 'Dashboard', description: 'Group overview, recent activity, critical bugs, build actions, budget warnings and upcoming payments.', route: '/dashboard', icon: 'ri-dashboard-3-line' },
      { title: 'Projects', description: 'View active or archived projects and open each project workspace.', route: '/projects', icon: 'ri-folder-3-line' },
      { title: 'Ideas', description: 'Capture, search and organise potential products or improvements.', route: '/ideas', icon: 'ri-lightbulb-line' },
      { title: 'Change Requests', description: 'Record requested changes, priorities and delivery status.', route: '/change-requests', icon: 'ri-git-pull-request-line' },
      { title: 'Prompts', description: 'Store and find approved build, repair and development prompts.', route: '/prompts', icon: 'ri-terminal-box-line' },
      { title: 'Bugs', description: 'Record, prioritise and track defects.', route: '/bugs', icon: 'ri-bug-line' },
      { title: 'Notes', description: 'Maintain project notes, decisions and supporting information.', route: '/notes', icon: 'ri-sticky-note-line' },
      { title: 'Files & Links', description: 'Store project-related files, resources and reference links.', route: '/files-links', icon: 'ri-links-line' },
      { title: 'Roadmap', description: 'Organise delivery work by phase and status.', route: '/roadmap', icon: 'ri-road-map-line' },
      { title: 'Build Process', description: 'Use active checklists, the master template, reports and launch-readiness controls.', route: '/build-process', icon: 'ri-list-check-3' },
      { title: 'Project Budget', description: 'Review budgets, cost items, recurring costs, forecasts and reports.', route: '/project-budget', icon: 'ri-money-pound-circle-line' },
      { title: 'System Status', description: 'Review websites, Supabase, Edge Functions, agents, webhooks, logs, incidents and alerts.', route: '/system-status', icon: 'ri-pulse-line' },
      { title: 'Activity', description: 'Review recorded changes and operational history.', route: '/activity-log', icon: 'ri-history-line' },
      { title: 'GitHub', description: 'View the connected repository inventory and repository status information.', route: '/github', icon: 'ri-github-fill' },
    ],
  },
  {
    id: 'support-operations',
    title: 'Support Operations',
    modules: [
      { title: 'Support Tickets', description: 'Work ticket queues including My Tickets, Unassigned, Needs Review, Escalated, Urgent and SLA Risk.', route: '/support-tickets', icon: 'ri-ticket-2-line' },
      { title: 'Customers', description: 'Search for a customer and open their Customer 360 record.', route: '/customers', icon: 'ri-user-search-line' },
      { title: 'Support Repairs', description: 'Review pending, executing, failed and completed repair actions.', route: '/support-repairs', icon: 'ri-tools-line' },
      { title: 'Support Analytics', description: 'Review ticket volume, SLA and staff workload reporting.', route: '/support-tickets/reports', icon: 'ri-bar-chart-2-line' },
      { title: 'Team & Access', description: 'Manage staff members, roles, site access and invitations when authorised.', route: '/team', icon: 'ri-team-line' },
      { title: 'Support Teams', description: 'Manage support team membership and assigned sites.', route: '/support-teams', icon: 'ri-group-2-line' },
      { title: 'Routing Rules', description: 'Control how new support tickets are routed.', route: '/support-routing', icon: 'ri-git-branch-line' },
      { title: 'Knowledge Base', description: 'Create and review support articles and reusable resolutions.', route: '/support-knowledge', icon: 'ri-book-open-line' },
      { title: 'Support Integrations', description: 'Onboard connected websites and manage their support integration settings.', route: '/admin/support-integrations', icon: 'ri-plug-2-line' },
    ],
  },
  {
    id: 'website-uat',
    title: 'Website UAT',
    description: 'Tools for testing connected websites and preserving release evidence before approval.',
    modules: [
      { title: 'UAT Projects', description: 'Create and manage UAT projects for connected websites.', route: '/admin/website-uat?tab=register', icon: 'ri-global-line' },
      { title: 'Bug Reports', description: 'Review and triage bug reports raised during testing.', route: '/admin/website-uat?tab=changes', icon: 'ri-bug-line' },
      { title: 'Test Results', description: 'Review page-by-page test results and pass/fail status.', route: '/admin/website-uat?tab=page-review', icon: 'ri-file-check-line' },
      { title: 'Evidence', description: 'Capture and review screenshots and link-checker evidence.', route: '/admin/website-uat?tab=link-checker', icon: 'ri-camera-line' },
      { title: 'Sessions', description: 'Manage UAT tester sessions and image evidence.', route: '/admin/website-uat?tab=image-manager', icon: 'ri-timer-line' },
      { title: 'Test Runs', description: 'Create test runs and manage test cases, jobs and the tester marketplace.', route: '/admin/website-uat?tab=uat-runs', icon: 'ri-test-tube-line' },
      { title: 'Rewards', description: 'Review tester rewards and payout status.', route: '/admin/website-uat?tab=rewards', icon: 'ri-money-pound-circle-line' },
      { title: 'Defects', description: 'Review and resolve defects found during testing.', route: '/admin/website-uat?tab=defects', icon: 'ri-bug-2-line' },
      { title: 'Approvals', description: 'Review and approve UAT results before release.', route: '/admin/website-uat?tab=approval', icon: 'ri-shield-check-line' },
    ],
  },
  {
    id: 'ai-operations',
    title: 'AI Operations',
    description: 'Availability and actions depend on live connection state, permissions and approval gates. Features showing demo, fallback or planned data are not production-connected.',
    modules: [
      { title: 'AI Overview', description: 'High-level view of AI operations across the organisation.', route: '/ai-operations', icon: 'ri-robot-2-line' },
      { title: 'Live Operations', description: 'Real-time activity, agent workload and mission control.', route: '/ai-operations/live', icon: 'ri-radar-line' },
      { title: 'Wallboard', description: 'Operational wallboard with KPIs, active operations and system health.', route: '/ai-operations/wallboard', icon: 'ri-dashboard-2-line' },
      { title: 'Sites', description: 'Connected sites and their AI operation capabilities.', route: '/ai-operations/sites', icon: 'ri-pages-line' },
      { title: 'Agents', description: 'Configure and monitor AI agents and their tools.', route: '/ai-operations/agents', icon: 'ri-robot-line' },
      { title: 'Tasks & Runs', description: 'Review task execution and run history.', route: '/ai-operations/runs', icon: 'ri-play-list-line' },
      { title: 'Approvals', description: 'Review and act on pending approval requests.', route: '/ai-operations/approvals', icon: 'ri-check-double-line' },
      { title: 'Orchestrator', description: 'Manage multi-agent workflows and routing.', route: '/ai-operations/orchestrator', icon: 'ri-git-merge-line' },
      { title: 'Tools & Connections', description: 'Manage tool connections and agent access.', route: '/ai-operations/tools', icon: 'ri-plug-line' },
      { title: 'Models & AI Providers', description: 'Manage AI models, providers and routing policies.', route: '/ai-operations/models', icon: 'ri-cpu-line' },
      { title: 'Knowledge & Memory', description: 'Manage knowledge sources, memory and incident memory.', route: '/ai-operations/knowledge', icon: 'ri-brain-line' },
      { title: 'AI Security & Policy', description: 'Review security policies and policy decisions.', route: '/ai-operations/security', icon: 'ri-shield-keyhole-line' },
      { title: 'Alerts & Incidents', description: 'Manage alerts, incidents and escalation policies.', route: '/ai-operations/alerts', icon: 'ri-alert-line' },
      { title: 'Audit & Evidence', description: 'Review audit logs, evidence and compliance readiness.', route: '/ai-operations/audit', icon: 'ri-file-list-3-line' },
      { title: 'Costs & Budgets', description: 'Track AI usage costs and budget alerts.', route: '/ai-operations/costs', icon: 'ri-funds-line' },
      { title: 'Notifications & Escalations', description: 'Manage notification rules and escalation paths.', route: '/ai-operations/notifications', icon: 'ri-notification-3-line' },
      { title: 'Scheduling & Automation', description: 'Manage schedules, quiet hours and maintenance windows.', route: '/ai-operations/schedules', icon: 'ri-calendar-2-line' },
      { title: 'Production Readiness', description: 'Review readiness plans and go/no-go decisions.', route: '/ai-operations/readiness', icon: 'ri-rocket-2-line' },
      { title: 'Runtime Health', description: 'Monitor runtime connectivity and health checks.', route: '/ai-operations/runtime-health', icon: 'ri-heart-pulse-line' },
      { title: 'Runtime Controls', description: 'Manage runtime gates, safety panels and kill switches.', route: '/ai-operations/runtime-controls', icon: 'ri-settings-4-line' },
    ],
  },
  {
    id: 'security-access',
    title: 'Security & Access',
    description: 'Role-based access and safety controls. Role definitions and safety rules are covered in the Start Here guides.',
    modules: [
      { title: 'Security', description: 'Review platform security posture, access controls and audit configuration.', route: '/security', icon: 'ri-shield-keyhole-line' },
      { title: 'Team & Access', description: 'Manage staff members, roles, site access and invitations when authorised.', route: '/team', icon: 'ri-team-line' },
    ],
  },
];

// ============================================================================
// Help Centre 02 — Projects & Delivery content.
// ============================================================================

export interface JourneyStage {
  id: string;
  label: string;
  articleId: string;
  icon: string;
}

export const PROJECT_DELIVERY_JOURNEY: JourneyStage[] = [
  { id: 'stage-project', label: 'Create or select a project', articleId: 'delivery-project', icon: 'ri-folder-3-line' },
  { id: 'stage-idea', label: 'Capture the idea', articleId: 'delivery-idea', icon: 'ri-lightbulb-line' },
  { id: 'stage-change', label: 'Define the change', articleId: 'delivery-change-request', icon: 'ri-git-pull-request-line' },
  { id: 'stage-prompt', label: 'Prepare the build prompt', articleId: 'delivery-prompt', icon: 'ri-terminal-box-line' },
  { id: 'stage-build', label: 'Track the build', articleId: 'delivery-build-process', icon: 'ri-list-check-3' },
  { id: 'stage-bugs', label: 'Record and resolve bugs', articleId: 'delivery-bugs', icon: 'ri-bug-line' },
  { id: 'stage-verify', label: 'Verify the result', articleId: 'delivery-bugs', icon: 'ri-check-double-line' },
  { id: 'stage-roadmap', label: 'Update the roadmap', articleId: 'delivery-roadmap', icon: 'ri-road-map-line' },
  { id: 'stage-launch', label: 'Review launch readiness', articleId: 'delivery-build-process', icon: 'ri-rocket-line' },
];

export const PROJECT_DELIVERY_ARTICLES: HelpArticle[] = [
  {
    id: 'delivery-dashboard',
    title: 'Starting your day from the Dashboard',
    summary: 'How to use the Dashboard to review activity, bugs, build actions and budget health.',
    keywords: ['dashboard', 'recent activity', 'critical bugs', 'build process', 'budget warnings', 'upcoming payments', 'overview'],
    steps: [
      { action: 'Open Dashboard.', expected: 'The Dashboard shows current stats across projects, ideas, change requests, prompts, bugs, notes, files and roadmap items.' },
      { action: 'Review critical bugs first.', expected: 'The Critical Open Bugs panel lists open critical-severity bugs with their project. Resolve or escalate these before anything else.' },
      { action: 'Review launch-blocking build actions.', expected: 'The Build Process — Next Actions panel lists required, incomplete build items, with a BLOCKER flag on launch blockers.' },
      { action: 'Check budget warnings and upcoming payments.', expected: 'The Budget Warnings panel flags over-budget and at-75% budgets. Upcoming Payments lists the next recurring payments.' },
      { action: 'Open the related project or module.', expected: 'Each "View All" link opens the build process or project budget module; make detailed changes there.' },
      { action: 'Refresh the dashboard if the information appears out of date.', expected: 'Use Retry on error, or reload, to pull fresh data.' },
    ],
    note: 'Use the Dashboard to decide what needs attention. Make detailed changes inside the relevant project, bug, build or budget module.',
    relatedLinks: [
      { label: 'Dashboard', route: '/dashboard' },
      { label: 'Build Process', route: '/build-process' },
      { label: 'Project Budget', route: '/project-budget' },
      { label: 'Projects', route: '/projects' },
    ],
  },
  {
    id: 'delivery-project',
    title: 'Creating and managing a project',
    summary: 'How to create, open, archive and restore projects using the Projects page.',
    keywords: ['project', 'create', 'new project', 'slug', 'archive', 'restore', 'active', 'archived', 'status', 'priority', 'domain'],
    steps: [
      { action: 'Open Projects.', expected: 'The page lists active projects by default and shows a count.' },
      { action: 'View active or archived projects.', expected: 'Use the Active / Archived tabs to switch between views.' },
      { action: 'Create a new project.', expected: 'Select "+ New Project" and complete the wizard: Basics, Classify, Tech & Dates, then Review.' },
      { action: 'Open a project workspace.', expected: 'Select a project card to open its workspace at /projects/{slug}.' },
      { action: 'Update project information.', expected: 'Edit the project to change name, slug, description, owner, status, priority, type, tech stack, domains, launch date and finances.' },
      { action: 'Understand the project slug.', expected: 'The slug is auto-generated from the name and used in the URL. It can be edited manually but must stay URL-safe.' },
      { action: 'Archive a project.', expected: 'Set its status to archived. Archiving removes it from the active list — it is not deleted.' },
      { action: 'View archived projects.', expected: 'Switch to the Archived tab to see archived projects.' },
      { action: 'Restore an archived project.', expected: 'Select Restore on a card to return it to the active list (status becomes planning).' },
      { action: 'Bulk restore.', expected: 'When more than one project is archived, "Restore All (N)" restores them all at once.' },
    ],
    points: [
      'Project fields: Project Name, Slug, Description, Owner, Status, Priority, Project Type, Tech Stack, Live Domain, Staging Domain, Target Launch Date, Monthly Revenue, Monthly Costs, Project Notes.',
      'Status values: idea, planning, building, testing, live, on hold, archived.',
      'Priority values: low, medium, high, critical.',
      'Project Type options: SaaS, Client Build, Internal Tool, AI-Powered.',
    ],
    warning: 'Check the project name and domain before creating a duplicate. Archiving is not permanent deletion, and restoring returns a project to the active list. Do not edit project identifiers directly in Supabase.',
    relatedLinks: [
      { label: 'Projects', route: '/projects' },
      { label: 'Dashboard', route: '/dashboard' },
    ],
  },
  {
    id: 'delivery-idea',
    title: 'Capturing and developing an idea',
    summary: 'When and how to capture early concepts in the Ideas module.',
    keywords: ['idea', 'new idea', 'concept', 'feature', 'kanban', 'category', 'priority', 'status', 'opportunity'],
    points: [
      'Use Ideas for: a new website concept, a product improvement, a potential feature, a business opportunity, or an early-stage requirement that is not ready for development.',
    ],
    steps: [
      { action: 'Open Ideas.', expected: 'Ideas appear as a kanban board with columns: New, Reviewing, Approved, Building, Done, Rejected.' },
      { action: 'Search existing ideas before creating a duplicate.', expected: 'Use "Search ideas…" and the project, priority and category filters first.' },
      { action: 'Create an idea.', expected: 'Select "New Idea" and complete the form — Title and Project are required.' },
      { action: 'Associate it with the correct project.', expected: 'Choose the project in the Project field.' },
      { action: 'Add enough context.', expected: 'Use the Description and Notes fields so another team member can understand it.' },
      { action: 'Apply type, priority or status values.', expected: 'Set Priority (low/medium/high/critical), Status (new/reviewing/approved/building/done/rejected) and a Category.' },
      { action: 'Edit the idea as it develops.', expected: 'Open an idea and select Edit to update it; Delete removes it.' },
      { action: 'Move to a Change Request when work is agreed.', expected: 'Promote an agreed idea into a Change Request so it can be reviewed, prioritised and delivered.' },
    ],
    note: 'Idea = something being considered. Change Request = a defined change that can be reviewed, prioritised and delivered.',
    relatedLinks: [
      { label: 'Ideas', route: '/ideas' },
      { label: 'Change Requests', route: '/change-requests' },
    ],
  },
  {
    id: 'delivery-change-request',
    title: 'Creating a Change Request',
    summary: 'How to convert an agreed idea or requirement into controlled delivery work.',
    keywords: ['change request', 'new request', 'priority', 'status', 'approve', 'delivery', 'requested', 'requirement'],
    steps: [
      { action: 'Select the correct project.', expected: 'Choose the project the change belongs to.' },
      { action: 'Use a specific title.', expected: 'Write a title that clearly names the change.' },
      { action: 'Describe the current problem or requirement.', expected: 'Explain what is wrong or missing today.' },
      { action: 'Describe the expected outcome.', expected: 'Explain what success looks like after the change.' },
      { action: 'Select the correct priority.', expected: 'Choose low, medium, high or critical.' },
      { action: 'Use the current status values accurately.', expected: 'Statuses are: requested, approved, in_progress, testing, completed, rejected.' },
      { action: 'Record important decisions before development begins.', expected: 'Capture decisions in the Notes field.' },
      { action: 'Update the status as work progresses.', expected: 'Change the status via the inline selector as the request moves through delivery.' },
    ],
    note: 'A Change Request should describe what must change and why. It should not contain only a raw AI prompt.',
    commonMistakes: [
      'Creating duplicate requests',
      'Selecting the wrong project',
      'Marking work complete before verification',
      'Using urgent priority for normal work',
      'Changing scope without updating the request',
      'Losing approval decisions in informal notes',
    ],
    relatedLinks: [
      { label: 'Change Requests', route: '/change-requests' },
      { label: 'Ideas', route: '/ideas' },
      { label: 'Prompts', route: '/prompts' },
    ],
  },
  {
    id: 'delivery-prompt',
    title: 'Preparing and storing a build prompt',
    summary: 'How to use the Prompts module as a controlled, single-scope prompt library.',
    keywords: ['prompt', 'build prompt', 'draft', 'approved', 'scope', 'single-scope', 'type', 'status', 'result'],
    steps: [
      { action: 'Select "Add Prompt".', expected: 'The prompt form opens.' },
      { action: 'Enter a prompt name.', expected: 'Give the prompt a clear, findable title.' },
      { action: 'Enter the prompt content.', expected: 'Paste the full prompt text in the Prompt Text field.' },
      { action: 'Select the project.', expected: 'Choose the project the prompt belongs to (required).' },
      { action: 'Choose the type.', expected: 'Types: Readdy, Supabase, Stripe, n8n, Image AI, Logo, Email, Audit, Bug Fix, Other.' },
      { action: 'Choose the status.', expected: 'Statuses: Draft, Used, Worked, Failed, Archived.' },
      { action: 'Add model and result notes.', expected: 'Record the AI model used and how the prompt performed in the Result Notes field.' },
      { action: 'Search, filter and edit.', expected: 'Use the search box and Type/Status/Project filters; open a prompt to edit or delete it.' },
    ],
    points: [
      'Recommended prompt structure — Scope: what this prompt is allowed to touch.',
      'Purpose: why the change is needed.',
      'Required changes: the specific edits.',
      'Layout: visual and layout requirements.',
      'Behaviour: interactions and flows.',
      'Data: what data is involved.',
      'Integrations: any third-party services.',
      'Permissions: access and role rules to preserve.',
      'Acceptance checks: how to confirm success.',
      'Non-changes: what must not be altered.',
      'Report requirements: what the builder must return.',
    ],
    safetyRules: [
      'Keep each build prompt single-scope.',
      'Inspect existing code before requesting changes.',
      'Do not ask the builder to replace unrelated pages.',
      'Identify the project and affected route.',
      'Preserve existing authentication and permissions.',
      'State what must not change.',
      'Include acceptance checks.',
      'Do not place secrets, passwords or API keys inside prompts.',
      'Save the final approved version in DFP Command before using it.',
      'Record the result after the build attempt.',
    ],
    note: 'Draft prompt = still being prepared or reviewed. Ready/used prompt = suitable for the intended build workflow. DFP Command tracks prompts with statuses Draft, Used, Worked, Failed and Archived — there is no separate formal approval action, so mark a prompt ready by setting an appropriate status and recording the result after the build.',
    relatedLinks: [
      { label: 'Prompts', route: '/prompts' },
      { label: 'Build Process', route: '/build-process' },
    ],
  },
  {
    id: 'delivery-bugs',
    title: 'Recording and managing bugs',
    summary: 'When to log a bug and how to report, prioritise and close it.',
    keywords: ['bug', 'report bug', 'severity', 'reproduce', 'status', 'fixed', 'defect', 'broken', 'verify'],
    note: 'Bug = existing behaviour is broken, incorrect or inconsistent. Change Request = a new or changed behaviour is being requested.',
    steps: [
      { action: 'Select the affected project.', expected: 'Choose the project in the Project field (required).' },
      { action: 'Use a clear summary.', expected: 'Write a concise Bug Title.' },
      { action: 'Record the affected page or feature.', expected: 'Use the Description and Type fields.' },
      { action: 'Describe the expected result.', expected: 'Explain what should happen.' },
      { action: 'Describe the actual result.', expected: 'Explain what actually happens instead.' },
      { action: 'Add reproduction steps.', expected: 'Use the Steps to Reproduce field.' },
      { action: 'Record browser, device or environment.', expected: 'Use the Environment field (e.g. Production, Staging).' },
      { action: 'Add evidence through UAT or file workflow.', expected: 'Attach screenshots or references where applicable.' },
      { action: 'Select the correct severity and status.', expected: 'Severity: low/medium/high/critical. Status: open/investigating/in_progress/fixed/wont_fix/duplicate.' },
      { action: 'Re-test before closing.', expected: 'Confirm the fix resolves the visible problem before marking it fixed.' },
    ],
    warning: 'Do not mark a bug resolved solely because code was changed. Verify the user-visible result first.',
    relatedLinks: [
      { label: 'Bugs', route: '/bugs' },
      { label: 'Change Requests', route: '/change-requests' },
    ],
  },
  {
    id: 'delivery-notes-files',
    title: 'Using Notes and Files & Links',
    summary: 'How Notes and Files & Links support the project record.',
    keywords: ['notes', 'files', 'links', 'tags', 'pinned', 'decision', 'document', 'reference', 'repository'],
    points: [
      'Use Notes for: decisions, meeting outcomes, investigation findings, technical context, customer requirements and follow-up actions.',
    ],
    steps: [
      { action: 'Search and filter notes.', expected: 'Use "Search notes, tags, or content…" and the Type/Project filters.' },
      { action: 'Create a note.', expected: 'Select "+ New Note"; Title is required and project is optional.' },
      { action: 'Categorise the note.', expected: 'Choose a type: General, Meeting, Decision, Legal, Pricing, Client Feedback, Supplier, Research, Other.' },
      { action: 'Add tags.', expected: 'Enter comma-separated tags.' },
      { action: 'Pin important notes.', expected: 'Use the pin toggle; pinned notes sort to the top.' },
      { action: 'Edit or delete.', expected: 'Open a note to edit it, or delete it when no longer needed.' },
      { action: 'Browse Files & Links.', expected: 'Use "Search files, links, or tags…" and the Type/Project filters.' },
      { action: 'Expand groups and open links.', expected: 'Items are grouped by type; expand a group and open a valid link in a new tab.' },
    ],
    safetyRules: [
      'Do not store passwords or secret keys.',
      'Confirm sharing permissions before linking private material.',
      'Use descriptive titles rather than raw URLs.',
      'Associate the record with the correct project.',
      'Do not treat Notes as a substitute for a formal Change Request or Bug.',
    ],
    note: 'Files & Links stores design references, repository links, deployment links, external documentation, UAT evidence references, approved source material and project resources. Item types include Link, Dashboard, Repository, File, Document, Image, Archive, Database, Payment, Automation and Other.',
    relatedLinks: [
      { label: 'Notes', route: '/notes' },
      { label: 'Files & Links', route: '/files-links' },
    ],
  },
  {
    id: 'delivery-roadmap',
    title: 'Managing the Roadmap',
    summary: 'How to turn planned work into a visible delivery sequence.',
    keywords: ['roadmap', 'phase', 'status', 'priority', 'planned', 'blocked', 'completed', 'add item', 'target date'],
    steps: [
      { action: 'Select the correct project.', expected: 'Use the project filter to focus on one project.' },
      { action: 'Add an agreed item.', expected: 'Select "+ Add Item".' },
      { action: 'Choose its phase, status and priority.', expected: 'Phase: Phase 1 / 2 / 3 / Future. Status: planned / in_progress / blocked / completed. Priority: low / medium / high / critical.' },
      { action: 'Add delivery context.', expected: 'Set a clear title, description and target date.' },
      { action: 'Move the item as work progresses.', expected: 'Edit the item to change its phase or status.' },
      { action: 'Keep blocked or delayed work visible.', expected: 'Use the Blocked status rather than hiding stalled work.' },
      { action: 'Confirm completion only after verification.', expected: 'Mark an item completed only after the work is verified.' },
    ],
    note: 'Roadmap movement must reflect actual progress, not desired progress. The phase columns show the delivery sequence; the Blocked status keeps stalled work visible.',
    relatedLinks: [
      { label: 'Roadmap', route: '/roadmap' },
      { label: 'Projects', route: '/projects' },
    ],
  },
  {
    id: 'delivery-build-process',
    title: 'Using the Web App Build Process',
    summary: 'How the build-process checklist tracks delivery from idea to launch.',
    keywords: ['build process', 'checklist', 'overview', 'master template', 'reports', 'launch readiness', 'blocker', 'cdd', 'conception', 'development', 'deployment'],
    steps: [
      { action: 'Overview tab.', expected: 'Summary of build-process progress and items requiring attention.' },
      { action: 'Active Checklists tab.', expected: 'Review the current project build run, stages, actions and launch blockers.' },
      { action: 'Master Template tab.', expected: 'The reusable delivery stages and checklist structure (CDD phases: Conception, Development, Deployment).' },
      { action: 'Reports tab.', expected: 'Review build completion, blockers, overdue tasks and project progress.' },
      { action: 'Launch Readiness tab.', expected: 'An evidence-based go/no-go decision with a 0–100 readiness score.' },
    ],
    points: [
      'Launch-readiness checks: critical bugs, incomplete launch blockers, authentication, permissions, payments where relevant, email delivery, forms, mobile layout, UAT evidence, security checks, backup or rollback planning, connected services and production configuration.',
    ],
    note: 'Launch readiness is an evidence-based decision. A project must not be treated as ready merely because its website loads. Do not instruct ordinary users to change the master template unless their authority permits it.',
    relatedLinks: [
      { label: 'Build Process', route: '/build-process' },
      { label: 'Dashboard', route: '/dashboard' },
      { label: 'Project Budget', route: '/project-budget' },
    ],
  },
  {
    id: 'delivery-budget',
    title: 'Managing the project budget',
    summary: 'How to plan and monitor budgets, costs and forecast profitability.',
    keywords: ['budget', 'cost item', 'recurring cost', 'profit forecast', 'reports', 'spend', 'payment', 'break-even'],
    steps: [
      { action: 'Overview tab.', expected: 'Summary of budget health, warnings, unpaid launch costs and upcoming payments.' },
      { action: 'Project Budgets tab.', expected: 'Create and edit budgets with approved, actual and remaining spend.' },
      { action: 'Cost Items tab.', expected: 'One-off or recurring costs with estimated and actual amounts.' },
      { action: 'Recurring Costs tab.', expected: 'Ongoing subscriptions with billing cycle, monthly/yearly cost and next payment.' },
      { action: 'Profit Forecast tab.', expected: 'Forecast revenue vs recurring costs, break-even and profit verdict.' },
      { action: 'Reports tab.', expected: 'Budget health, over-budget projects, unpaid costs and recurring by supplier.' },
    ],
    points: [
      'A project budget is the overall financial plan; an individual cost item is a single spend within it.',
      'One-off costs are single purchases; recurring costs repeat on a billing cycle (weekly/monthly/quarterly/yearly).',
      'Record both estimated and actual costs where supported.',
      'Review forecast profitability (monthly/yearly) and break-even.',
      'Check budget warnings (over budget, at 75%+) and upcoming payments.',
      'Associate every cost with the correct project.',
    ],
    note: 'Project Budget is an internal planning and monitoring tool. It is not an accounting system, invoice system or bank record.',
    relatedLinks: [
      { label: 'Project Budget', route: '/project-budget' },
      { label: 'Dashboard', route: '/dashboard' },
    ],
  },
  {
    id: 'delivery-activity-github',
    title: 'Reviewing Activity and GitHub information',
    summary: 'How to review operational history and the repository inventory.',
    keywords: ['activity log', 'history', 'audit', 'github', 'repository', 'repos', 'language', 'search', 'event'],
    points: [
      'The Activity Log helps answer: what changed, when it changed, which project was affected, and who or what recorded the action.',
    ],
    steps: [
      { action: 'Search the Activity Log.', expected: 'Use "Search activity…".' },
      { action: 'Filter by action, entity and project.', expected: 'Actions: created/updated/deleted/archived/restored/login/other. Entities: project/idea/bug/change_request/note/file/user.' },
      { action: 'Browse the timeline.', expected: 'Events are grouped by date (Today, Yesterday, or a date) and are collapsible.' },
      { action: 'View the GitHub repository inventory.', expected: 'The GitHub page lists repositories pulled live from GitHub, with stars, forks, language, topics and last updated.' },
      { action: 'Search and filter repositories.', expected: 'Search by name, description or language, and filter All / Public / Private.' },
      { action: 'Identify the repository for a DFP project.', expected: 'Match the repository name to the connected project.' },
    ],
    note: 'The Activity Log records the actions the application logs. It does not guarantee that every possible system event is audited.',
    warning: 'The DFP Command GitHub page is not a substitute for checking the actual repository before making code, branch, pull-request or deployment decisions.',
    relatedLinks: [
      { label: 'Activity Log', route: '/activity-log' },
      { label: 'GitHub', route: '/github' },
      { label: 'Projects', route: '/projects' },
    ],
  },
];

export const FIRST_PROJECT_CHECKLIST: string[] = [
  'Open or create the project',
  'Confirm the project name and domain',
  'Search existing ideas and change requests',
  'Record the agreed requirement',
  'Save the approved build prompt',
  'Track build progress',
  'Record discovered bugs',
  'Add important notes and links',
  'Update the roadmap',
  'Complete the build checklist',
  'Review budget impact',
  'Complete launch-readiness checks',
];

export const FIRST_PROJECT_CHECKLIST_STORAGE_KEY = 'dfp-help-first-project-checklist';

// ============================================================================
// Help Centre 03 — Support Operations content.
// ============================================================================

export const SUPPORT_TICKET_JOURNEY: JourneyStage[] = [
  { id: 'stage-review-queue', label: 'Review the queue', articleId: 'support-queues', icon: 'ri-list-check-3' },
  { id: 'stage-open-ticket', label: 'Open the ticket', articleId: 'support-reading-ticket', icon: 'ri-file-text-line' },
  { id: 'stage-triage', label: 'Triage the issue', articleId: 'support-ai-triage', icon: 'ri-brain-line' },
  { id: 'stage-assign', label: 'Assign and prioritise', articleId: 'support-assignment', icon: 'ri-user-add-line' },
  { id: 'stage-investigate', label: 'Investigate the customer context', articleId: 'support-customer-360', icon: 'ri-user-search-line' },
  { id: 'stage-communicate', label: 'Communicate', articleId: 'support-reply-note', icon: 'ri-chat-3-line' },
  { id: 'stage-diagnose', label: 'Diagnose', articleId: 'support-diagnostics', icon: 'ri-stethoscope-line' },
  { id: 'stage-repair', label: 'Request an authorised action', articleId: 'support-repairs', icon: 'ri-tools-line' },
  { id: 'stage-verify', label: 'Verify the outcome', articleId: 'support-repairs', icon: 'ri-check-double-line' },
  { id: 'stage-close', label: 'Save the resolution and close', articleId: 'support-resolution', icon: 'ri-archive-drawer-line' },
];

// Capability list for the "Your Support Permissions" panel. Each entry maps a
// user-facing capability to the real permission keys from src/lib/permissions.ts.
// The component evaluates these live with hasPermission() — no second matrix.
export interface SupportCapability {
  id: string;
  label: string;
  permission: Permission;
  // Used to mark an action as "Read only" when the user can view the related
  // data but not perform the action.
  viewPermission: Permission;
}

export const SUPPORT_CAPABILITIES: SupportCapability[] = [
  { id: 'view-tickets', label: 'View tickets', permission: 'support.tickets.view', viewPermission: 'support.tickets.view' },
  { id: 'reply', label: 'Reply to tickets', permission: 'support.tickets.reply', viewPermission: 'support.tickets.view' },
  { id: 'assign', label: 'Assign tickets', permission: 'support.tickets.assign', viewPermission: 'support.tickets.view' },
  { id: 'priority', label: 'Change priority', permission: 'support.tickets.priority', viewPermission: 'support.tickets.view' },
  { id: 'escalate', label: 'Escalate tickets', permission: 'support.tickets.escalate', viewPermission: 'support.tickets.view' },
  { id: 'triage', label: 'Run AI triage', permission: 'support.triage.run', viewPermission: 'support.tickets.view' },
  { id: 'view-diagnostics', label: 'View diagnostics', permission: 'support.diagnostics.view', viewPermission: 'support.diagnostics.view' },
  { id: 'run-diagnostics', label: 'Run diagnostics', permission: 'support.diagnostics.run', viewPermission: 'support.diagnostics.view' },
  { id: 'request-repair', label: 'Request repairs', permission: 'support.repairs.request', viewPermission: 'support.repairs.view' },
  { id: 'approve-repair', label: 'Approve permitted repairs', permission: 'support.repairs.approve.medium', viewPermission: 'support.repairs.view' },
  { id: 'execute-repair', label: 'Execute permitted repairs', permission: 'support.repairs.execute', viewPermission: 'support.repairs.view' },
  { id: 'start-session', label: 'Start support sessions', permission: 'support.sessions.start', viewPermission: 'support.sessions.view' },
  { id: 'create-resolution', label: 'Create resolutions', permission: 'support.resolutions.create', viewPermission: 'support.resolutions.view' },
  { id: 'view-audit', label: 'View audit information', permission: 'support.audit.view', viewPermission: 'support.audit.view' },
];

export const SUPPORT_ARTICLES: HelpArticle[] = [
  {
    id: 'support-queues',
    title: 'Understanding the Support Ticket queues',
    summary: 'The seven ticket queues and how to search, filter, sort and page through them.',
    keywords: ['queue', 'all', 'my tickets', 'unassigned', 'needs review', 'escalated', 'urgent', 'sla', 'sla risk', 'overdue', 'filter', 'sort', 'pagination', 'search', 'page size'],
    points: [
      'All — every ticket regardless of assignment, status or routing.',
      'My Tickets — tickets assigned to you.',
      'Unassigned — tickets with no assigned staff member.',
      'Needs Review — tickets whose routing status is needs_review (awaiting a routing decision).',
      'Escalated — tickets whose routing status is escalated.',
      'Urgent — tickets with urgent priority.',
      'SLA Risk — tickets that are overdue (past their due time and not resolved, closed or spam).',
      'Search matches the ticket number, subject, customer name, customer email and external reference, plus the source site.',
      'Filters include status, priority, category, source, site, project, assignee, team, routing, unread, overdue and resolved today, plus created and activity date ranges.',
      'Sort options: Relevance, Newest created, Oldest created, Most recent activity, Oldest activity, Highest priority, Due soonest, Customer name and Ticket number.',
      'Page size can be 25, 50 or 100, with Previous/Next pagination.',
    ],
    note:
      'Urgency and SLA risk are not the same thing. Urgent reflects a ticket priority; SLA Risk reflects a ticket that is overdue against its due time. A low-priority ticket can be an SLA risk, and an urgent ticket may still be within its SLA. Opening a ticket does not assign it to you — assignment is a separate action.',
    steps: [
      { action: 'Review Urgent first.', expected: 'These are the highest-priority tickets.' },
      { action: 'Review SLA Risk next.', expected: 'These tickets are overdue and need attention before the breach grows.' },
      { action: 'Review Escalated.', expected: 'These have been marked escalated and need the right authority.' },
      { action: 'Review Needs Review.', expected: 'These are awaiting a routing decision.' },
      { action: 'Review Unassigned.', expected: 'These have no owner yet — assign them to the right person or team.' },
      { action: 'Review My Tickets.', expected: 'Clear your own backlog.' },
      { action: 'Then work through the remaining tickets.', expected: 'Work through the rest in priority and due-date order.' },
    ],
    relatedLinks: [{ label: 'Support Tickets', route: '/support-tickets' }],
  },
  {
    id: 'support-reading-ticket',
    title: 'Reading a ticket before taking action',
    summary: 'The information on the ticket detail page and what to check before replying or changing status.',
    keywords: ['ticket detail', 'ticket number', 'subject', 'site', 'customer', 'organisation', 'status', 'priority', 'assigned', 'sla', 'conversation', 'attachments', 'history', 'read', 'context'],
    points: [
      'The detail page shows the ticket number, subject, source site, customer, organisation, status, priority, assigned staff or team, created and updated times, and SLA indicators.',
      'The Conversation shows the full message history, with customer and staff messages plus attachments.',
      'Ticket history records events such as created, status changed, priority changed, assigned, staff reply and internal note.',
      'The right-hand panels add customer/source details, account context, routing, AI triage, diagnostics, repairs and support access.',
    ],
    steps: [
      { action: 'Confirm the source site.', expected: 'Know which website or product the ticket came from.' },
      { action: 'Confirm the customer identity.', expected: 'Match the customer and any linked account or organisation.' },
      { action: 'Read the full conversation.', expected: 'Review every message, not just the latest one.' },
      { action: 'Review attachments safely.', expected: 'Open only what you need, using the signed attachment flow.' },
      { action: 'Check previous tickets or known resolutions.', expected: 'Look for related tickets and reusable resolution memory.' },
      { action: 'Check current assignment and SLA state.', expected: 'Confirm who owns it and whether it is at SLA risk.' },
      { action: 'Decide whether the issue needs communication, investigation, escalation or both.', expected: 'Plan the next action before acting.' },
    ],
    note:
      'Do not rely only on the ticket subject. Read the full history before replying or changing status.',
    relatedLinks: [{ label: 'Support Tickets', route: '/support-tickets' }],
  },
  {
    id: 'support-ai-triage',
    title: 'Running AI triage safely',
    summary: 'What AI triage does, who can run it, and how to review its suggestions.',
    keywords: ['ai triage', 'triage', 'run ai triage', 'suggestion', 'confidence', 'category', 'priority', 'team', 'security review', 'human review', 'ai', 're-run triage'],
    points: [
      'AI triage classifies the ticket and returns a suggested category (with subcategory), suggested priority, suggested team, a likely issue, a summary, a suggested diagnostic and a suggested response.',
      'Each suggestion carries a confidence of high, medium or low.',
      'If the AI flags a possible security issue, a "SECURITY REVIEW REQUIRED" warning is shown.',
      '"Apply recommendation" applies the suggested category, priority and team (only shown to roles that can assign).',
      '"Use Response" places the suggested reply into the editor — it is never auto-sent.',
      'Feedback lets you mark the triage helpful or not helpful and rate whether the category, team and priority were correct.',
      'If triage fails or is unavailable, an "AI Triage unavailable" message appears with a retry option.',
    ],
    note:
      'AI triage shows "AI-generated suggestion — staff review required". Every suggestion must be human-reviewed before it is applied or sent.',
    safetyRules: [
      'AI triage supports the staff member; it does not own the ticket.',
      'Check the selected site and customer context.',
      'Review every proposed priority, category and response.',
      'Do not allow AI output to send a customer message automatically — responses are only placed in the editor for review.',
      'Do not treat AI triage as a diagnostic result.',
      'Never place credentials, passwords, payment details or MFA codes into AI instructions.',
    ],
    relatedLinks: [{ label: 'Support Tickets', route: '/support-tickets' }],
  },
  {
    id: 'support-assignment',
    title: 'Assignment, priority and escalation',
    summary: 'How assignment, priority, status and escalation controls work and who can use them.',
    keywords: ['assign', 'assign to me', 'unassign', 'team', 'change team', 'priority', 'escalate', 'escalation', 'status', 'review', 're-route', 'permission', 'available', 'restricted', 'read only'],
    points: [
      'Re-route — send the ticket back through routing.',
      'Assign to me / Assign — set or clear the staff assignee (the staff list shows each person\'s open-ticket count).',
      'Unassign — clear the current assignee.',
      'Change team — set the responsible support team.',
      'Change status — New, Open, In Progress, Waiting on Customer, Waiting on Staff, Resolved, Closed or Spam.',
      'Change priority — Low, Normal, High, Urgent or Critical.',
      'Mark read / unread — track which tickets still need review.',
      'Escalation is shown as an "Escalation N" badge and reflected in the Escalated queue; there is no free-text escalation reason field.',
      'Escalate for: SLA breach risk, a security concern, a payment issue, repeated failure, a possible data incident, customer impact across multiple users, a repair requiring higher approval, or no authorised person being available.',
    ],
    steps: [
      { action: 'Assign work to the correct person or support team.', expected: 'The ticket goes to whoever can actually resolve it.' },
      { action: 'Check site access and workload where visible.', expected: 'The assign list shows each person\'s open-ticket count.' },
      { action: 'Do not assign technical work solely to remove it from the unassigned queue.', expected: 'Assignment should reflect real ownership.' },
      { action: 'Escalate when the current role, knowledge or authority is insufficient.', expected: 'The right authority takes over.' },
    ],
    note:
      'Assignment, priority and team changes are permission-gated (the assign and priority permissions — Owner, Admin and Support Manager). Escalation is available to those roles plus Support Agent. Check the "Your Support Permissions" panel for your own access, and escalate when a control is not available to you.',
    relatedLinks: [{ label: 'Support Tickets', route: '/support-tickets' }],
  },
  {
    id: 'support-reply-note',
    title: 'Customer Reply versus Internal Note',
    summary: 'The two reply modes, what each is for, and how delivery is handled.',
    keywords: ['customer reply', 'reply to customer', 'internal note', 'note', 'reply', 'delivery', 'email notification', 'quickguard', 'send', 'warning', 'private', 'ai reply'],
    points: [
      'Use an internal note for: investigation details, handover notes, technical findings, approval context, follow-up tasks, and anything that must not be sent to the customer.',
      'The AI Reply Assistant can draft a reply (tones: Professional, Friendly, Concise, Technical, Simple Explanation) and offers quick actions such as Improve Draft, Shorten and Make Friendlier. Its output is never auto-sent.',
    ],
    steps: [
      { action: 'Confirm the customer and source site.', expected: 'You are replying to the right person on the right site.' },
      { action: 'Read the complete conversation.', expected: 'You have full context before replying.' },
      { action: 'Check names, dates, instructions and links.', expected: 'The reply is accurate.' },
      { action: 'Remove internal technical commentary.', expected: 'Nothing internal reaches the customer.' },
      { action: 'Review any AI-generated draft.', expected: 'The draft is correct before you send it.' },
      { action: 'Confirm attachments.', expected: 'Any files attached are intended and safe.' },
      { action: 'Send only when the response is accurate and helpful.', expected: 'The reply is genuinely useful to the customer.' },
      { action: 'Check the resulting delivery status or warning.', expected: 'You know whether the reply was delivered externally.' },
    ],
    warning:
      'Internal notes and customer replies are different actions. Confirm the selected mode before submitting. Internal notes are never sent to the customer.',
    note:
      'A "Reply to customer" is saved and triggers the customer email notification workflow. An "Internal note" is saved privately. If the reply saves but the email notification fails you see "Reply saved, but the customer email notification needs attention." For QuickGuard tickets a staff reply is also forwarded to the site; if that cannot be confirmed you see "Reply saved in DFP Command, but QuickGuard delivery could not be confirmed." Do not describe a saved reply as externally delivered when the interface reports a delivery warning.',
    relatedLinks: [{ label: 'Support Tickets', route: '/support-tickets' }],
  },
  {
    id: 'support-attachments',
    title: 'Using attachments safely',
    summary: 'How to view and handle attachments without introducing risk.',
    keywords: ['attachment', 'file', 'download', 'untrusted', 'file type', 'signed', 'suspicious', 'upload', 'size limit'],
    points: [
      'Attachments may be customer-supplied and untrusted.',
      'Check the file name and type before opening.',
      'Do not execute unknown files.',
      'Do not upload or redistribute confidential material unnecessarily.',
      'Use the signed attachment access flow — attachments open through a signed URL.',
      'Report suspicious files.',
      'Do not place attachment URLs into permanent notes if they are temporary signed links.',
    ],
    note:
      'Attachments are opened through a signed-URL flow. The reply composer allows attaching files but blocks risky types (.exe, .dll, .bat, .cmd, .ps1, .js, .html, .svg, .sh, .msi) and limits size to 10 MB. Only upload, download or delete actions that actually exist in the interface are available.',
    relatedLinks: [{ label: 'Support Tickets', route: '/support-tickets' }],
  },
  {
    id: 'support-customer-360',
    title: 'Using Customer 360',
    summary: 'Searching customers and understanding each Customer 360 tab.',
    keywords: ['customer 360', 'customer', 'search', 'overview', 'tickets', 'activity', 'subscriptions', 'diagnostics', 'repairs', 'sessions', 'audit', 'user id', 'email', 'organisation', 'site'],
    steps: [
      { action: 'Open Customers.', expected: 'You reach the customer search page.' },
      { action: 'Search by name, email, user ID, organisation, site or ticket number.', expected: 'The placeholder lists the supported identifiers.' },
      { action: 'Open a result.', expected: 'You reach the Customer 360 record.' },
      { action: 'Use the tabs to review the record.', expected: 'Overview, Tickets, Activity, Subscriptions, Diagnostics, Repairs, Sessions and Audit.' },
    ],
    points: [
      'Overview — name, email, user ID, organisation, sites/products, account status, email verification, role, created date and last login.',
      'Tickets — tickets linked to this customer.',
      'Activity — support actions recorded for this customer (login, password and account-change events are not yet tracked by this backend).',
      'Subscriptions — subscription plans and their status.',
      'Diagnostics — run and review account diagnostics.',
      'Repairs — repair actions for this customer.',
      'Sessions — support sessions for this customer.',
      'Audit — the support actions recorded against this customer.',
    ],
    safetyRules: [
      'Confirm the correct customer before taking action.',
      'Similar names are not proof of identity.',
      'Do not change subscription or account information unless the real interface provides an authorised action.',
      'Customer 360 is operational context, not permission to access unrelated customer data.',
    ],
    relatedLinks: [{ label: 'Customers', route: '/customers' }, { label: 'Support Tickets', route: '/support-tickets' }],
  },
  {
    id: 'support-diagnostics',
    title: 'Diagnostics are not repairs',
    summary: 'How diagnostics collect evidence, and why they are separate from repairs.',
    keywords: ['diagnostic', 'diagnostics', 'run diagnostics', 'repair', 'evidence', 'check', 'scope', 'account', 'authentication', 'subscription', 'email', 'recent errors', 'retry'],
    note:
      'Diagnostic = collects and presents evidence about the problem. Repair = requests or performs an authorised change intended to correct the problem.',
    steps: [
      { action: 'Confirm the correct customer, organisation and site.', expected: 'You are diagnosing the right account.' },
      { action: 'Review existing diagnostic results.', expected: 'You do not re-run something already answered.' },
      { action: 'Run or retry diagnostics only when your role is permitted.', expected: 'Diagnostics are permission-gated.' },
      { action: 'Read individual checks and evidence.', expected: 'You understand each check and its result.' },
      { action: 'Identify failed, warning and unavailable checks.', expected: 'You know what needs attention.' },
      { action: 'Avoid repeating diagnostics without a reason.', expected: 'You are not wasting runs.' },
      { action: 'Use the result to decide whether a repair request is justified.', expected: 'Evidence, not assumption, drives the next step.' },
    ],
    points: [
      'Diagnostic scopes: Account, Authentication, Subscription, Email and Recent Errors.',
      'Diagnostics are read-only — no customer credentials are used.',
      'Each check returns Pass, Warning, Fail, Unavailable or Error; the overall result is Healthy, Warnings, Issues found or Error.',
      'A diagnostic can surface a recommended repair action, but that action still needs human approval.',
      'Organisation-only accounts exclude authentication checks (no portal account).',
      'A customer must be resolved before diagnostics can run.',
    ],
    warning:
      'Do not tell unauthorised roles to run diagnostics, and do not describe a diagnostic as proof that a repair succeeded.',
    relatedLinks: [{ label: 'Customers', route: '/customers' }, { label: 'Support Tickets', route: '/support-tickets' }],
  },
  {
    id: 'support-repairs',
    title: 'Requesting and approving Support Repairs',
    summary: 'The human-approved repair workflow from request to verification.',
    keywords: ['repair', 'request approval', 'approve', 'execute', 'risk', 'pending approval', 'verify', 'audit', 'recommendation', 'support repairs', 'failed', 'reject'],
    note: 'Repairs follow: Diagnose → Recommend → Human Approval → Secure Execution → Verify → Audit.',
    steps: [
      { action: 'From a diagnostic result, review the recommended action.', expected: 'You see the problem detected, action, reason, current and proposed values, and risk level.' },
      { action: 'Select "Request Approval".', expected: 'The repair is submitted for human approval.' },
      { action: 'An authorised role reviews the repair.', expected: 'They approve, reject or cancel it.' },
      { action: 'On approval, the action executes.', expected: 'The change runs through the secure execution path.' },
      { action: 'Verify the outcome after execution.', expected: 'Verification shows Confirmed, Warning or Failed.' },
    ],
    points: [
      'Repair states: Draft, Pending Approval, Approved, Executing, Completed, Failed, Rejected and Cancelled.',
      'Risk levels: Low, Medium, High and Critical.',
      'Only low and medium risk actions can be executed through this workflow; high and critical risk require a manual administrative process.',
      'A security-related repair must not clear security restrictions without a security review.',
      'A medium-risk repair you requested yourself must be approved by a different authorised staff member.',
      'The Support Repairs page shows Pending Approval, Executing, Failed and Recently Completed queues, with metrics for awaiting approval, failed, completed today and medium-risk pending.',
    ],
    safetyRules: [
      'A recommendation is not approval.',
      'Approval must come from an authorised role.',
      'Check the target site and customer.',
      'Check the requested action and risk.',
      'Read the diagnostic evidence.',
      'Review rollback or recovery information where available.',
      'Do not approve your own assumptions without evidence.',
      'A completed execution still requires verification.',
      'Failed repairs must remain visible for investigation.',
      'Preserve audit evidence.',
    ],
    warning:
      'Support Agent and Developer roles can request repairs but cannot approve or execute them. Approval and execution require the appropriate permissions (Owner, Admin or Support Manager).',
    relatedLinks: [{ label: 'Support Repairs', route: '/support-repairs' }, { label: 'Support Tickets', route: '/support-tickets' }],
  },
  {
    id: 'support-session',
    title: 'Starting a read-only Support Session',
    summary: 'How read-only, time-limited support sessions work.',
    keywords: ['session', 'support session', 'read only', 'duration', 'reason', 'expire', 'end', 'revoke', 'access scope', 'view as customer', 'support access'],
    steps: [
      { action: 'Open the Support Access panel on the ticket (or the Sessions tab on Customer 360).', expected: 'You can see current and previous sessions.' },
      { action: 'Select "Start Support Session".', expected: 'The session request opens.' },
      { action: 'Enter a required reason for access.', expected: 'You state why the read-only view is needed.' },
      { action: 'Choose a duration (15, 30 or 60 minutes).', expected: 'The session is time-limited.' },
      { action: 'Choose the access scope.', expected: 'You select which sections to view.' },
      { action: 'Create the session.', expected: 'You open the read-only, audited view.' },
    ],
    points: [
      'Sessions are read-only and temporary.',
      'Sessions require an active support reason.',
      'Sessions are linked to a ticket or customer context.',
      'Sessions expire automatically — a live countdown is shown.',
      'The requesting staff member can end their own session.',
      'Authorised roles can revoke another staff member\'s session (with a reason).',
      'Session activity is audited — section views are logged.',
      'Session states: Requested, Approved, Active, Expired, Ended, Rejected, Revoked and Failed.',
    ],
    warning:
      'A support session is not remote control and must not be used to impersonate the customer or make changes on their behalf. Any account change must go through the human-approved repair workflow.',
    relatedLinks: [{ label: 'Support Tickets', route: '/support-tickets' }, { label: 'Customers', route: '/customers' }],
  },
  {
    id: 'support-resolution',
    title: 'Saving a resolution and closing the ticket',
    summary: 'How to capture a reusable resolution and close a ticket after verification.',
    keywords: ['resolution', 'save resolution', 'close', 'resolved', 'outcome', 'knowledge base', 'approve', 'verify', 'root cause', 'customer-safe'],
    steps: [
      { action: 'Confirm the customer-visible issue is resolved.', expected: 'The problem is actually fixed.' },
      { action: 'Record the cause where known.', expected: 'The root cause is documented.' },
      { action: 'Record the action that fixed it.', expected: 'The resolution action is clear.' },
      { action: 'Include verification evidence.', expected: 'There is proof the fix worked.' },
      { action: 'Remove secrets and unnecessary personal data.', expected: 'The record is safe and reusable.' },
      { action: 'Make the wording reusable where appropriate.', expected: 'Other staff can reuse it.' },
      { action: 'Save the resolution.', expected: 'It is saved as a draft for approval.' },
      { action: 'Update the ticket status using the real available control.', expected: 'The ticket moves to Resolved or Closed.' },
      { action: 'Confirm no follow-up work remains.', expected: 'Nothing is left open.' },
    ],
    points: [
      '"Save Resolution" collects category, outcome (Resolved, Partially Resolved, Workaround, Escalated, Known Issue), the problem, root cause, diagnostics, the repair/resolution action and a customer-safe summary.',
      'Resolutions are saved as draft and require approval before they can be reused in replies.',
      '"Check for similar" finds existing resolutions to avoid duplicates.',
      'Approved resolutions become part of the reusable resolution memory (Knowledge Base).',
      'Choosing the Resolved status (via the status control) opens a dialog with an optional resolution summary; Closed and Spam require an extra confirmation.',
    ],
    note:
      'Do not close a ticket because a repair merely started. Close it after the outcome has been verified and the customer communication is complete.',
    relatedLinks: [{ label: 'Knowledge Base', route: '/support-knowledge' }, { label: 'Support Tickets', route: '/support-tickets' }],
  },
  {
    id: 'support-preferences',
    title: 'Notification preferences and handover',
    summary: 'Email notification preferences and how to hand over a ticket cleanly.',
    keywords: ['notification', 'preferences', 'email', 'new tickets', 'urgent', 'customer replies', 'assignments', 'overdue', 'daily summary', 'handover', 'save preferences'],
    points: [
      'New tickets — email when a new support ticket arrives.',
      'Urgent tickets — email immediately for urgent or critical tickets.',
      'Customer replies — email when a customer replies to a ticket.',
      'Assignments — email when a ticket is assigned to you.',
      'Overdue tickets — email when a ticket becomes overdue.',
      'Daily summary — a daily digest of your support activity.',
      'Preferences are per-account and saved with "Save preferences".',
    ],
    steps: [
      { action: 'Leave a clear internal note.', expected: 'The next person has context.' },
      { action: 'Record what has already been checked.', expected: 'Work is not repeated.' },
      { action: 'Link relevant diagnostics or repairs using existing records.', expected: 'Evidence is easy to find.' },
      { action: 'State what still needs doing.', expected: 'The next step is clear.' },
      { action: 'Identify deadlines or SLA risk.', expected: 'Urgency is visible.' },
      { action: 'Assign or escalate using the real controls.', expected: 'Ownership is explicit.' },
      { action: 'Do not make the next staff member repeat the investigation unnecessarily.', expected: 'A clean handover.' },
    ],
    relatedLinks: [{ label: 'Notification Preferences', route: '/support-tickets/preferences' }, { label: 'Support Tickets', route: '/support-tickets' }],
  },
];

export const FIRST_SUPPORT_TICKET_CHECKLIST: string[] = [
  'Review the correct queue',
  'Confirm the source site',
  'Confirm the customer',
  'Read the full conversation',
  'Check assignment, priority and SLA',
  'Review previous tickets and resolutions',
  'Run or review permitted triage',
  'Add an internal note if investigation is continuing',
  'Review customer reply before sending',
  'Review diagnostics where relevant',
  'Request authorised action where required',
  'Verify the result',
  'Save the resolution',
  'Complete the customer communication',
  'Update the ticket status',
];

export const FIRST_SUPPORT_TICKET_CHECKLIST_STORAGE_KEY = 'dfp-help-first-support-ticket-checklist';