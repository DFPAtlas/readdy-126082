-- ============================================================================
-- AI Operations — Cost, Usage & Budgets (Phase 2 Prompt 15).
--
-- Persists AI Operations financial/usage CONTROL-PLANE METADATA only. This
-- phase does NOT call Stripe, OpenAI/Anthropic/Ollama billing, collect live
-- provider usage, charge customers, enforce spending limits, stop agents,
-- trigger n8n, or execute agents.
--
--   * ai_budgets        — budget registry (configuration + reporting metadata).
--   * ai_usage_costs    — append-oriented usage/cost records (historical).
--   * ai_budget_events  — append-oriented budget threshold/governance history.
--
-- Budget values are NOT enforced against runtime yet. Migrated rows are
-- honestly marked (`is_estimate = true`, `cost_source = 'demo_migrated'`,
-- and `(migrated demo baseline)` notes) — no production provider usage is
-- fabricated and no live threshold monitor is claimed to have triggered them.
-- ============================================================================

-- --- 2. ai_budgets ------------------------------------------------------------

create table if not exists ai_budgets (
  id uuid primary key default gen_random_uuid(),
  budget_key text unique not null,
  name text not null,
  description text,
  scope_type text not null default 'group',
  scope_reference text,
  site_id uuid references ai_sites(id) on delete set null,
  agent_id uuid references ai_operations_agents(id) on delete set null,
  model_id uuid references ai_operations_models(id) on delete set null,
  provider_id uuid references ai_model_providers(id) on delete set null,
  environment text not null default 'production',
  period_type text not null default 'monthly',
  currency text not null default 'GBP',
  budget_amount numeric,
  warning_threshold_percent integer,
  critical_threshold_percent integer,
  current_usage_amount numeric not null default 0,
  forecast_amount numeric,
  status text not null default 'healthy',
  starts_at timestamptz,
  ends_at timestamptz,
  owner_team text,
  approval_required boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --- 3. ai_usage_costs --------------------------------------------------------

create table if not exists ai_usage_costs (
  id uuid primary key default gen_random_uuid(),
  usage_key text unique not null,
  occurred_at timestamptz not null default now(),
  site_id uuid references ai_sites(id) on delete set null,
  agent_id uuid references ai_operations_agents(id) on delete set null,
  run_id uuid references ai_runs(id) on delete set null,
  model_id uuid references ai_operations_models(id) on delete set null,
  provider_id uuid references ai_model_providers(id) on delete set null,
  usage_type text,
  source_type text,
  source_reference text,
  input_units numeric,
  output_units numeric,
  total_units numeric,
  unit_type text,
  estimated_cost numeric,
  actual_cost numeric,
  currency text not null default 'GBP',
  cost_source text,
  environment text not null default 'production',
  correlation_id text,
  is_estimate boolean not null default false,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- --- 4. ai_budget_events ------------------------------------------------------

create table if not exists ai_budget_events (
  id uuid primary key default gen_random_uuid(),
  event_key text unique not null,
  budget_id uuid references ai_budgets(id) on delete restrict,
  event_type text not null,
  threshold_percent integer,
  observed_amount numeric,
  budget_amount numeric,
  forecast_amount numeric,
  status text not null default 'open',
  severity text not null default 'info',
  acknowledged boolean not null default false,
  acknowledged_by text,
  acknowledged_at timestamptz,
  summary text,
  created_at timestamptz not null default now()
);

-- --- 5. Indexes ---------------------------------------------------------------

create index if not exists ai_budgets_scope_idx on ai_budgets (scope_type);
create index if not exists ai_budgets_site_idx on ai_budgets (site_id);
create index if not exists ai_budgets_agent_idx on ai_budgets (agent_id);
create index if not exists ai_budgets_model_idx on ai_budgets (model_id);
create index if not exists ai_budgets_provider_idx on ai_budgets (provider_id);
create index if not exists ai_budgets_env_idx on ai_budgets (environment);
create index if not exists ai_budgets_status_idx on ai_budgets (status);
create index if not exists ai_budgets_active_idx on ai_budgets (is_active);

create index if not exists ai_usage_costs_occurred_idx on ai_usage_costs (occurred_at);
create index if not exists ai_usage_costs_site_idx on ai_usage_costs (site_id);
create index if not exists ai_usage_costs_agent_idx on ai_usage_costs (agent_id);
create index if not exists ai_usage_costs_run_idx on ai_usage_costs (run_id);
create index if not exists ai_usage_costs_model_idx on ai_usage_costs (model_id);
create index if not exists ai_usage_costs_provider_idx on ai_usage_costs (provider_id);
create index if not exists ai_usage_costs_type_idx on ai_usage_costs (usage_type);
create index if not exists ai_usage_costs_env_idx on ai_usage_costs (environment);
create index if not exists ai_usage_costs_corr_idx on ai_usage_costs (correlation_id);

create index if not exists ai_budget_events_budget_idx on ai_budget_events (budget_id);
create index if not exists ai_budget_events_type_idx on ai_budget_events (event_type);
create index if not exists ai_budget_events_severity_idx on ai_budget_events (severity);
create index if not exists ai_budget_events_created_idx on ai_budget_events (created_at);
create index if not exists ai_budget_events_ack_idx on ai_budget_events (acknowledged);

-- --- 6. RLS -------------------------------------------------------------------

alter table ai_budgets enable row level security;
alter table ai_usage_costs enable row level security;
alter table ai_budget_events enable row level security;

-- Budgets: SELECT staff; INSERT/UPDATE owner/admin; no DELETE.
create policy ai_budgets_select on ai_budgets
  for select to authenticated using (internal_role() is not null);
create policy ai_budgets_insert on ai_budgets
  for insert to authenticated with check (internal_role() = any (array['owner','admin']));
create policy ai_budgets_update on ai_budgets
  for update to authenticated
  using (internal_role() = any (array['owner','admin']))
  with check (internal_role() = any (array['owner','admin']));

-- Usage costs: SELECT staff; INSERT owner/admin; no UPDATE/DELETE.
create policy ai_usage_costs_select on ai_usage_costs
  for select to authenticated using (internal_role() is not null);
create policy ai_usage_costs_insert on ai_usage_costs
  for insert to authenticated with check (internal_role() = any (array['owner','admin']));

-- Budget events: SELECT staff; INSERT owner/admin; no UPDATE/DELETE.
-- Acknowledgement is a restricted UPDATE on acknowledgement fields only.
create policy ai_budget_events_select on ai_budget_events
  for select to authenticated using (internal_role() is not null);
create policy ai_budget_events_insert on ai_budget_events
  for insert to authenticated with check (internal_role() = any (array['owner','admin']));
create policy ai_budget_events_ack_update on ai_budget_events
  for update to authenticated
  using (internal_role() = any (array['owner','admin']))
  with check (internal_role() = any (array['owner','admin']));

-- ============================================================================
-- Seeds (idempotent). Configuration/reporting metadata only — no enforcement,
-- no live provider billing, no live monitor triggers claimed.
-- ============================================================================

-- --- 7. Initial budgets -------------------------------------------------------

insert into ai_budgets (
  budget_key, name, scope_type, scope_reference,
  site_id, agent_id, model_id, provider_id,
  environment, period_type, currency,
  budget_amount, warning_threshold_percent, critical_threshold_percent,
  current_usage_amount, forecast_amount, status,
  starts_at, ends_at, owner_team, approval_required, is_active, notes
)
select
  b.budget_key, b.name, b.scope_type, b.scope_reference,
  st.id, ag.id, mo.id, pv.id,
  'production', 'monthly', 'GBP',
  b.budget_amount, b.warning_threshold_percent, b.critical_threshold_percent,
  b.current_usage_amount, b.forecast_amount, b.status,
  '2026-08-01', '2026-09-01', b.owner_team, false, true, b.notes
from (values
  ('BUD-0001','Group AI Operations Budget','group','group',500.00,70,90,380.40,461.20,'warning','Group AI Operations','Covers all sites, agents, models and providers across the group.'),
  ('BUD-0002','Digital Footprint AI','site','digital-footprint',60.00,70,90,48.40,58.70,'healthy','Digital Footprint Delivery',''),
  ('BUD-0003','QuickGuard AI','site','quickguard',100.00,70,90,86.00,104.30,'critical','QuickGuard Operations','Forecast to exceed monthly limit; review before month end.'),
  ('BUD-0004','GuardianHub AI','site','guardianhub',80.00,70,90,74.00,89.80,'critical','GuardianHub Welfare','Elevated retry spend from check-call batch.'),
  ('BUD-0005','LetHub AI','site','lethub',55.00,70,90,42.00,51.00,'healthy','LetHub Operations',''),
  ('BUD-0006','Vowora AI','site','wedora',75.00,70,90,66.00,80.10,'warning','Vowora Planning',''),
  ('BUD-0007','The Forge AI','site','the-forge',70.00,70,90,64.00,77.70,'critical','The Forge Engineering','Code generation spend trending above forecast.'),
  ('BUD-0008','Claude Sonnet usage','model','MOD-CLAUDE-SONNET',220.00,70,90,204.00,247.60,'warning','Group AI Operations',''),
  ('BUD-0009','GPT-4o usage','model','MOD-GPT4O',150.00,70,90,136.40,165.60,'warning','The Forge Engineering',''),
  ('BUD-0010','Anthropic provider','provider','PROV-ANTHROPIC',250.00,70,90,221.00,268.30,'exceeded','Group AI Operations','Forecast to exceed provider limit; review model routing.'),
  ('BUD-0011','OpenAI provider','provider','PROV-OPENAI',180.00,70,90,136.40,165.60,'healthy','The Forge Engineering',''),
  ('BUD-0012','Code Agent budget','agent','tf-code',140.00,70,90,136.40,165.60,'exceeded','The Forge Engineering','Cost spike from failed generation retries.')
) as b(budget_key, name, scope_type, scope_reference, budget_amount, warning_threshold_percent, critical_threshold_percent, current_usage_amount, forecast_amount, status, owner_team, notes)
left join ai_sites st on st.site_key = b.scope_reference and b.scope_type = 'site'
left join ai_operations_agents ag on ag.agent_key = b.scope_reference and b.scope_type = 'agent'
left join ai_operations_models mo on mo.model_key = b.scope_reference and b.scope_type = 'model'
left join ai_model_providers pv on pv.provider_key = b.scope_reference and b.scope_type = 'provider'
on conflict (budget_key) do nothing;

-- --- 8. Usage/cost baseline ---------------------------------------------------
-- Honest migrated-demo baseline only (is_estimate=true, cost_source='demo_migrated').
-- No production provider usage is fabricated.

-- Site-level monthly rollups.
insert into ai_usage_costs (
  usage_key, occurred_at, site_id, usage_type, source_type, source_reference,
  estimated_cost, currency, cost_source, environment, is_estimate
)
select
  u.usage_key, now(), st.id, 'monthly_rollup', 'demo_summary', u.ref,
  u.amount, 'GBP', 'demo_migrated', 'production', true
from (values
  ('USG-SITE-digital-footprint','digital-footprint',48.40),
  ('USG-SITE-quickguard','quickguard',86.00),
  ('USG-SITE-guardianhub','guardianhub',74.00),
  ('USG-SITE-lethub','lethub',42.00),
  ('USG-SITE-wedora','wedora',66.00),
  ('USG-SITE-the-forge','the-forge',64.00)
) as u(usage_key, ref, amount)
left join ai_sites st on st.site_key = u.ref
on conflict (usage_key) do nothing;

-- Agent-level monthly rollups.
insert into ai_usage_costs (
  usage_key, occurred_at, agent_id, usage_type, source_type, source_reference,
  estimated_cost, currency, cost_source, environment, is_estimate
)
select
  u.usage_key, now(), ag.id, 'monthly_rollup', 'demo_summary', u.ref,
  u.amount, 'GBP', 'demo_migrated', 'production', true
from (values
  ('USG-AGENT-tf-code','tf-code',136.40),
  ('USG-AGENT-core-orchestrator','core-orchestrator',17.00),
  ('USG-AGENT-core-diagnostics','core-diagnostics',20.80),
  ('USG-AGENT-qg-match','qg-match',30.40),
  ('USG-AGENT-wd-photo','wd-photo',32.40),
  ('USG-AGENT-core-support','core-support',12.00),
  ('USG-AGENT-tf-master','tf-master',33.60),
  ('USG-AGENT-gh-checkcall','gh-checkcall',8.20),
  ('USG-AGENT-core-reporting','core-reporting',8.80),
  ('USG-AGENT-core-billing','core-billing',6.40)
) as u(usage_key, ref, amount)
left join ai_operations_agents ag on ag.agent_key = u.ref
on conflict (usage_key) do nothing;

-- Provider-level monthly rollups.
insert into ai_usage_costs (
  usage_key, occurred_at, provider_id, usage_type, source_type, source_reference,
  estimated_cost, currency, cost_source, environment, is_estimate
)
select
  u.usage_key, now(), pv.id, 'monthly_rollup', 'demo_summary', u.ref,
  u.amount, 'GBP', 'demo_migrated', 'production', true
from (values
  ('USG-PROV-ANTHROPIC','PROV-ANTHROPIC',221.00),
  ('USG-PROV-OPENAI','PROV-OPENAI',136.40),
  ('USG-PROV-OLLAMA','PROV-OLLAMA',24.80),
  ('USG-PROV-INTERNAL','PROV-INTERNAL',0.00)
) as u(usage_key, ref, amount)
left join ai_model_providers pv on pv.provider_key = u.ref
on conflict (usage_key) do nothing;

-- --- 9. Budget events (migrated demo baseline) --------------------------------

insert into ai_budget_events (
  event_key, budget_id, event_type, threshold_percent,
  observed_amount, budget_amount, forecast_amount,
  status, severity, acknowledged, summary
)
select
  e.event_key, b.id, e.event_type, e.threshold_percent,
  e.observed_amount, e.budget_amount, e.forecast_amount,
  'open', e.severity, false, e.summary
from (values
  ('BTA-001','BUD-0003','warning_threshold',80,86.00,100.00,104.30,'high','QuickGuard exceeded 80% of monthly budget (migrated demo baseline)'),
  ('BTA-002','BUD-0012','exceeded',90,136.40,140.00,165.60,'critical','Code Agent cost spike (migrated demo baseline)'),
  ('BTA-003','BUD-0008','warning_threshold',70,204.00,220.00,247.60,'medium','Model usage higher than expected (migrated demo baseline)'),
  ('BTA-004','BUD-0004','warning_threshold',70,74.00,80.00,89.80,'medium','Retry costs increasing (migrated demo baseline)'),
  ('BTA-005','BUD-0010','warning_threshold',70,221.00,250.00,268.30,'high','Provider spend approaching monthly limit (migrated demo baseline)'),
  ('BTA-006','BUD-0007','forecast_warning',70,64.00,70.00,77.70,'high','Forecast to exceed monthly budget (migrated demo baseline)'),
  ('BTA-007','BUD-0006','warning_threshold',70,66.00,75.00,80.10,'low','Model usage spike (migrated demo baseline)')
) as e(event_key, budget_key, event_type, threshold_percent, observed_amount, budget_amount, forecast_amount, severity, summary)
left join ai_budgets b on b.budget_key = e.budget_key
on conflict (event_key) do nothing;

-- ============================================================================
-- End.
-- ============================================================================