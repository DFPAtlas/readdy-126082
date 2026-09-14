// ============================================================================
// DFP COMMAND 09 — PROJECT-SCOPED SUPPORT DATA
// ============================================================================
// Loads the selected project's support tickets + recent ticket events from the
// existing central Support system. Scoped strictly by internal_projects.id via
// internal_support_tickets.project_id (the canonical relationship).
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { SupportTicket, TicketEvent } from '@/types/support-tickets';

export interface ProjectSupportData {
  tickets: SupportTicket[];
  events: TicketEvent[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const TICKET_SELECT =
  'id,ticket_number,site_id,project_id,customer_name,customer_email,subject,category,priority,status,source,assigned_to,assigned_agent,due_at,last_activity_at,created_at,resolved_at,closed_at,team_id';

export function useProjectSupport(projectId: number | undefined): ProjectSupportData {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const configured = Boolean(
    import.meta.env.VITE_PUBLIC_SUPABASE_URL && import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
  );

  const load = useCallback(async () => {
    if (!projectId) {
      setTickets([]);
      setEvents([]);
      setLoading(false);
      setError(null);
      return;
    }
    if (!configured) {
      setError('Support data unavailable — backend is not connected.');
      setLoading(false);
      return;
    }
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('internal_support_tickets')
        .select(TICKET_SELECT)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (id !== requestIdRef.current) return;
      if (dbError) throw dbError;

      const rows = (data ?? []) as SupportTicket[];
      setTickets(rows);

      // Recent ticket events = honest activity history (not status-fabricated).
      if (rows.length > 0) {
        const ids = rows.map((t) => t.id);
        const { data: eventData, error: eventError } = await supabase
          .from('internal_ticket_events')
          .select('id,ticket_id,actor_user_id,actor_type,event_type,description,created_at')
          .in('ticket_id', ids)
          .order('created_at', { ascending: false })
          .limit(20);
        if (id !== requestIdRef.current) return;
        if (eventError) {
          setEvents([]);
        } else {
          setEvents((eventData ?? []) as TicketEvent[]);
        }
      } else {
        setEvents([]);
      }
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load support data');
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [projectId, configured]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { tickets, events, loading, error, refresh };
}