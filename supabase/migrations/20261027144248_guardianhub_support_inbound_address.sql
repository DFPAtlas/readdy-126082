-- Register GuardianHub's verified custom-domain support address.
-- Preserve the existing guardianhub@digital-footprint.uk alias and site settings.
DO $migration$
DECLARE
  guardian_site_id uuid;
BEGIN
  SELECT id INTO STRICT guardian_site_id
  FROM public.internal_support_sites
  WHERE site_slug = 'guardianhub' AND domain = 'guardian-hub.uk'
    AND is_active = true AND archived_at IS NULL;

  IF EXISTS (
    SELECT 1 FROM public.internal_support_inbound_addresses
    WHERE address = 'support@guardian-hub.uk'
      AND (site_id IS DISTINCT FROM guardian_site_id
        OR purpose IS DISTINCT FROM 'ticket' OR is_active IS DISTINCT FROM true)
  ) THEN
    RAISE EXCEPTION 'GuardianHub support address already has a different route; review before changing it';
  END IF;

  INSERT INTO public.internal_support_inbound_addresses
    (address, site_id, purpose, is_active, notes)
  VALUES
    ('support@guardian-hub.uk', guardian_site_id, 'ticket', true,
     'GuardianHub custom-domain support inbox; original Digital Footprint alias retained.')
  ON CONFLICT (address) DO NOTHING;
END
$migration$;
