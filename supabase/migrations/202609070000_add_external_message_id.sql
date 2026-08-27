-- Add a generic external message id for connector idempotency.
-- Used by server-to-server connectors (e.g. QuickGuard follow-ups) to
-- deduplicate inbound customer messages without relying on ticket number.

ALTER TABLE public.internal_ticket_messages
  ADD COLUMN IF NOT EXISTS external_message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS internal_ticket_messages_external_message_id_key
  ON public.internal_ticket_messages (external_message_id)
  WHERE external_message_id IS NOT NULL;