import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  SupportTicket,
  TicketMessage,
  TicketAttachment,
  TicketEvent,
} from '@/types/support-tickets';
import type { StaffOption } from '@/pages/support-tickets/hooks';

export interface TicketDetailRecord extends SupportTicket {
  site_name: string;
  site_slug: string;
  domain: string | null;
  project_name: string | null;
}

interface TicketRaw extends SupportTicket {
  internal_support_sites: {
    site_name: string;
    site_slug: string;
    domain: string | null;
  } | null;
  internal_projects: { project_name: string } | null;
}

const TICKET_SELECT =
  'id,ticket_number,site_id,project_id,external_reference,customer_user_id,customer_name,customer_email,customer_phone,subject,description,category,priority,status,source,assigned_to,assigned_agent,is_unread,first_response_at,resolved_at,closed_at,last_customer_reply_at,last_staff_reply_at,last_activity_at,due_at,metadata,created_at,updated_at,team_id,routing_status,routing_reason,routing_confidence,routed_at,matched_rule_id,escalation_level,internal_support_sites(site_name,site_slug,domain),internal_projects(project_name)';

const configured = Boolean(
  import.meta.env.VITE_PUBLIC_SUPABASE_URL && import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
);

export function useTicketDetail(ticketId: string | undefined, role: string | null) {
  const [ticket, setTicket] = useState<TicketDetailRecord | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!ticketId) return;
    if (!configured) {
      setError('Supabase is not configured for this project.');
      setLoading(false);
      return;
    }
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data: t, error: tErr } = await supabase
        .from('internal_support_tickets')
        .select(TICKET_SELECT)
        .eq('id', ticketId)
        .maybeSingle();
      if (id !== requestIdRef.current) return;
      if (tErr) throw tErr;

      const raw = t as TicketRaw | null;
      const detail: TicketDetailRecord | null = raw
        ? {
            ...raw,
            site_name: raw.internal_support_sites?.site_name ?? 'Unknown site',
            site_slug: raw.internal_support_sites?.site_slug ?? '',
            domain: raw.internal_support_sites?.domain ?? null,
            project_name: raw.internal_projects?.project_name ?? null,
          }
        : null;
      setTicket(detail);

      // Mark read on open (owner/admin only — RLS also enforces this).
      if (detail && detail.is_unread && (role === 'owner' || role === 'admin' || role === 'support_manager' || role === 'support_agent' || role === 'developer')) {
        supabase
          .from('internal_support_tickets')
          .update({ is_unread: false })
          .eq('id', ticketId)
          .then(() => {});
      }

      const [mRes, aRes, eRes] = await Promise.all([
        supabase
          .from('internal_ticket_messages')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true }),
        supabase
          .from('internal_ticket_attachments')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true }),
        supabase
          .from('internal_ticket_events')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: false }),
      ]);
      if (id !== requestIdRef.current) return;

      setMessages((mRes.data ?? []) as TicketMessage[]);
      setAttachments((aRes.data ?? []) as TicketAttachment[]);
      setEvents((eRes.data ?? []) as TicketEvent[]);
    } catch (e: unknown) {
      if (id !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load ticket');
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [ticketId, role]);

  // Staff options (once).
  useEffect(() => {
    let cancelled = false;
    if (!configured) return;
    (async () => {
      const { data } = await supabase.rpc('internal_list_staff');
      if (!cancelled && data) setStaff(data as StaffOption[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  // Realtime — subscribe to this ticket only, refetch on any relevant change.
  useEffect(() => {
    if (!configured || !ticketId) return;
    const channel = supabase
      .channel(`support-ticket-detail-${ticketId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internal_support_tickets', filter: `id=eq.${ticketId}` },
        () => setReloadKey((k) => k + 1),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internal_ticket_messages', filter: `ticket_id=eq.${ticketId}` },
        () => setReloadKey((k) => k + 1),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internal_ticket_attachments', filter: `ticket_id=eq.${ticketId}` },
        () => setReloadKey((k) => k + 1),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'internal_ticket_events', filter: `ticket_id=eq.${ticketId}` },
        () => setReloadKey((k) => k + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [ticketId]);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return { ticket, messages, attachments, events, staff, loading, error, refresh };
}