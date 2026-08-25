-- ============================================================================
-- Organisation-only support diagnostics
-- Allows a diagnostic run when a ticket is linked to a client/organisation that
-- has no portal/login user (customer_user_id IS NULL, organisation_id present).
--
-- Adds a nullable organisation_id column to support_diagnostic_runs with a
-- safe foreign key to public.clients(id). Existing rows and indexes are
-- preserved; the new column is NULL for all prior user-backed runs.
-- ============================================================================

ALTER TABLE public.support_diagnostic_runs
  ADD COLUMN IF NOT EXISTS organisation_id uuid;

ALTER TABLE public.support_diagnostic_runs
  ADD CONSTRAINT support_diagnostic_runs_organisation_id_fkey
  FOREIGN KEY (organisation_id) REFERENCES public.clients(id) ON DELETE SET NULL;