import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { TicketDetailRecord } from '../hooks';
import { useSupportTeams, useAssignableStaff, friendlyRpcError } from '@/pages/support-teams/hooks';
import {
  routingStatusLabels,
  routingStatusColors,
  routingStatusIcons,
  routingConfidenceLabels,
} from '@/pages/support-teams/constants';
import { categoryLabels, priorityLabels } from '@/pages/support-tickets/constants';

interface RoutingPanelProps {
  ticket: TicketDetailRecord;
  canAssign: boolean;
  currentUserId?: string;
  onChanged: () => void;
}

type OpenMenu = 'team' | 'assign' | null;

const itemCls =
  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-foreground-100 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap';

export default function RoutingPanel({ ticket, canAssign, currentUserId, onChanged }: RoutingPanelProps) {
  const { teams } = useSupportTeams();
  const { staff: assignable, loading: staffLoading } = useAssignableStaff(ticket.id);

  const [open, setOpen] = useState<OpenMenu>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(null);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const teamName = teams.find((t) => t.id === ticket.team_id)?.name ?? null;
  const activeTeams = teams.filter((t) => t.status === 'active');
  const isAssignedToMe = ticket.assigned_to != null && ticket.assigned_to === currentUserId;

  const run = async (fn: () => Promise<{ error: unknown }>, successMsg: string) => {
    setBusy(true);
    setError('');
    const { error: e } = await fn();
    setBusy(false);
    if (e) {
      setError(friendlyRpcError(e));
      setToast({ message: friendlyRpcError(e), type: 'error' });
      return;
    }
    setToast({ message: successMsg, type: 'success' });
    setOpen(null);
    onChanged();
  };

  const handleReroute = () =>
    run(
      () => supabase.rpc('internal_route_ticket', { p_ticket_id: ticket.id }),
      'Ticket re-routed',
    );

  const handleChangeTeam = (teamId: string) =>
    run(
      () => supabase.rpc('internal_set_ticket_team', { p_ticket_id: ticket.id, p_team_id: teamId }),
      'Team changed',
    );

  const handleAssign = (userId: string) =>
    run(
      () => supabase.rpc('internal_assign_ticket', { p_ticket_id: ticket.id, p_staff_id: userId }),
      'Staff assigned',
    );

  const handleSelfAssign = () =>
    run(
      () => supabase.rpc('internal_self_assign_ticket', { p_ticket_id: ticket.id }),
      'Assigned to you',
    );

  const handleUnassign = () =>
    run(
      () => supabase.rpc('internal_unassign_ticket', { p_ticket_id: ticket.id }),
      'Ticket unassigned',
    );

  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg" ref={ref}>
      <div className="px-4 py-3 border-b border-background-200/60 flex items-center justify-between gap-2">
        <h2 className="text-xs font-label font-semibold text-foreground-500 uppercase tracking-wider flex items-center gap-2">
          <i className="ri-git-branch-line text-sm w-4 h-4 flex items-center justify-center"></i>
          Routing
        </h2>
        {ticket.routing_status !== 'unrouted' && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${routingStatusColors[ticket.routing_status]}`}>
            <i className={`${routingStatusIcons[ticket.routing_status]} text-xs w-3 h-3 flex items-center justify-center`}></i>
            {routingStatusLabels[ticket.routing_status]}
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wider mb-1">Team</p>
            <p className="text-sm text-foreground-100 font-medium truncate">
              {teamName ?? <span className="text-foreground-600 italic font-normal">No team</span>}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-label text-foreground-500 uppercase tracking-wider mb-1">Assigned</p>
            <p className="text-sm text-foreground-100 truncate">
              {ticket.assigned_agent ?? <span className="text-foreground-600 italic">Unassigned</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs text-foreground-500">
          <span className="px-2 py-0.5 rounded-full bg-background-200/60 whitespace-nowrap">{categoryLabels[ticket.category]}</span>
          <span className="px-2 py-0.5 rounded-full bg-background-200/60 whitespace-nowrap">{priorityLabels[ticket.priority]}</span>
          {ticket.escalation_level > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 whitespace-nowrap">
              Escalation {ticket.escalation_level}
            </span>
          )}
          {ticket.routing_confidence && (
            <span className="whitespace-nowrap">{routingConfidenceLabels[ticket.routing_confidence]} confidence</span>
          )}
        </div>

        {ticket.routing_reason && (
          <p className="text-xs text-foreground-400 leading-relaxed">
            {ticket.routing_reason}
          </p>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        {canAssign && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={handleReroute}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-sm text-foreground-200 px-3 py-1.5 rounded-lg border border-background-300/60 hover:bg-background-50 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <i className="ri-refresh-line text-sm w-4 h-4 flex items-center justify-center"></i>
              Re-route
            </button>

            {ticket.assigned_to == null && (
              <button
                type="button"
                onClick={handleSelfAssign}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-sm text-accent-400 px-3 py-1.5 rounded-lg border border-accent-500/40 hover:bg-accent-500/10 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <i className="ri-user-add-line text-sm w-4 h-4 flex items-center justify-center"></i>
                Assign to me
              </button>
            )}

            {ticket.assigned_to != null && (
              <button
                type="button"
                onClick={handleUnassign}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-sm text-foreground-400 px-3 py-1.5 rounded-lg border border-background-300/60 hover:text-foreground-100 hover:bg-background-50 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <i className="ri-user-unfollow-line text-sm w-4 h-4 flex items-center justify-center"></i>
                Unassign
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(open === 'team' ? null : 'team')}
                className="inline-flex items-center gap-1.5 text-sm text-foreground-200 px-3 py-1.5 rounded-lg border border-background-300/60 hover:bg-background-50 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <i className="ri-team-line text-sm w-4 h-4 flex items-center justify-center"></i>
                Change team
                <i className="ri-arrow-down-s-line text-sm w-4 h-4 flex items-center justify-center"></i>
              </button>
              {open === 'team' && (
                <div role="menu" className="absolute right-0 z-40 mt-1 w-56 bg-background-200 border border-background-300/70 rounded-lg shadow-[0_12px_40px_-8px_rgba(0,0,0,0.5)] p-1 max-h-72 overflow-y-auto">
                  {activeTeams.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-foreground-500">No teams available.</p>
                  ) : (
                    activeTeams.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="menuitem"
                        className={`${itemCls} ${ticket.team_id === t.id ? 'font-semibold text-accent-400' : ''}`}
                        onClick={() => handleChangeTeam(t.id)}
                      >
                        <span className="w-4 h-4 flex items-center justify-center">
                          {ticket.team_id === t.id && <i className="ri-check-line text-xs w-3 h-3 flex items-center justify-center"></i>}
                        </span>
                        {t.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(open === 'assign' ? null : 'assign')}
                className="inline-flex items-center gap-1.5 text-sm text-foreground-200 px-3 py-1.5 rounded-lg border border-background-300/60 hover:bg-background-50 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <i className="ri-user-line text-sm w-4 h-4 flex items-center justify-center"></i>
                Assign
                <i className="ri-arrow-down-s-line text-sm w-4 h-4 flex items-center justify-center"></i>
              </button>
              {open === 'assign' && (
                <div role="menu" className="absolute right-0 z-40 mt-1 w-64 bg-background-200 border border-background-300/70 rounded-lg shadow-[0_12px_40px_-8px_rgba(0,0,0,0.5)] p-1 max-h-72 overflow-y-auto">
                  {staffLoading ? (
                    <p className="px-3 py-2 text-sm text-foreground-500">Loading…</p>
                  ) : assignable.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-foreground-500">No eligible staff for this ticket.</p>
                  ) : (
                    assignable.map((s) => (
                      <button
                        key={s.user_id}
                        type="button"
                        role="menuitem"
                        className={`${itemCls} ${ticket.assigned_to === s.user_id ? 'font-semibold text-accent-400' : ''}`}
                        onClick={() => handleAssign(s.user_id)}
                      >
                        <span className="w-4 h-4 flex items-center justify-center">
                          {ticket.assigned_to === s.user_id && <i className="ri-check-line text-xs w-3 h-3 flex items-center justify-center"></i>}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{s.full_name || s.email || s.user_id}</span>
                        <span className="text-[10px] text-foreground-500 whitespace-nowrap">{s.open_tickets} open</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[120]">
          <div
            className={`px-4 py-3 rounded-lg border text-sm flex items-center gap-2 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.4)] ${
              toast.type === 'success'
                ? 'bg-background-200 border-emerald-500/40 text-emerald-300'
                : 'bg-background-200 border-red-500/40 text-red-300'
            }`}
          >
            <i className={`${toast.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'} text-base w-4 h-4 flex items-center justify-center`}></i>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}