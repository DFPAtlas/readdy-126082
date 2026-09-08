-- Run the support notification worker without embedding credentials in the
-- cron command. The same Vault-backed scheduler token is already used by DFP's
-- other internal monitoring jobs.

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'support-notification-worker';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END;
$$;

SELECT cron.schedule(
  'support-notification-worker',
  '*/2 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://zjqftnkrmqhmbrtkvafy.supabase.co/functions/v1/notify-support-staff',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dfp-scheduler-token', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'dfp_scheduler_secret'
        LIMIT 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);
