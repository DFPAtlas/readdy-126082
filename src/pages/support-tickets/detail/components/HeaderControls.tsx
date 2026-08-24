import { useEffect, useRef, useState } from 'react';
import type { TicketStatus, TicketPriority } from '@/types/support-tickets';
import { STATUS_OPTIONS, PRIORITY_OPTIONS, statusLabels, priorityLabels, isTerminalStatus } from '@/pages/support-tickets/constants';
import type { TicketDetailRecord } from '../hooks';

type OpenMenu = 'status' | 'priority' | null;

interface HeaderControlsProps {
  ticket: TicketDetailRecord;
  canModify: boolean;
  onChangeStatus: (s: TicketStatus) => void;
  onChangePriority: (p: TicketPriority) => void;
  onToggleRead: () => void;
  onCopyNumber: () => void;
}

export default function HeaderControls({
  ticket,
  canModify,
  onChangeStatus,
  onChangePriority,
  onToggleRead,
  onCopyNumber,
}: HeaderControlsProps) {
  const [open, setOpen] = useState<OpenMenu>(null);
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

  const triggerCls =
    'inline-flex items-center gap-1.5 text-sm text-foreground-200 px-3 py-2 rounded-lg border border-background-300/60 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap';
  const menuCls =
    'absolute right-0 z-40 mt-1 w-60 bg-background-200 border border-background-300/70 rounded-lg shadow-[0_12px_40px_-8px_rgba(0,0,0,0.5)] p-1 max-h-72 overflow-y-auto';
  const itemCls =
    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-foreground-100 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap';

  return (
    <div className="flex items-center gap-2 flex-wrap" ref={ref}>
      {canModify && (
        <div className="relative">
          <button type="button" className={triggerCls} onClick={() => setOpen(open === 'status' ? null : 'status')}>
            <i className="ri-git-commit-line w-4 h-4 flex items-center justify-center"></i>
            {statusLabels[ticket.status]}
            <i className="ri-arrow-down-s-line text-sm w-4 h-4 flex items-center justify-center"></i>
          </button>
          {open === 'status' && (
            <div role="menu" className={menuCls}>
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="menuitem"
                  className={`${itemCls} ${ticket.status === s ? 'font-semibold text-accent-400' : ''}`}
                  onClick={() => { onChangeStatus(s); setOpen(null); }}
                >
                  <span className="w-4 h-4 flex items-center justify-center">
                    {ticket.status === s && <i className="ri-check-line text-xs w-3 h-3 flex items-center justify-center"></i>}
                  </span>
                  {statusLabels[s]}
                  {isTerminalStatus(s) && <span className="ml-auto text-[10px] text-foreground-500">confirms</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {canModify && (
        <div className="relative">
          <button type="button" className={triggerCls} onClick={() => setOpen(open === 'priority' ? null : 'priority')}>
            <i className="ri-flag-line w-4 h-4 flex items-center justify-center"></i>
            {priorityLabels[ticket.priority]}
            <i className="ri-arrow-down-s-line text-sm w-4 h-4 flex items-center justify-center"></i>
          </button>
          {open === 'priority' && (
            <div role="menu" className={menuCls}>
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="menuitem"
                  className={`${itemCls} ${ticket.priority === p ? 'font-semibold text-accent-400' : ''}`}
                  onClick={() => { onChangePriority(p); setOpen(null); }}
                >
                  <span className="w-4 h-4 flex items-center justify-center">
                    {ticket.priority === p && <i className="ri-check-line text-xs w-3 h-3 flex items-center justify-center"></i>}
                  </span>
                  {priorityLabels[p]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {canModify && (
        <button type="button" onClick={onToggleRead} className={triggerCls} title={ticket.is_unread ? 'Mark as read' : 'Mark as unread'}>
          <i className={`${ticket.is_unread ? 'ri-mail-check-line' : 'ri-mail-unread-line'} w-4 h-4 flex items-center justify-center`}></i>
          {ticket.is_unread ? 'Mark read' : 'Mark unread'}
        </button>
      )}

      <button type="button" onClick={onCopyNumber} className={triggerCls} title="Copy ticket number">
        <i className="ri-file-copy-line w-4 h-4 flex items-center justify-center"></i>
        Copy
      </button>
    </div>
  );
}