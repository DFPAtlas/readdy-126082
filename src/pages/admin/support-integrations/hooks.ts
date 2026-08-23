import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  SupportSite,
  SupportSiteStats,
  SupportStaffMember,
  TicketApiClient,
  TicketSiteSettings,
  TicketSlaRule,
  SiteRateLimitConfig,
} from '@/types/support-tickets';

// ---------------------------------------------------------------------------
// Sites + aggregated stats (single stats RPC — no N+1 fan-out)
// ---------------------------------------------------------------------------
export function useSupportSites() {
  const [sites, setSites] = useState<SupportSite[]>([]);
  const [stats, setStats] = useState<Record<string, SupportSiteStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sitesRes, statsRes] = await Promise.all([
        supabase
          .from('internal_support_sites')
          .select('id, website_id, project_id, site_name, site_slug, domain, support_email, is_active, integration_mode, allowed_origins, archived_at, created_at, updated_at')
          .order('site_name', { ascending: true }),
        supabase.rpc('internal_support_site_stats'),
      ]);

      if (sitesRes.error) throw sitesRes.error;
      if (statsRes.error) throw statsRes.error;

      setSites((sitesRes.data ?? []) as SupportSite[]);

      const statsMap: Record<string, SupportSiteStats> = {};
      for (const row of (statsRes.data ?? []) as SupportSiteStats[]) {
        statsMap[row.site_id] = row;
      }
      setStats(statsMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sites.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { sites, stats, loading, error, reload: load };
}

// ---------------------------------------------------------------------------
// Lookups — staff (assignments), websites + projects (linking)
// ---------------------------------------------------------------------------
interface WebsiteOption {
  id: string;
  name: string;
  primary_domain: string | null;
  production_url: string | null;
}

interface ProjectOption {
  id: number;
  project_name: string;
  project_slug: string;
}

export function useIntegrationLookups() {
  const [staff, setStaff] = useState<SupportStaffMember[]>([]);
  const [websites, setWebsites] = useState<WebsiteOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [staffRes, webRes, projRes] = await Promise.allSettled([
        supabase.rpc('internal_list_staff'),
        supabase.from('client_websites').select('id, name, primary_domain, production_url').order('name'),
        supabase.from('internal_projects').select('id, project_name, project_slug').order('project_name'),
      ]);

      if (cancelled) return;

      if (staffRes.status === 'fulfilled' && !staffRes.value.error) {
        setStaff((staffRes.value.data ?? []) as SupportStaffMember[]);
      }
      if (webRes.status === 'fulfilled' && !webRes.value.error) {
        setWebsites((webRes.value.data ?? []) as WebsiteOption[]);
      }
      if (projRes.status === 'fulfilled' && !projRes.value.error) {
        setProjects((projRes.value.data ?? []) as ProjectOption[]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { staff, websites, projects, loading };
}

// ---------------------------------------------------------------------------
// Site detail — settings, SLA rules, rate limits, credentials
// ---------------------------------------------------------------------------
export function useSiteDetail(siteId: string | null) {
  const [settings, setSettings] = useState<TicketSiteSettings | null>(null);
  const [globalSla, setGlobalSla] = useState<TicketSlaRule[]>([]);
  const [siteSla, setSiteSla] = useState<TicketSlaRule[]>([]);
  const [rateLimit, setRateLimit] = useState<SiteRateLimitConfig | null>(null);
  const [credentials, setCredentials] = useState<TicketApiClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!siteId) {
      setSettings(null);
      setGlobalSla([]);
      setSiteSla([]);
      setRateLimit(null);
      setCredentials([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [settingsRes, globalRes, siteRes, rateRes, credRes] = await Promise.all([
        supabase
          .from('internal_support_site_settings')
          .select('*')
          .eq('site_id', siteId)
          .maybeSingle(),
        supabase
          .from('internal_ticket_sla_rules')
          .select('*')
          .is('site_id', null)
          .order('priority'),
        supabase
          .from('internal_ticket_sla_rules')
          .select('*')
          .eq('site_id', siteId)
          .order('priority'),
        supabase
          .from('internal_support_site_rate_limits')
          .select('*')
          .eq('site_id', siteId)
          .maybeSingle(),
        supabase
          .from('internal_ticket_api_clients')
          .select('id, site_id, client_name, integration_mode, key_prefix, allowed_origins, turnstile_required, elevated_priority_allowed, is_active, last_used_at, expires_at, revoked_at, created_at, updated_at')
          .eq('site_id', siteId)
          .order('created_at', { ascending: false }),
      ]);

      if (settingsRes.error) throw settingsRes.error;
      if (globalRes.error) throw globalRes.error;
      if (siteRes.error) throw siteRes.error;
      if (rateRes.error) throw rateRes.error;
      if (credRes.error) throw credRes.error;

      setSettings((settingsRes.data as TicketSiteSettings) ?? null);
      setGlobalSla((globalRes.data ?? []) as TicketSlaRule[]);
      setSiteSla((siteRes.data ?? []) as TicketSlaRule[]);
      setRateLimit((rateRes.data as SiteRateLimitConfig) ?? null);
      setCredentials((credRes.data ?? []) as TicketApiClient[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load site detail.');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  return { settings, globalSla, siteSla, rateLimit, credentials, loading, error, reload: load };
}