# DFP COMMAND 16C — PERFORMANCE + QUERY CLEANUP

## Build tag

`DFP-COMMAND-16C-PERFORMANCE-QUERY-CLEANUP`

## Scope

Reduce repeated data fetching, duplicated queries, and unnecessary per-project
requests across the Project Command Centre, Projects Portfolio, and Executive
Dashboard — **without changing business logic, status meanings, lifecycle rules,
deployment behaviour, or external integrations.**

---

## Audit findings (what was actually duplicated vs. already clean)

### Already optimised (no change required — confirmed during audit)

These were put in place by 15A / 15B / 16A and are left untouched:

| Concern | State |
| --- | --- |
| Portfolio N+1 | `usePortfolio` already bulk-loads every source with `.in('project_id', ids)` — a single query per table, no per-project loop. |
| Executive Dashboard | Reuses `usePortfolio` + aggregate/limited queries (`deployments .limit(30)`, `activity .limit(20)`, counts via `.select('id')`). |
| Shared integration query | `useProjectInfrastructure` is instantiated **once** in `page.tsx` and threaded into Overview / GitHub / Infrastructure / Monitoring / Launch / Deployment / Operations (16A). |
| Shared status helpers | `computeBudgetSummary`, `deriveProjectHealth`, `computeMonitoringSummary`, `evaluateLaunch`, `evaluateDeployment`, `buildActivityTimeline` are single, shared pure helpers. |
| Shared formatters | `formatRelative` / `formatDate` (`utils.ts`), `formatMoney` / `statusLabel` (`budgetUtils.ts`) are reused across Portfolio, Dashboard and Command Centre. |
| Minimal columns for counts | Portfolio already selects only `id,project_id,severity,status` (bugs) and `id,project_id,priority,status` (tickets); Dashboard uses `.select('id')` for build counts. |
| Error isolation | `useProjectMonitoring` uses `Promise.allSettled`; the portfolio `bulk()` helper and Dashboard `bulk()` helper catch per-source and surface `Unknown`/`Unavailable` rather than fabricating zeros. |
| Freshness honesty | `deriveProjectHealth` never manufactures `HEALTHY`; stale telemetry → `STALE`/`UNKNOWN` via `freshness()` (`monitoringUtils.ts`). |

### The one concrete gap found and fixed

The high-frequency `project_id` filter paths on the **workstream / budget /
monitoring / activity tables had no indexes**. Every portfolio `.in('project_id')`
and every detail-section `.eq('project_id')` was a full table scan.

**Fix:** `supabase/migrations/202610050000_performance_query_indexes.sql` adds
minimal, additive `CREATE INDEX IF NOT EXISTS` composite indexes on the exact
columns the queries filter/order by. No speculative indexes — every one maps to
a real `.in` / `.eq` / `.order` pattern observed in the hooks.

---

## Deferred (deliberately not done this pass)

The command's §4 / §40 target — **lazy section loading** (Overview should not
fetch full subsystem history) — is real but was intentionally deferred:

- The Overview's **Launch / Deployment cards depend on `evaluateLaunch`, which
  pulls in build + UAT + bugs + budget + support + monitoring + approval** to
  compute a single gate decision. Splitting "summary" from "full" load therefore
  requires a per-hook `summary` vs `full` mode across ~9 hooks, which risks
  subtle behaviour changes (exactly what §43 forbids in a single pass).
- `useProjectActivity` currently loads a bounded 200 rows, shared by the
  Overview (latest 5) and the Activity section (client-side filters + CSV).
  Source-level pagination would break the Activity section's client-side
  time-range filter, so it was left as-is.

These remain the highest-value next step and should be tackled as a dedicated,
carefully-tested follow-up (not bundled with unrelated changes).

---

## Non-changes (verified)

- No status meanings, lifecycle rules, approval logic, deployment workflow, or
  financial formulas changed.
- No RLS / authorization bypass; no broad service-role queries introduced.
- No external integrations, monitoring thresholds, or DNS/hosting touched.
- No UI redesign; loading/error semantics preserved (failed ≠ empty, stale ≠ healthy).