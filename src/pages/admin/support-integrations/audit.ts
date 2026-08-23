import { supabase } from '@/lib/supabase';

/**
 * Records an administrative event in the shared activity log. Used for site,
 * settings, SLA, rate-limit, and origin changes. Credential operations are
 * audited server-side inside the manage-support-integrations Edge Function.
 */
export async function logAdminEvent(
  entityType: string,
  action: string,
  description: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await supabase.from('internal_activity_log').insert({
    description,
    entity_type: entityType,
    action,
    metadata,
  });
}