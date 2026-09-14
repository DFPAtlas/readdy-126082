# DFP Command

**DFP Command is Digital Footprint's internal operating system** for managing
its entire project portfolio — from initial idea through planning, development,
AI operations, testing, deployment, monitoring, support, commercial operation
and continuous improvement.

It is **not** a public consumer application. Sites such as QuickGuard,
GuardianHub, LetHub, BuildNerve, Vowora and GarageFlow are **managed projects
inside DFP Command**.

## Who it is for

Digital Footprint's internal operators: portfolio and project managers, build /
UAT / launch staff, AI operations, support and commercial teams.

## Core architecture principle

`internal_projects` is the canonical project identity. Every project-aware
module (Build, Bugs, UAT, Budget, Support, Monitoring, Launch, Deployment,
Operations, AI) relates back to `internal_projects.id`, and DFP Command
**aggregates** subsystem state around that project rather than duplicating it.
Global module pages are fleet-wide; the Project Command Centre
(`/projects/:slug`) is the filtered project view.

## Development / setup

- **Stack:** React 19 + Vite + TailwindCSS + TypeScript (SPA).
- **Backend:** Readdy Backend or SaaS Supabase (Auth, Database, Storage, Edge
  Functions). Not yet connected in this baseline.
- **Runtime:** a private runtime bridge (`runtime-bridge/`) relays telemetry for
  runtime nodes such as HAL and TRON.

See `project_plan.md` for the full Product Charter.