# Digital Footprint Command Centre

## 1. Project Description
A centralized dashboard where users can monitor, analyze, and manage their digital footprint across various online platforms. Users log in to see an overview of their online presence, privacy scores, data exposure, and platform-specific insights. Think of it as a mission control for your digital life.

- **Target users**: Privacy-conscious individuals, professionals managing their online reputation
- **Core value**: One unified view of where your data lives online, with actionable insights to take control

## 2. Page Structure
- `/` - Public landing page (product overview, value proposition, CTA to sign up)
- `/login` - Login page
- `/signup` - Registration page
- `/dashboard` - Main dashboard (protected, requires auth)
- `/dashboard/platform/:id` - Platform detail view (deep dive into a specific platform's footprint)
- `/dashboard/privacy-scan` - Privacy scan & recommendations
- `/dashboard/settings` - User settings & preferences

## 3. Core Features
- [x] User authentication UI (login / signup pages) — real auth pending Supabase connection
- [x] Public landing page with product value proposition
- [ ] Main dashboard with digital footprint overview
- [ ] Privacy score visualization and metrics
- [ ] Platform-by-platform footprint breakdown
- [ ] Privacy scan with actionable recommendations
- [ ] User settings and profile management

## 4. Data Model Design
(Supabase database needed)

### Table: profiles
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key, linked to auth.users |
| full_name | text | User's display name |
| avatar_url | text | Profile avatar URL |
| privacy_score | integer | Overall privacy score (0-100) |
| connected_platforms | integer | Number of monitored platforms |
| created_at | timestamptz | Account creation time |
| updated_at | timestamptz | Last update time |

### Table: platforms
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to profiles |
| platform_name | text | e.g. Google, Facebook, Instagram |
| platform_icon | text | Icon identifier |
| risk_level | text | low / medium / high |
| data_points | integer | Number of data points tracked |
| last_scan | timestamptz | Last scan timestamp |
| status | text | active / warning / critical |

### Table: privacy_scans
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to profiles |
| scan_date | timestamptz | When scan ran |
| overall_score | integer | Overall privacy score |
| vulnerabilities | integer | Issues found |
| recommendations | jsonb | List of recommendations |

## 5. Backend / Third-party Integration Plan
- **Supabase**: Required for user authentication, database, and edge functions

## 6. Development Phase Plan

### Phase 1: Public Landing Page + Auth Pages ✅ COMPLETED
- Goal: Set up the public-facing landing page and login/signup UI
- Deliverable: Beautiful dark-themed landing page with 7 sections (Hero, About, Features, Platforms, Testimonials, CTA, Footer), login page, signup page with mock auth flow

### Phase 2: Main Dashboard Overview
- Goal: Build the post-login dashboard with key metrics and footprint overview
- Deliverable: Full dashboard with privacy score, platform cards, charts, and navigation
- Requires: Supabase connection for real auth + data

### Phase 3: Platform Detail & Privacy Scan
- Goal: Deep-dive platform views and privacy scan feature
- Deliverable: Platform detail page, privacy scan page with recommendations

### Phase 4: User Settings & Polish
- Goal: Settings page, profile management, final polish
- Deliverable: Settings page, animations, final refinements

## 7. Website UAT & Change Control ✅ COMPLETED
- **Main page**: `/admin/website-uat` — Dashboard with summary cards and 7 tabs
- **Database**: 10 new tables (internal_websites, internal_website_changes, internal_page_reviews, internal_page_review_items, internal_links, internal_image_changes, internal_uat_test_runs, internal_uat_test_items, internal_approval_queue, internal_deployment_readiness)
- **Tab 1 - Website Register**: Add/manage websites with live/staging URLs, status, owner, project linking
- **Tab 2 - Website Changes**: Full CRUD change request system with before/after fields, copy-to-Readdy-prompt, filters
- **Tab 3 - Page Review**: 21-item checklist per page review with pass/fail/NA/needs_review
- **Tab 4 - Link Checker**: Manual link tracking with broken-to-top sorting, one-click mark working/broken
- **Tab 5 - Image Manager**: Side-by-side current/new image display, alt text, copy prompt button
- **Tab 6 - UAT Test Runs**: Test runs with items, pass/fail/severity, copy fix prompt for failures
- **Tab 7 - Approval Queue**: Approve/reject/send-back workflow, deployment readiness score cards per website
- **Sidebar**: New "Website UAT & Changes" section with 7 nav items
- **Seeded**: 5 websites, 12 changes, 8 page reviews with items, 15 links, 5 image changes, 5 UAT test runs with items, 6 approval queue items, 5 deployment readiness records

## 8. AI Operations — Group Agent Network (Prompt 01) ✅ COMPLETED
- **Route**: `/ai-operations` overview — redesigned as a visual control centre for all Digital Footprint sites.
- **Centre**: DFP Group Oversight / Atlas Tron (group orchestrator) + TRON oversight + HAL execution-host status (runtime connectivity kept separate from confirmed oversight activity).
- **First ring**: one manager position per site in the Group Site Registry (site-scoped orchestration agents); missing/duplicate managers surfaced honestly (never silently collapsed).
- **Second ring**: clicking a site fans its sub-agents outward (site membership, not a verified execution dependency); shared/group agents stay in a separate expandable inner group.
- **Data**: reuses the shared group live-data store, saved wall-widget config (name/initials/colour), and runtime-health store — no new registry, no per-card polling. The Forge uses `the-forge` / `TF`; no hard-coded site list.
- **Controls**: site/host/status filters, agent search, Diagram/List toggle, expand/collapse all, zoom/pan/fit/reset; agent-selection details panel links into existing agent/site detail pages.
- **Honesty**: edges animate only on fresh `working` run evidence; missing data never becomes a green state or fabricated zero; respects prefers-reduced-motion.
- **Files**: `src/pages/ai-operations/network/*` (selectors, diagram, list, detail panel, styles) + `src/pages/ai-operations/page.tsx`.

## 9. AI Operations — Agent Deployment Subpage (Prompt 03) ✅ COMPLETED
- **Route**: `/ai-operations/agent-deployment` — group-wide agent setup + deployment-readiness workflow (sidebar nav + overview "Deploy Agent" button).
- **List**: every registered agent as a saved setup — role (site manager / sub-agent / shared), site, parent manager, runtime + workflow mapping, setup stage, last validation result, with Continue setup / View agent actions.
- **Wizard (6 steps)**: Identity & site (template picker incl. LetHub-only templates) → Manager assignment (same-site, cycle/self/cross-site blocked, duplicate managers flagged) → Runtime & workflow (registered runtime node + approved n8n workflow) → Permissions & schedule (read-only supervision default) → Validate (connection validation vs dispatch preview vs test execution kept distinct) → Review & finish.
- **Templates**: Blank for any site; 12 optional LetHub draft templates (definitions only — never auto-created).
- **Persistence**: minimal extension to `ai_operations_agents` (parent_agent_id, workflow_id, runtime_reference, responsibility, setup_stage, last_validated_at/result, deployment_status, approval_required, data_scope) + self-parent CHECK + cycle/cross-site BEFORE trigger; reuses existing owner/admin RLS. Drafts persist to Supabase (never localStorage) and reopen after refresh.
- **Honesty**: there is NO "deployed" status — activation is not connected ("Ready for deployment — activation not connected"); saving never starts a workflow or alters a runtime gate.
- **Files**: `src/pages/ai-operations/agent-deployment/*`, `supabase/migrations/202609240000_ai_agent_deployment.sql`.