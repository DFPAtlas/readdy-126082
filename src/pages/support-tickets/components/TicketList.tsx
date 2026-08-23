import type { TicketWithMeta, StaffOption } from '../hooks';
import type { TicketPriority, TicketStatus } from '@/types/support-tickets';
import {
  statusLabels,
  priorityLabels,
  categoryLabels,
  statusColors,
  priorityColors,
  statusIcons,
  priorityIcons,
  isOverdue,
  formatDateTime,
  formatRelative,
  overdueDuration,
} from '../constants';
import TicketRowActions from './TicketRowActions';
import { assigneeName } from '../hooks';

interface TicketListProps {
  tickets: TicketWithMeta[];
  staff: StaffOption[];
  canModify: boolean;
  currentUserId?: string;
  onOpen: (t: TicketWithMeta) => void;
  onAssignToMe: (t: TicketWithMeta) => void;
  onToggleRead: (t: TicketWithMeta) => void;
  onChangePriority: (t: TicketWithMeta, p: TicketPriority) => void;
  onChangeStatus: (t: TicketWithMeta, s: TicketStatus) => void;
  onCopyNumber: (t: TicketWithMeta) => void;
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${priorityColors[priority]}`}>
      <i className={`${priorityIcons[priority]} text-xs w-3 h-3 flex items-center justify-center`}></i>
      {priorityLabels[priority]}
    </span>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-label px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[status]}`}>
      <i className={`${statusIcons[status]} text-xs w-3 h-3 flex items-center justify-center`}></i>
      {statusLabels[status]}
    </span>
  );
}

export default function TicketList({
  tickets,
  staff,
  canModify,
  currentUserId,
  onOpen,
  onAssignToMe,
  onToggleRead,
  onChangePriority,
  onChangeStatus,
  onCopyNumber,
}: TicketListProps) {
  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden md:block bg-background-100 border border-background-200/60 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-background-100 z-10">
              <tr className="border-b border-background-200/60">
                <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap w-8">
                  <span className="sr-only">Unread</span>
                </th>
                <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Ticket</th>
                <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Website</th>
                <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Customer</th>
                <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Priority</th>
                <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">Assigned</th>
                <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap">Last activity</th>
                <th className="px-4 py-3 text-xs font-label text-foreground-400 uppercase tracking-wide whitespace-nowrap w-10">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => {
                const overdue = isOverdue(t.due_at, t.status);
                const assignee = assigneeName(t, staff);
                return (
                  <tr
                    key={t.id}
                    onClick={() => onOpen(t)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpen(t);
                      }
                    }}
                    className="border-b border-background-200/40 hover:bg-background-50/60 transition-colors cursor-pointer focus:outline-none focus:bg-background-50/70"
                  >
                    <td className="px-4 py-3">
                      {t.is_unread && (
                        <span className="block w-2 h-2 rounded-full bg-accent-500" aria-label="Unread"></span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-mono text-foreground-500 whitespace-nowrap">{t.ticket_number}</span>
                      </div>
                      <div className="max-w-[280px]">
                        <span className={`text-sm font-medium truncate block ${t.is_unread ? 'text-foreground-50 font-semibold' : 'text-foreground-100'}`}>
                          {t.subject}
                        </span>
                        <span className="text-xs text-foreground-500">{categoryLabels[t.category]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-foreground-400 whitespace-nowrap">{t.site_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-foreground-100 whitespace-nowrap block">{t.customer_name ?? '—'}</span>
                      <span className="text-xs text-foreground-500 whitespace-nowrap block truncate max-w-[180px]">{t.customer_email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {assignee ? (
                        <span className="text-xs text-foreground-300 whitespace-nowrap">{assignee}</span>
                      ) : (
                        <span className="text-xs text-foreground-600 italic whitespace-nowrap">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        {t.is_unread ? (
                          <span className="text-xs text-accent-400">New</span>
                        ) : (
                          <span className="text-xs text-foreground-500">{formatRelative(t.last_activity_at)}</span>
                        )}
                        {t.message_count > 0 && (
                          <span className="text-[10px] text-foreground-600 whitespace-nowrap">{t.message_count} msg</span>
                        )}
                      </div>
                      {overdue && (
                        <span className="text-[11px] text-red-400 font-medium whitespace-nowrap block">
                          {t.due_at ? overdueDuration(t.due_at) : 'Overdue'}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <div onClick={(e) => e.stopPropagation()}>
                        <TicketRowActions
                          ticket={t}
                          canModify={canModify}
                          currentUserId={currentUserId}
                          onOpen={() => onOpen(t)}
                          onAssignToMe={() => onAssignToMe(t)}
                          onToggleRead={() => onToggleRead(t)}
                          onChangePriority={(p) => onChangePriority(t, p)}
                          onChangeStatus={(s) => onChangeStatus(t, s)}
                          onCopyNumber={() => onCopyNumber(t)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {tickets.map((t) => {
          const overdue = isOverdue(t.due_at, t.status);
          const assignee = assigneeName(t, staff);
          return (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(t)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpen(t);
                }
              }}
              className="bg-background-100 border border-background-200/60 rounded-lg p-3.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-500/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {t.is_unread && <span className="w-2 h-2 rounded-full bg-accent-500 shrink-0" aria-label="Unread"></span>}
                  <span className="text-[11px] font-mono text-foreground-500 whitespace-nowrap">{t.ticket_number}</span>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <TicketRowActions
                    ticket={t}
                    canModify={canModify}
                    currentUserId={currentUserId}
                    onOpen={() => onOpen(t)}
                    onAssignToMe={() => onAssignToMe(t)}
                    onToggleRead={() => onToggleRead(t)}
                    onChangePriority={(p) => onChangePriority(t, p)}
                    onChangeStatus={(s) => onChangeStatus(t, s)}
                    onCopyNumber={() => onCopyNumber(t)}
                  />
                </div>
              </div>

              <p className={`text-sm mt-1.5 ${t.is_unread ? 'font-semibold text-foreground-50' : 'text-foreground-100'}`}>
                {t.subject}
              </p>

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <PriorityBadge priority={t.priority} />
                <StatusBadge status={t.status} />
                {overdue && (
                  <span className="text-[11px] text-red-400 font-medium whitespace-nowrap">
                    {t.due_at ? overdueDuration(t.due_at) : 'Overdue'}
                  </span>
                )}
              </div>

              <div className="mt-2.5 pt-2.5 border-t border-background-200/50 text-xs text-foreground-500 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="whitespace-nowrap">{t.site_name}</span>
                  <span className="whitespace-nowrap">{formatDateTime(t.created_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="truncate">{t.customer_name ?? '—'} · {t.customer_email}</span>
                  <span className="whitespace-nowrap">{formatRelative(t.last_activity_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="whitespace-nowrap">{categoryLabels[t.category]}</span>
                  <span className="whitespace-nowrap">{assignee || 'Unassigned'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}