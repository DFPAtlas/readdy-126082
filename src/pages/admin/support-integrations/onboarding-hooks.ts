import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  ConnectorTest,
  N8nWorkflowStatus,
  SupportSiteCapability,
  SupportSiteConnector,
} from '@/types/support-tickets';

/**
 * Loads the site-onboarding surface for a single site: capability statuses,
 * connectors, connection-test history, and n8n workflow configuration status.
 * Writes happen through the SECURITY DEFINER RPCs / the support-connector-test
 * Edge Function (enforced server-side) — never direct table mutation here.
 */
export function useSiteOnboarding(siteId: string | null) {
  const [capabilities, setCapabilities] = useState<SupportSiteCapability[]>([]);
  const [connectors, setConnectors] = useState<SupportSiteConnector[]>([]);
  const [tests, setTests] = useState<ConnectorTest[]>([]);
  const [n8n, setN8n] = useState<N8nWorkflowStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!siteId) {
      setCapabilities([]);
      setConnectors([]);
      setTests([]);
      setN8n(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [capRes, conRes, testRes, n8nRes] = await Promise.all([
        supabase
          .from('support_site_capabilities')
          .select('*')
          .eq('site_id', siteId)
          .order('capability', { ascending: true }),
        supabase
          .from('support_site_connectors')
          .select('*')
          .eq('site_id', siteId)
          .order('created_at', { ascending: false }),
        supabase
          .from('support_connector_tests')
          .select('*')
          .eq('site_id', siteId)
          .order('created_at', { ascending: false })
          .limit(25),
        supabase.functions.invoke('support-connector-test', {
          body: { action: 'n8n_status' },
        }),
      ]);

      if (capRes.error) throw capRes.error;
      if (conRes.error) throw conRes.error;
      if (testRes.error) throw testRes.error;

      setCapabilities((capRes.data ?? []) as SupportSiteCapability[]);
      setConnectors((conRes.data ?? []) as SupportSiteConnector[]);
      setTests((testRes.data ?? []) as ConnectorTest[]);
      if (!n8nRes.error && n8nRes.data) {
        setN8n(n8nRes.data as N8nWorkflowStatus);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load onboarding data.');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  return { capabilities, connectors, tests, n8n, loading, error, reload: load };
}