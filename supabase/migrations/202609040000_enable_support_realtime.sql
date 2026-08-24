-- ============================================================================
-- FOOTPRINTCC DFP COMMAND — ENABLE REALTIME FOR SUPPORT WORKSPACE
-- ============================================================================
-- The DFP Command support workspace relies on Supabase Realtime
-- (postgres_changes) to live-update the UI as background workflows progress:
--
--   * support_diagnostic_runs  — queued -> running -> completed/failed (n8n).
--   * support_repair_actions   — repair approval/execution transitions.
--   * support_sessions         — session start/end/revoke transitions.
--   * internal_support_tickets / internal_ticket_messages /
--     internal_ticket_events / internal_ticket_attachments — ticket detail.
--
-- Without these tables in the supabase_realtime publication, the frontend
-- subscriptions never fire and staff would have to refresh manually to see a
-- diagnostic complete. This migration adds them (idempotent).
-- ============================================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE
    public.support_diagnostic_runs,
    public.support_repair_actions,
    public.support_sessions,
    public.internal_support_tickets,
    public.internal_ticket_messages,
    public.internal_ticket_events,
    public.internal_ticket_attachments;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- table(s) already in publication
END;
$$;