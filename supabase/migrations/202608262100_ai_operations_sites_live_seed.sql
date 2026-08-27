-- ============================================================================
-- AI Operations — Phase 2 Prompt 02: Group Site Registry live persistence.
--
-- Controlled, idempotent import of the six group sites from the demo registry
-- into the `ai_sites` table (created in Phase 2 Prompt 01). This is a one-time
-- seed — it is NOT run on every page load, and it maps base metadata only
-- (no credentials/secrets, no nested demo metadata).
--
-- ID strategy: `site_key` is the stable application identifier used by routes
-- and relationships; the database `id` (UUID) remains the internal primary key.
-- `ON CONFLICT (site_key) DO UPDATE` makes this safe to re-run without
-- duplicating rows.
-- ============================================================================

INSERT INTO ai_sites (
  site_key, name, product_name, domain, description, business_type, environment,
  operational_status, ai_status, criticality, owner_team, repository_reference,
  readdy_reference, supabase_reference, n8n_reference, billing_provider,
  email_provider, authentication_provider, hosting_provider, notes, is_active
) VALUES
  ('digital-footprint', 'Digital Footprint', 'Digital Footprint Platform', 'digitalfootprint.ai', 'The group flagship platform. Central command centre, client portal, support operations and cross-group automation hub.', 'platform', 'production', 'healthy', 'active', 'critical', 'DFP Core Team', 'digitalfootprint/platform', 'RDDY-DFP-001', 'supabase-dfp-prod', 'n8n-dfp-core', 'Stripe', 'Resend', 'Supabase Auth', 'Vercel', 'Flagship control plane. Highest availability target across the group.', true),
  ('quickguard', 'QuickGuard', 'QuickGuard Security', 'quickguard.co.uk', 'Security staffing platform for guard rota management, shift matching, compliance and welfare check-calls.', 'saas', 'production', 'healthy', 'active', 'high', 'QuickGuard Ops', 'quickguard/app', 'RDDY-QG-014', 'supabase-qg-prod', 'n8n-quickguard', 'Stripe', 'Resend', 'Supabase Auth', 'Vercel', 'Shift-critical matching runs on a tight schedule.', true),
  ('guardianhub', 'GuardianHub', 'GuardianHub Care', 'guardianhub.io', 'Care and welfare operations platform handling rotas, check-calls, welfare monitoring and incident management.', 'service', 'production', 'warning', 'partial', 'critical', 'GuardianHub Ops', 'guardianhub/core', 'RDDY-GH-006', 'supabase-gh-prod', 'n8n-guardianhub', 'Stripe', 'Resend', 'Supabase Auth', 'Vercel', 'Welfare check-call latency elevated; diagnostics agent investigating.', true),
  ('lethub', 'LetHub', 'LetHub Lettings', 'lethub.co.uk', 'Lettings management platform covering tenancy workflows, maintenance coordination, compliance and rent tracking.', 'saas', 'production', 'healthy', 'active', 'high', 'LetHub Ops', 'lethub/app', 'RDDY-LH-009', 'supabase-lh-prod', 'n8n-lethub', 'Stripe', 'Resend', 'Supabase Auth', 'Vercel', 'Stable platform. Compliance agent runs nightly reference checks.', true),
  ('wedora', 'Wedora', 'Wedora Weddings', 'wedora.com', 'Wedding planning platform coordinating guests, RSVPs, suppliers, seating plans and day-of logistics.', 'platform', 'production', 'healthy', 'active', 'high', 'Wedora Ops', 'wedora/app', 'RDDY-WD-011', 'supabase-wd-prod', 'n8n-wedora', 'Stripe', 'Resend', 'Supabase Auth', 'Vercel', 'Seating agent flagged a duplicate invitation; minor alert open.', true),
  ('the-forge', 'The Forge', 'The Forge Studio', 'theforge.dev', 'Internal build studio and prompt engineering workbench powering code generation, testing and release validation across the group.', 'product', 'production', 'critical', 'partial', 'critical', 'Forge Team', 'theforge/studio', 'RDDY-TF-003', 'supabase-tf-prod', 'n8n-theforge', 'Stripe', 'Resend', 'Supabase Auth', 'Vercel', 'Release validation failed on latest build; deploy agent awaiting approval.', true)
ON CONFLICT (site_key) DO UPDATE SET
  name = EXCLUDED.name,
  product_name = EXCLUDED.product_name,
  domain = EXCLUDED.domain,
  description = EXCLUDED.description,
  business_type = EXCLUDED.business_type,
  environment = EXCLUDED.environment,
  operational_status = EXCLUDED.operational_status,
  ai_status = EXCLUDED.ai_status,
  criticality = EXCLUDED.criticality,
  owner_team = EXCLUDED.owner_team,
  repository_reference = EXCLUDED.repository_reference,
  readdy_reference = EXCLUDED.readdy_reference,
  supabase_reference = EXCLUDED.supabase_reference,
  n8n_reference = EXCLUDED.n8n_reference,
  billing_provider = EXCLUDED.billing_provider,
  email_provider = EXCLUDED.email_provider,
  authentication_provider = EXCLUDED.authentication_provider,
  hosting_provider = EXCLUDED.hosting_provider,
  notes = EXCLUDED.notes,
  is_active = EXCLUDED.is_active;