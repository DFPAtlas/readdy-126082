# DFPAtlas Repository → Project Master Map

| Repository            | Project / Website                            | Purpose                                                                                       | My classification                        |
| --------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **`readdy-e802f7`**   | **Digital Footprint — digital-footprint.uk** | Main Digital Footprint website, products, client/staff areas and wider DFP ecosystem          | 🟢 **Latest populated DFP website repo** |
| `readdy-e99f01`       | Digital Footprint                            | Short-lived DFP replacement created around v812                                               | 🟠 Superseded copy                       |
| `readdy-becf71`       | Digital Footprint                            | Previous replacement DFP repository                                                           | 🟠 Superseded copy                       |
| `readdy-ce27a5`       | Digital Footprint                            | Older large DFP website build, products/demos/admin system                                    | 🟠 Legacy DFP repo                       |
| `dfp-production-2026` | Digital Footprint                            | Production/certification snapshot of DFP                                                      | 🔵 Production/reference snapshot         |
| **`readdy-126082`**   | **Digital Footprint Command Centre**         | Internal business command system: support, websites, AI operations, UAT, tickets, operations  | 🟢 **Established DFP Command repo**      |
| `readdy-1ba1bb`       | Digital Footprint Command Centre             | Newer copy of Command Centre v111                                                             | 🟡 Newer duplicate/copy                  |
| **`readdy-484bac`**   | **QuickGuard.uk**                            | Security guard marketplace: clients, guards, jobs, held payments, Stripe, admin               | 🟢 **Latest populated QuickGuard repo**  |
| `readdy-0677ef`       | QuickGuard.uk                                | Earlier QuickGuard codebase                                                                   | 🟠 Legacy QuickGuard                     |
| **`readdy-7a0cf7`**   | **LetHub.uk**                                | UK property/lettings platform with multi-role dashboards and Supabase                         | 🟢 Main LetHub repo                      |
| **`readdy-1a84b8`**   | **Wedora**                                   | Wedding-planning SaaS, couples, guests, RSVPs, seating, budget, travel and wedding sites      | 🟢 Main Wedora repo                      |
| **`readdy-5650b0`**   | **GarageFlow**                               | AI operating system for independent UK garages                                                | 🟢 Main GarageFlow repo                  |
| **`readdy-cdd678`**   | **Forge**                                    | Local-first AI website development workspace/sandbox                                          | 🟢 Main Forge repo                       |
| **`readdy-15db91`**   | **SiteLedger**                               | UK contractor/construction operating system                                                   | 🟢 Main SiteLedger repo                  |
| **`readdy-d9b25c`**   | **Both Sides**                               | Community dispute platform with cases, evidence, panel voting and resolution                  | 🟢 Main Both Sides repo                  |
| **`readdy-1261f3`**   | **Security Services / Forms & Reports Hub**  | Rota, incidents, CCTV, external checks, comms rooms, ID cards, DOB, forms and reporting       | 🟢 Main Forms/Security portal repo       |
| `readdy-5f4d28`       | **DFP AI UAT Agent Control Centre**          | Automated browser UAT, Playwright, n8n, AI reviewers, evidence, release approval and recovery | ⚫ Archived specialist repo               |
| `readdy-849de5`       | Unknown                                      | Repository contains no populated application                                                  | 🔴 Empty                                 |
| `readdy-4b53f2`       | Unknown                                      | Initial commit only; Readdy application push did not populate the repository                  | 🔴 Empty / failed push                   |
| `readdy-4036c1`       | Unknown                                      | Initial commit only                                                                           | 🔴 Empty                                 |
| `readdy-2f1f48`       | Unknown                                      | Initial commit only                                                                           | 🔴 Empty                                 |
| `readdy-1df9e5`       | Unknown                                      | Initial commit only                                                                           | 🔴 Empty                                 |
| `readdy-e0bf2f`       | Unknown                                      | Initial commit only                                                                           | 🔴 Empty                                 |
| `readdy-77cdeb`       | Unknown                                      | Initial commit only                                                                           | 🔴 Empty                                 |
| `readdy-b264df`       | Unknown                                      | Initial commit only                                                                           | 🔴 Empty                                 |
| `readdy-fd092d`       | Unknown                                      | Initial commit only                                                                           | 🔴 Empty                                 |

## What I confirmed from the repositories

### Digital Footprint

`readdy-e802f7`, `e99f01`, `becf71`, `ce27a5` and `dfp-production-2026` are all from the **Digital Footprint website family**. Their code identifies `digital-footprint.uk`, Digital Footprint branding and the same business-system positioning.

GitHub history is particularly useful here. The sequence is approximately:

**`ce27a5` → `becf71` → `e99f01` → `e802f7`**

The latest populated DFP repo I can see is **`DFPAtlas/readdy-e802f7`**, with a Readdy commit:

**Digital-Footprint.uk – v850 — 26 August 2026**

So for future scans of your **current DFP website**, I would use:

**`DFPAtlas/readdy-e802f7`**

`dfp-production-2026` is different: its latest activity is from **16 August 2026** and contains build-certification work, so I would keep that as a production/reference snapshot rather than treating it as the working Readdy repo.

### DFP Command Centre

`readdy-126082` explicitly identifies itself as the **Digital Footprint Command Centre**, and contains the Website UAT/change-control system as well.

`readdy-1ba1bb` contains effectively the same Command Centre project plan.

GitHub history shows:

**`126082` — Digital Footprint Command Center v111 — 25 August**

followed by:

**`1ba1bb` — Digital Footprint Command Center v111 — 25 August**

So `1ba1bb` appears to be a **new repo/copy of the same v111 build**, rather than a different product.

For all the AI Operations, support ticketing and business-management work we have been doing, I would keep **`126082` as the recognised Command repository** unless you deliberately switch the Readdy project to `1ba1bb`.

### QuickGuard

Both `readdy-0677ef` and `readdy-484bac` are unquestionably **QuickGuard.uk**. Their application metadata names QuickGuard and points to `https://quickguard.uk`.

The important difference is version history:

**`0677ef`**
QuickGuard v1937 — 1 August 2026

**`484bac`**
QuickGuard v2018 — **25 August 2026**

Therefore I would now treat:

**`DFPAtlas/readdy-484bac` = current populated QuickGuard GitHub source**

and

**`DFPAtlas/readdy-0677ef` = older QuickGuard backup/history**

### LetHub

`readdy-7a0cf7` has an explicit README:

> LetHub is a multi-role UK property-management platform

and documents its Supabase-backed dashboards and production deployment.

So:

**`DFPAtlas/readdy-7a0cf7` = LetHub.uk**

### Wedora

`readdy-1a84b8` explicitly identifies itself as:

**Wedora — Wedding Planning SaaS Platform**

It contains wedding sites, couples, guests, invitations, RSVP, budget, seating, travel concierge and demo mode.

So:

**`DFPAtlas/readdy-1a84b8` = Wedora**

### GarageFlow

`readdy-5650b0` explicitly identifies itself as:

**GarageFlow — AI Operating System for Independent Garages**

with workshop booking, customers, vehicles, digital job cards, parts, payments, MOT reminders, AI receptionist and reporting.

So:

**`DFPAtlas/readdy-5650b0` = GarageFlow**

### Forge

`readdy-cdd678` explicitly identifies itself as **Forge**, your local-first AI development workspace containing projects, sandbox, files, assets, builds, versions, exports, agents and local AI integrations.

So:

**`DFPAtlas/readdy-cdd678` = Forge**

### SiteLedger

`readdy-15db91` identifies itself as:

**SiteLedger — UK Contractor Operating System**

covering jobs, workforce, clients, variations, evidence, procurement, CIS, payments, accounting integrations, mobile working and AI.

So:

**`DFPAtlas/readdy-15db91` = SiteLedger**

### Both Sides

`readdy-d9b25c` identifies itself as **Both Sides**, the UK community dispute platform with two-party cases, evidence, moderation, community panels and non-binding outcomes.

So:

**`DFPAtlas/readdy-d9b25c` = Both-Sides.uk**

### Security / Forms & Reports Hub

`readdy-1261f3` contains the **Security Services Portal**, including:

Dashboard, rota management, reports, KPI dashboard, incident reports, CCTV incidents, external/fire-door inspections, comms-room logs, ID cards, Daily Occurrence Book and general forms.

That matches your **Forms & Reports / security operations portal**.

So:

**`DFPAtlas/readdy-1261f3` = Forms & Reports / Security Services Portal**

### DFP AI UAT system

`readdy-5f4d28` identifies itself as the:

**DFP AI UAT Agent Control Centre**

for automated UAT with n8n, Playwright browser workers, Ollama/AI reviewers, bugs, evidence, visual baselines, release governance and disaster recovery.

GitHub marks this repository as **archived**.

## The nine empty repositories

These nine repos currently contain effectively **no application source**:

`readdy-849de5`
`readdy-4b53f2`
`readdy-4036c1`
`readdy-2f1f48`
`readdy-1df9e5`
`readdy-e0bf2f`
`readdy-77cdeb`
`readdy-b264df`
`readdy-fd092d`

They each contain only an **Initial commit**, created between:

**26 August 2026 17:39 UTC** and **27 August 2026 01:57 UTC**.

That pattern is strongly consistent with the Readdy → GitHub push problem you were seeing: the repository gets created, but the actual Readdy project never makes it into GitHub.

I would **not delete these yet**. First we should identify which Readdy project created each one; then we can decide whether to retry the push or remove the abandoned repo.

# Recommended canonical repo register

For day-to-day work I would currently use:

| Project                       | Canonical repo                      |
| ----------------------------- | ----------------------------------- |
| **Digital Footprint website** | **`DFPAtlas/readdy-e802f7`**        |
| **DFP Command Centre**        | **`DFPAtlas/readdy-126082`**        |
| **QuickGuard**                | **`DFPAtlas/readdy-484bac`**        |
| **LetHub**                    | **`DFPAtlas/readdy-7a0cf7`**        |
| **Wedora**                    | **`DFPAtlas/readdy-1a84b8`**        |
| **GarageFlow**                | **`DFPAtlas/readdy-5650b0`**        |
| **Forge**                     | **`DFPAtlas/readdy-cdd678`**        |
| **SiteLedger**                | **`DFPAtlas/readdy-15db91`**        |
| **Both Sides**                | **`DFPAtlas/readdy-d9b25c`**        |
| **Forms / Security Portal**   | **`DFPAtlas/readdy-1261f3`**        |
| **DFP AI UAT Agent**          | `DFPAtlas/readdy-5f4d28` — archived |