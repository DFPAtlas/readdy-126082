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