# DFP Command — Product Charter

> **Document:** DFP Command Product Charter
> **Status:** Canonical
> **Last Updated:** 2026-09-14
> **Build Baseline:** DFP-COMMAND-17A

---

## 1. What DFP Command is

**DFP Command is Digital Footprint's internal operating system for managing its
entire project portfolio** — from initial idea through planning, development, AI
operations, testing, deployment, monitoring, support, commercial operation and
continuous improvement.

DFP Command is **not**:

- a public consumer application;
- a security-guard management application;
- a consumer "digital footprint" / privacy-scoring product.

Individual sites such as **QuickGuard**, **GuardianHub**, **LetHub**,
**BuildNerve**, **Vowora**, **GarageFlow**, **Forge**, **SiteLedger** and others
are **managed projects inside DFP Command** — they are not the definition of DFP
Command itself. The canonical architectural centre is the **Digital Footprint
project portfolio**, not any single managed site.

---

## 2. Canonical project entity

`internal_projects` is the canonical root entity for a Digital Footprint
project. Every project-aware module relates back to `internal_projects.id`
(never by project name):

Build · GitHub/Readdy · Infrastructure · AI Site · UAT · Bugs · Change
Requests · Budget · Support · Monitoring · Launch · Deployment · Operations ·
Activity.

`internal_projects` is **platform-managed** (created outside the migration
files) and is treated as the source of truth for project identity. Project-name
based relationships are discouraged.

---

## 3. Project lifecycle

Intended lifecycle:

```
Idea → Project Created → Planning → Build → AI / Integrations → Development
→ UAT → Bugs / Changes → Launch Readiness → Launch Approval → Deployment
→ Production Verification → Live → Operations → Maintenance → Continuous Improvement
```

Each subsystem (Build, UAT, Bugs, Budget, Monitoring, Launch, Deployment, AI
Operations) remains its **own source of truth**; DFP Command **aggregates** them
around the canonical project. DFP Command does not duplicate or overwrite
subsystem records.

---

## 4. Core product areas

**PORTFOLIO** — Projects, Roadmap, Ideas, Executive Dashboard.

**BUILD** — Build Process, Bugs, Change Requests, UAT, Launch Control,
Deployment.

**AI OPERATIONS** — Sites, Agents, Runs, Approvals, Orchestrator, Tools, Models,
Knowledge, Security, Alerts, Runtime Health.

**OPERATIONS** — Monitoring, Infrastructure, Support, Incidents, Wallboard,
Operations, Maintenance.

**BUSINESS** — Budgets, Costs, Revenue, Commercial Position, Team, Reports.

---

## 5. Project Command Centre

`/projects/:slug` is the central project operating workspace. Its implemented
sections are:

Overview · Build · GitHub · Infrastructure · AI Ops · UAT · Bugs · Changes ·
Budget · Support · Monitoring · Launch · Deployment · Operations · Activity ·
Files.

---

## 6. Global vs project views

Architectural rule:

- **Global module pages remain portfolio/fleet-wide.**
- **Project Command Centre pages are filtered project views.**

Examples:

| Global view | Project view |
| --- | --- |
| Global AI Operations — all sites / agents / runtimes | Project AI Ops — selected project's AI state |
| Global Budget — portfolio finance | Project Budget — selected project's finance |
| Global Support — all tickets | Project Support — selected project's support |

Do not rebuild duplicate subsystem engines inside Project Detail; the Command
Centre consumes the same canonical data scoped to one project.

---

## 7. Project integration model

`internal_project_integrations` is the canonical integration/configuration
record (one primary record per project, related via `project_id →
internal_projects.id`). It holds identifiers/configuration for:

GitHub · Readdy · Supabase · Hosting · DNS · Runtime · Monitoring.

Important distinctions:

- **configuration ≠ connection**
- **configuration ≠ verification**
- **configuration ≠ health**

AI site ownership remains canonical through the AI Operations relationship (an
AI site record carries its `internal_project_id`); it is not duplicated into the
integration record.

---

## 8. Status model

Shared status semantics (introduced in 16B):

| Status | Meaning |
| --- | --- |
| `CONFIGURED` | Configuration fields are populated. Says nothing about connectivity or health. |
| `CONNECTED` | A genuine connection/verification exists. |
| `VERIFIED` | Connection has been actively confirmed. |
| `HEALTHY` | Live telemetry reports a healthy state. |
| `DEGRADED` | Live telemetry reports degraded but functional. |
| `CRITICAL` | Live telemetry reports a critical condition. |
| `OFFLINE` | A configured/runtime target is not reachable. |
| `STALE` | Cached/last-known telemetry has exceeded its freshness threshold. |
| `UNAVAILABLE` | The required source could not be loaded. |
| `UNKNOWN` | No authoritative source exists to determine state. |
| `NOT CONFIGURED` | No configuration has been provided. |
| `NOT REQUIRED` | The subsystem is not applicable to this project. |

Invariants:

- No data must never default to `HEALTHY`.
- A failed query must never become "zero alerts" — it is `UNAVAILABLE`.
- `CONFIGURED` must never automatically mean `CONNECTED`.

---

## 9. Data provenance

DFP Command distinguishes four provenance classes:

- **Live Data** — current authoritative source (e.g. runtime telemetry).
- **Configured Data** — registry/planned/metadata (e.g. site registry).
- **Demo / Supporting Metadata** — clearly labelled placeholder.
- **Unknown** — no authoritative source exists.

Demo/supporting metadata must never be presented as live telemetry. This is
especially important in AI Operations (see
`docs/operations-wall-data-provenance.md` for the full per-value provenance
record of the Operations Wall).

---

## 10. GitHub / Readdy safety

These actions are **not equivalent sync operations**:

- **Readdy → GitHub Push** may replace the contents of the repository main
  branch. Before a significant push: confirm the repository, record the current
  SHA, preserve a rollback point, and confirm no external work will be lost.
- **GitHub → Readdy Pull** creates a new Readdy version snapshot.

---

## 11. Launch safety

Intended launch control chain:

```
Build Ready → UAT Approved → Critical Bugs Clear → Commercial Blockers Clear
→ Infrastructure Ready → Monitoring Ready → Launch Approval → Approved SHA Locked
→ Deployment → Production Verification → Production Acceptance → Live
```

Distinct steps that must not be conflated:

- **Launch Approval is not Deployment.**
- **Deployment is not Verification.**
- **Verification is not Production Acceptance.**

---

## 12. Deployment safety

- Deployment must use the approved SHA.
- Code changes after approval require re-evaluation.
- Failed deployments remain in history.
- Rollback redeploys known-good code; it must **never** rewrite Git history.
- A project becomes `Live` only after production verification and acceptance.

---

## 13. Runtime architecture

DFP Command is the **control/visibility layer** over runtime nodes. Runtime
nodes may include **HAL** (`atlas-hal-runtime-01`), **TRON**
(`atlas-tron-runtime-01`), and other future runtimes.

- Runtime health comes from **real telemetry** (heartbeats), never from registry
  presence alone.
- A node that exists in a registry but has no telemetry is `Not Registered` /
  `Unknown`, not `Online`.
- Destructive runtime controls are documented only where actually implemented
  and protected.

---

## 14. AI Operations architecture

```
Project → AI Site → Master Agent → Sub-agents → Runs → Approvals → Runtime → Alerts
```

- **Global AI Operations** remains fleet-wide (all sites / agents / runtimes).
- **Project AI Operations** is the filtered project view of that state.

---

## 15. Security principles

- RLS remains enforced on project/integration/workstream tables.
- Privileged actions stay server-side (Edge Functions).
- Secrets must not be stored in integration records (identifiers/configuration
  only).
- No service-role keys in the browser.
- No API tokens in activity logs.
- Destructive actions require authorization and audit.
- Read-only operational views must not bypass source permissions.

---

## 16. Source of truth table

| Concern | Canonical table |
| --- | --- |
| Project identity | `internal_projects` (platform-managed) |
| Project integrations | `internal_project_integrations` |
| Build | `internal_build_process_runs` / `internal_build_process_run_items` |
| Bugs | `internal_bugs` |
| Changes | `internal_change_requests` |
| Budget | `internal_project_budgets` (+ cost / recurring-cost tables) |
| Activity | `internal_activity_log` |
| UAT | `uat_*` tables |
| AI | `ai_sites` + `ai_operations_*` registry tables |
| Deployments | `internal_project_deployments` |
| Maintenance | `internal_project_maintenance` |
| Reviews | `internal_project_reviews` |
| Monitoring | `internal_monitored_websites` (+ monitoring tables) |
| Support | `internal_support_tickets` (+ `support_*` tables) |

---

## 17. Documentation truth rule

Documentation describes **implemented reality**. If a feature is planned but not
built, label it **Planned**. Do not write planned features as if they already
exist.

---

## 18. AI / coding agent guidance

Never redesign DFP Command around a single managed site. QuickGuard,
GuardianHub, LetHub, BuildNerve, Vowora, GarageFlow and other products are
**managed projects**, not the definition of DFP Command. The canonical
architectural centre is the **Digital Footprint project portfolio**, keyed by
`internal_projects.id`.