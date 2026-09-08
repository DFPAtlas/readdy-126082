-- Queue-enqueue helpers are internal plumbing. They resolve addresses from
-- auth.users and write delivery work as SECURITY DEFINER, so they must never
-- be callable through the public RPC API.

REVOKE ALL ON FUNCTION public.internal_enqueue_notification(
  uuid, uuid, uuid, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.internal_enqueue_notification(
  uuid, uuid, uuid, text
) TO service_role;

REVOKE ALL ON FUNCTION public.internal_enqueue_escalation_notification(
  uuid, uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.internal_enqueue_escalation_notification(
  uuid, uuid, text, text
) TO service_role;

-- Trigger entrypoints execute automatically under their owning table. Direct
-- RPC execution is unnecessary and only widens the exposed API surface.
REVOKE ALL ON FUNCTION public.trg_enqueue_new_ticket_notifications()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_enqueue_assignment_notification()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_enqueue_customer_reply_notification()
  FROM PUBLIC, anon, authenticated;

-- Trigger entrypoint is not a public RPC.
REVOKE ALL ON FUNCTION public.notify_new_support_ticket()
  FROM PUBLIC, anon, authenticated;
