import { useEffect, useRef, useState } from 'react';
import type { TicketWithMeta } from '../hooks';
import type { TicketPriority, TicketStatus } from '@/types/support-tickets';
import { PRIORITY_OPTIONS, STATUS_OPTIONS, priorityLabels, statusLabels, isTerminalStatus } from '../constants';

interface TicketRowActionsProps {
  ticket: TicketWithMeta;
  canModify: boolean;
  currentUserId?: string;
  onOpen: () => void;
  onAssignToMe: () => void;
  onToggleRead: () => void;
  onChangePriority: (p: TicketPriority) => void;
  onChangeStatus: (s: TicketStatus) => void;
  onCopyNumber: () => void;
}

type Submenu = 'priority' | 'status' | null;

export default function TicketRowActions({
  ticket,
  canModify,
  currentUserId,
  onOpen,
  onAssignToMe,
  onToggleRead,
  onChangePriority,
  onChangeStatus,
  onCopyNumber,
}: TicketRowActionsProps) {
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<Submenu>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSubmenu(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setSubmenu(null);
      }
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const close = () => {
    setOpen(false);
    setSubmenu(null);
  };

  const isAssignedToMe = ticket.assigned_to === currentUserId;

  const itemCls =
    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-foreground-100 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Ticket actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
          setSubmenu(null);
        }}
        className="w-9 h-9 flex items-center justify-center text-foreground-400 hover:text-foreground-100 hover:bg-background-200/60 rounded-lg transition-colors cursor-pointer"
      >
        <i className="ri-more-2-fill text-lg w-5 h-5 flex items-center justify-center"></i>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 w-60 bg-background-200 border border-background-300/70 rounded-lg shadow-[0_12px_40px_-8px_rgba(0,0,0,0.5)] p-1"
        >
          {submenu === null && (
            <>
              <button type="button" role="menuitem" className={itemCls} onClick={() => { close(); onOpen(); }}>
                <i className="ri-eye-line text-sm w-4 h-4 flex items-center justify-center text-foreground-500"></i>
                Open ticket
              </button>

              {canModify && (
                <>
                  {!isAssignedToMe && (
                    <button type="button" role="menuitem" className={itemCls} onClick={() => { close(); onAssignToMe(); }}>
                      <i className="ri-user-add-line text-sm w-4 h-4 flex items-center justify-center text-foreground-500"></i>
                      Assign to me
                    </button>
                  )}
                  <button type="button" role="menuitem" className={itemCls} onClick={() => { close(); onToggleRead(); }}>
                    <i className={`${ticket.is_unread ? 'ri-mail-check-line' : 'ri-mail-unread-line'} text-sm w-4 h-4 flex items-center justify-center text-foreground-500`}></i>
                    {ticket.is_unread ? 'Mark as read' : 'Mark as unread'}
                  </button>
                  <button type="button" role="menuitem" className={itemCls} onClick={() => setSubmenu('priority')}>
                    <i className="ri-flag-line text-sm w-4 h-4 flex items-center justify-center text-foreground-500"></i>
                    Change priority
                    <i className="ri-arrow-right-s-line ml-auto text-sm w-4 h-4 flex items-center justify-center text-foreground-500"></i>
                  </button>
                  <button type="button" role="menuitem" className={itemCls} onClick={() => setSubmenu('status')}>
                    <i className="ri-git-commit-line text-sm w-4 h-4 flex items-center justify-center text-foreground-500"></i>
                    Change status
                    <i className="ri-arrow-right-s-line ml-auto text-sm w-4 h-4 flex items-center justify-center text-foreground-500"></i>
                  </button>
                </>
              )}

              <button type="button" role="menuitem" className={itemCls} onClick={() => { close(); onCopyNumber(); }}>
                <i className="ri-file-copy-line text-sm w-4 h-4 flex items-center justify-center text-foreground-500"></i>
                Copy ticket number
              </button>
            </>
          )}

          {submenu === 'priority' && (
            <>
              <button
                type="button"
                className={itemCls}
                onClick={() => setSubmenu(null)}
              >
                <i className="ri-arrow-left-s-line text-sm w-4 h-4 flex items-center justify-center text-foreground-500"></i>
                Back
              </button>
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="menuitem"
                  className={`${itemCls} ${ticket.priority === p ? 'font-semibold text-accent-400' : ''}`}
                  onClick={() => { close(); onChangePriority(p); }}
                >
                  <span className="w-4 h-4 flex items-center justify-center">
                    {ticket.priority === p && <i className="ri-check-line text-xs w-3 h-3 flex items-center justify-center"></i>}
                  </span>
                  {priorityLabels[p]}
                </button>
              ))}
            </>
          )}

          {submenu === 'status' && (
            <>
              <button type="button" className={itemCls} onClick={() => setSubmenu(null)}>
                <i className="ri-arrow-left-s-line text-sm w-4 h-4 flex items-center justify-center text-foreground-500"></i>
                Back
              </button>
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="menuitem"
                  className={`${itemCls} ${ticket.status === s ? 'font-semibold text-accent-400' : ''}`}
                  onClick={() => { close(); onChangeStatus(s); }}
                >
                  <span className="w-4 h-4 flex items-center justify-center">
                    {ticket.status === s && <i className="ri-check-line text-xs w-3 h-3 flex items-center justify-center"></i>}
                  </span>
                  {statusLabels[s]}
                  {isTerminalStatus(s) && <span className="ml-auto text-[10px] text-foreground-500">confirms</span>}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}