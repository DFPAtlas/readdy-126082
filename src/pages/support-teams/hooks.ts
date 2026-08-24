import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  SupportTeam,
  TeamWorkload,
  SupportRoutingRule,
  AssignableStaff,
} from '@/types/support-tickets';

export interface SiteOption {
  id: string;
  site_name: string;
}

export interface TeamStaffOption {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
}

const configured = Boolean(
  import.meta.env.VITE_PUBLIC_SUPABASE_URL && import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
);

/** Read error message from an RPC error and surface the postgrest code. */
export function friendlyRpcError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const code = raw.replace(/^[^:]*:\s*/, '').trim();
  const map: Record<string, string> = {
    FORBIDDEN: 'You do not have permission to perform this action.',
    TEAM_NOT_FOUND: 'Team not found.',
    SITE_NOT_FOUND: 'Site not found.',
    RULE_NOT_FOUND: 'Routing rule not found.',
    NAME_REQUIRED: 'A name is required.',
    TEAM_REQUIRED: 'A team is required.',
    INVALID_STRATEGY: 'That routing strategy is not valid.',
    INVALID_PRIORITY: 'That priority is not valid.',
    TICKET_NOT_FOUND: 'Ticket not found.',
    STAFF_UNAVAILABLE: 'That staff member is not available.',
    STAFF_CANNOT_WORK: 'That role cannot work tickets.',
    SITE_ACCESS_DENIED: 'That staff member has no access to this site.',
    TEAM_MEMBERSHIP_REQUIRED: 'That staff member is not in the ticket team.',
    TEAM_SITE_MISMATCH: 'That team does not support this ticket site.',
    ALREADY_ASSIGNED: 'This ticket is already assigned.',
  };
  return map[code] ?? code;
}

export function useSupportTeams() {
  const [teams, setTeams] = useState<SupportTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!configured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data, error: e } = await supabase.rpc('internal_list_support_teams');
      if (cancelled) return;
      if (e) setError(e.message);
      else setTeams((data ?? []) as SupportTeam[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  return { teams, loading, error, refresh };
}

export function useTeamWorkload() {
  const [workload, setWorkload] = useState<TeamWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!configured) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase.rpc('internal_team_workload');
      if (!cancelled) {
        setWorkload((data ?? []) as TeamWorkload[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  return { workload, loading, refresh };
}

export function useRoutingRules() {
  const [rules, setRules] = useState<SupportRoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!configured) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error: e } = await supabase.rpc('internal_list_routing_rules');
      if (cancelled) return;
      if (e) setError(e.message);
      else setRules((data ?? []) as SupportRoutingRule[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  return { rules, loading, error, refresh };
}

export function useSupportSites() {
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!configured) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase.rpc('internal_list_support_sites');
      if (!cancelled) {
        setSites((data ?? []) as SiteOption[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { sites, loading };
}

export function useTeamStaff() {
  const [staff, setStaff] = useState<TeamStaffOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!configured) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase.rpc('internal_list_staff');
      if (!cancelled) {
        setStaff((data ?? []) as TeamStaffOption[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { staff, loading };
}

/** Staff eligible to be assigned to a specific ticket (site + team + role + active). */
export function useAssignableStaff(ticketId?: string) {
  const [staff, setStaff] = useState<AssignableStaff[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!ticketId || !configured) {
      setStaff([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data, error: e } = await supabase.rpc('internal_list_assignable_staff', {
        p_ticket_id: ticketId,
      });
      if (cancelled) return;
      if (e) setError(e.message);
      else setStaff((data ?? []) as AssignableStaff[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ticketId, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  return { staff, loading, error, refresh };
}