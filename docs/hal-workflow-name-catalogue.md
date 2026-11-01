# HAL workflow display catalogue

The authenticated HAL inventory supplied on 1 November 2026 contains 59 workflows: 41 in hall-n8n and 18 in leadgen_n8n. The active Operations Wall now resolves their names from an exact instance + workflow-ID catalogue, without requiring further HAL configuration. Publish the frontend to display these labels against existing telemetry.

This is display metadata from a dated inventory, not an agent/dispatch registry. It does not create agent records, approve workflows, enable execution, change n8n activation state, modify the HAL environment or mark any saved relationship verified. The existing registry remains authoritative whenever a run carries an explicit registryWorkflowKey, including its conflict/error states. Catalogue fallback never masks a configured mapping failure.

The saved QuickGuard State Supervisor ID SzPl8DDm3aBAAOjI is absent from both supplied inventories. The observed active master is hd2rIh2umh83tydj, named QuickGuard Master Agent v01.2 - Legacy Detection Fix. These are retained as separate identities; the missing supervisor is not silently rebound to the legacy master.

Names and activation flags come directly from the supplied inventory. Website associations are explicit catalogue configuration based on the workflow's stated product: QuickGuard, GuardianHub, LetHub or Digital Footprint. Sites resolve through the existing active production site registry. Infrastructure workflows are labelled Group infrastructure without a website assignment. My workflow, Adminstration and Local Audit Preflight retain their supplied names with no assumed site.

Activation flags describe the inventory snapshot only. A disabled workflow can have historical saved runs. Execution status and running counts still derive solely from fresh telemetry. Duplicate names remain separate by instance + ID; retired/inactive versions are never substituted for the active version.

The wall labels this source CATALOGUE · 01 NOV and exposes the inventory date/activation observation in the workflow tooltip. AgentName remains null for catalogue entries: a workflow label is not proof that a registered specialist agent is executing a particular step. Current specialist task descriptions and handover tracing still require explicit workflow instrumentation.

Unknown IDs, non-production contexts and duplicate catalogue identities retain the raw-ID fallback. Unavailable/inactive/ambiguous site records show SITE UNRESOLVED. The catalogue is in src/lib/ai-operations/halWorkflowCatalogue.ts; new, deleted, renamed or reassigned workflows require a reviewed inventory refresh. It does not automatically discover future names.

Validation: 16 focused tests pass, including catalogue uniqueness, current-vs-retired identities, instance/environment isolation, configured-conflict precedence, site lookup and stale runtime status. Build and changed-file ESLint pass. Read-only inspection of Command's latest sample found 50 main and 18 secondary runs across 17 distinct workflow IDs, all present in this catalogue. Browser display and published frontend verification remain outstanding.
