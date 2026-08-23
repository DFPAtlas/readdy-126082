import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  SupportTicket,
  SupportSite,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketSource,
} from '@/types/support-tickets';
import { type SortValue } from './constants';

export interface InboxFilters {
  q: string;
  statuses: TicketStatus[];
  priority: 'all' | TicketPriority;
  category: 'all' | TicketCategory;
  source: 'all' | TicketSource;
  site: string; // 'all' | site id
  project: string; // 'all' | project id (string)
  assigned: string; // 'all' | 'unassigned' | user id
  unread: boolean;
  overdue: boolean;
  resolvedToday: boolean;
  createdFrom: string;
  createdTo: string;
  activityFrom: string;
  activityTo: string;
}

export const DEFAULT_FILTERS: InboxFilters = {
  q: '',
  statuses: [],
  priority: 'all',
  category: 'all',
  source: 'all',
  site: 'all',
  project: 'all',
  assigned: 'all',
  unread: false,
  overdue: false,
  resolvedToday: false,
  createdFrom: '',
  createdTo: '',
  activityFrom: '',
  activityTo: '',
};

export interface StaffOption {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
}

export interface TicketWithMeta extends SupportTicket {
  site_name: string;
  site_slug: string;
  domain: string | null;
  message_count: number;
}

export interface SummaryCounts {
  newCount: number;
  activeCount: number;
  waitingCount: number;
  overdueCount: number;
  resolvedTodayCount: number;
  unassignedCount: number;
}

interface TicketRow extends SupportTicket {
  internal_support_sites: {
    site_name: string;
    site_slug: string;
    domain: string | null;
  } | null;
}

const TICKET_SELECT =
  'id,ticket_number,site_id,project_id,external_reference,customer_name,customer_email,subject,category,priority,status,source,assigned_to,assigned_agent,is_unread,due_at,last_activity_at,created_at,resolved_at,closed_at,internal_support_sites(site_name,site_slug,domain)';

function isValidDate(iso: string): boolean {
  return iso !== '' && !Number.isNaN(new Date(iso).getTime());
}

function buildTicketQuery(
  filters: InboxFilters,
  page: number,
  pageSize: number,
  sort: SortValue,
) {
  let query = supabase
    .from('internal_support_tickets')
    .select(TICKET_SELECT, { count: 'exact' });

  const q = filters.q.trim();
  if (q) {
    const like = `%${q}%`;
    query = query.or(
      `ticket_number.ilike.${like},subject.ilike.${like},customer_name.ilike.${like},customer_email.ilike.${like},external_reference.ilike.${like}`,
    );
    query = query.or(`site_name.ilike.${like},site_slug.ilike.${like}`, {
      foreignTable: 'internal_support_sites',
    });
  }

  if (filters.statuses.length > 0) {
    query = query.in('status', filters.statuses);
  }
  if (filters.priority !== 'all') query = query.eq('priority', filters.priority);
  if (filters.category !== 'all') query = query.eq('category', filters.category);
  if (filters.source !== 'all') query = query.eq('source', filters.source);
  if (filters.site !== 'all') query = query.eq('site_id', filters.site);
  if (filters.project !== 'all') query = query.eq('project_id', Number(filters.project));
  if (filters.assigned === 'unassigned') query = query.is('assigned_to', null);
  else if (filters.assigned !== 'all') query = query.eq('assigned_to', filters.assigned);
  if (filters.unread) query = query.eq('is_unread', true);
  if (filters.overdue) {
    query = query
      .lt('due_at', new Date().toISOString())
      .not('status', 'in', '(resolved,closed,spam)');
  }
  if (filters.resolvedToday) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    query = query.eq('status', 'resolved').gte('resolved_at', start.toISOString());
  }
  if (isValidDate(filters.createdFrom)) query = query.gte('created_at', filters.createdFrom);
  if (isValidDate(filters.createdTo)) query = query.lte('created_at', filters.createdTo);
  if (isValidDate(filters.activityFrom)) query = query.gte('last_activity_at', filters.activityFrom);
  if (isValidDate(filters.activityTo)) query = query.lte('last_activity_at', filters.activityTo);

  switch (sort) {
    case 'created_desc':
      query = query.order('created_at', { ascending: false }).order('id', { ascending: false });
      break;
    case 'created_asc':
      query = query.order('created_at', { ascending: true }).order('id', { ascending: true });
      break;
    case 'activity_desc':
      query = query.order('last_activity_at', { ascending: false }).order('id', { ascending: false });
      break;
    case 'activity_asc':
      query = query.order('last_activity_at', { ascending: true }).order('id', { ascending: true });
      break;
    case 'priority_desc':
      query = query
        .order('priority_rank', { ascending: false })
        .order('last_activity_at', { ascending: false })
        .order('id', { ascending: true });
      break;
    case 'due_asc':
      query = query
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('priority_rank', { ascending: false })
        .order('id', { ascending: true });
      break;
    case 'customer_asc':
      query = query
        .order('customer_name', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true });
      break;
    case 'ticket_number_asc':
      query = query.order('ticket_number', { ascending: true }).order('id', { ascending: true });
      break;
    case 'default':
    default:
      query = query
        .order('is_unread', { ascending: false })
        .order('priority_rank', { ascending: false })
        .order('last_activity_at', { ascending: false })
        .order('id', { ascending: true });
      break;
  }

  return query.range((page - 1) * pageSize, page * pageSize - 1);
}

function mapTicketRows(rows: TicketRow[]): TicketWithMeta[] {
  return rows.map((row) => ({
    ...row,
    site_name: row.internal_support_sites?.site_name ?? 'Unknown site',
    site_slug: row.internal_support_sites?.site_slug ?? '',
    domain: row.internal_support_sites?.domain ?? null,
    message_count: 0,
    internal_support_sites: undefined,
  })) as TicketWithMeta[];
}

export function assigneeName(ticket: Pick<SupportTicket, 'assigned_to' | 'assigned_agent'>, staff: StaffOption[]): string {
  if (ticket.assigned_agent) return ticket.assigned_agent;
  if (ticket.assigned_to) {
    const s = staff.find((x) => x.user_id === ticket.assigned_to);
    if (s) return s.full_name || s.email || s.user_id;
    return 'Assigned';
  }
  return '';
}

export function useSupportInbox(
  filters: InboxFilters,
  page: number,
  pageSize: number,
  sort: SortValue,
) {
  const [tickets, setTickets] = useState<TicketWithMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const configured = Boolean(
    import.meta.env.VITE_PUBLIC_SUPABASE_URL && import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
  );

  const load = useCallback(async () => {
    if (!configured) {
      setError('Supabase is not configured for this project.');
      setLoading(false);
      return;
    }
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, count, error: dbError } = await buildTicketQuery(filters, page, pageSize, sort);
      if (id !== requestIdRef.current) return;
      if (dbError) throw dbError;

      const rows = (data ?? []) as TicketRow[];
      let messageCounts: Record<string, number> = {};
      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const { data: msgRows, error: msgError } = await supabase
          .from('internal_ticket_messages')
          .select('ticket_id')
          .in('ticket_id', ids);
        if (!msgError && msgRows) {
          const counter: Record<string, number> = {};
          for (const m of msgRows) {
            counter[m.ticket_id] = (counter[m.ticket_id] ?? 0) + 1;
          }
          messageCounts = counter;
        }
      }

      const mapped = mapTicketRows(rows).map((t) => ({
        ...t,
        message_count: messageCounts[t.id] ?? 0,
      }));

      setTickets(mapped);
      setTotal(count ?? 0);
      setLastRefreshed(new Date());
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load tickets');
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [filters, page, pageSize, sort, configured]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  // Realtime: any change to tickets triggers a refresh. Fail-safe — if Realtime
  // is unavailable the manual Refresh button keeps working.
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    const channel = supabase
      .channel('support-tickets-inbox-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internal_support_tickets' },
        () => {
          if (!cancelled) setReloadKey((k) => k + 1);
        },
      )
      .subscribe((status) => {
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          // Realtime unavailable — nothing to do; manual refresh still works.
        }
      });
    return () => {
      cancelled = true;
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [configured]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { tickets, total, loading, error, lastRefreshed, refresh };
}

export function useSupportLookups() {
  const [sites, setSites] = useState<SupportSite[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [projects, setProjects] = useState<{ id: number; project_name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const configured = Boolean(
      import.meta.env.VITE_PUBLIC_SUPABASE_URL && import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
    );
    if (!configured) {
      setLoading(false);
      return;
    }

    (async () => {
      const [sitesRes, projectsRes] = await Promise.all([
        supabase
          .from('internal_support_sites')
          .select('id,website_id,project_id,site_name,site_slug,domain,support_email,is_active,created_at,updated_at')
          .order('site_name'),
        supabase.from('internal_projects').select('id,project_name').order('project_name'),
      ]);

      let staffList: StaffOption[] = [];
      const { data: staffData, error: staffError } = await supabase.rpc('internal_list_staff');
      if (!staffError && staffData) staffList = staffData as StaffOption[];

      if (!cancelled) {
        setSites((sitesRes.data ?? []) as SupportSite[]);
        setProjects((projectsRes.data ?? []) as { id: number; project_name: string }[]);
        setStaff(staffList);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { sites, staff, projects, loading };
}

export function useSupportCounts() {
  const [counts, setCounts] = useState<SummaryCounts>({
    newCount: 0,
    activeCount: 0,
    waitingCount: 0,
    overdueCount: 0,
    resolvedTodayCount: 0,
    unassignedCount: 0,
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const configured = Boolean(
      import.meta.env.VITE_PUBLIC_SUPABASE_URL && import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
    );
    if (!configured) return;

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    (async () => {
      const [newRes, activeRes, waitingRes, overdueRes, resolvedTodayRes, unassignedRes] =
        await Promise.all([
          supabase
            .from('internal_support_tickets')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'new'),
          supabase
            .from('internal_support_tickets')
            .select('id', { count: 'exact', head: true })
            .in('status', ['open', 'in_progress']),
          supabase
            .from('internal_support_tickets')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'waiting_on_customer'),
          supabase
            .from('internal_support_tickets')
            .select('id', { count: 'exact', head: true })
            .lt('due_at', new Date().toISOString())
            .not('status', 'in', '(resolved,closed,spam)'),
          supabase
            .from('internal_support_tickets')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'resolved')
            .gte('resolved_at', start.toISOString()),
          supabase
            .from('internal_support_tickets')
            .select('id', { count: 'exact', head: true })
            .is('assigned_to', null)
            .not('status', 'in', '(resolved,closed,spam)'),
        ]);

      if (!cancelled) {
        setCounts({
          newCount: newRes.count ?? 0,
          activeCount: activeRes.count ?? 0,
          waitingCount: waitingRes.count ?? 0,
          overdueCount: overdueRes.count ?? 0,
          resolvedTodayCount: resolvedTodayRes.count ?? 0,
          unassignedCount: unassignedRes.count ?? 0,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { counts, refresh };
}

export function useUnreadTicketCount() {
  const [unread, setUnread] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const configured = Boolean(
      import.meta.env.VITE_PUBLIC_SUPABASE_URL && import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
    );
    if (!configured) return;

    (async () => {
      const { count } = await supabase
        .from('internal_support_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('is_unread', true)
        .not('status', 'in', '(resolved,closed,spam)');
      if (!cancelled) setUnread(count ?? 0);
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    const configured = Boolean(
      import.meta.env.VITE_PUBLIC_SUPABASE_URL && import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
    );
    if (!configured) return;
    const channel = supabase
      .channel('support-tickets-unread')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internal_support_tickets' },
        () => setReloadKey((k) => k + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, []);

  return unread;
}