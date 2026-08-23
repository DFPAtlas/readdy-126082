import type { TicketMessage, TicketAttachment, TicketSenderType } from '@/types/support-tickets';
import { formatFullDateTime } from '@/pages/support-tickets/constants';

const senderMeta: Record<TicketSenderType, { label: string; icon: string; color: string }> = {
  customer: { label: 'Customer', icon: 'ri-user-line', color: 'bg-accent-500/15 text-accent-400' },
  staff: { label: 'Staff', icon: 'ri-shield-user-line', color: 'bg-primary-500/15 text-primary-400' },
  system: { label: 'System', icon: 'ri-settings-3-line', color: 'bg-foreground-500/15 text-foreground-400' },
  ai_agent: { label: 'AI Agent', icon: 'ri-robot-line', color: 'bg-secondary-500/15 text-secondary-300' },
};

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime: string | null): string {
  if (mime?.startsWith('image/')) return 'ri-image-line';
  if (mime === 'application/pdf') return 'ri-file-pdf-line';
  if (mime?.startsWith('text/')) return 'ri-file-text-line';
  return 'ri-file-line';
}

interface MessageItemProps {
  message: TicketMessage;
  attachments: TicketAttachment[];
  onDownload: (attachmentId: string) => void;
}

export default function MessageItem({ message, attachments, onDownload }: MessageItemProps) {
  const meta = senderMeta[message.sender_type] ?? senderMeta.system;
  const isNote = message.is_internal_note;

  return (
    <div
      className={`rounded-lg border p-4 ${
        isNote
          ? 'bg-amber-500/[0.06] border-amber-500/20'
          : 'bg-background-100 border-background-200/60'
      }`}
    >
      {/* Sender header */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${meta.color}`}>
          <i className={`${meta.icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground-100">
              {message.sender_name ?? message.sender_email ?? meta.label}
            </span>
            {message.sender_email && message.sender_email !== message.sender_name && (
              <span className="text-xs text-foreground-500 break-all">{message.sender_email}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-label uppercase tracking-wide ${meta.color} px-1.5 py-0.5 rounded whitespace-nowrap`}>
              {meta.label}
            </span>
            <time className="text-[11px] text-foreground-600" dateTime={message.created_at}>
              {formatFullDateTime(message.created_at)}
            </time>
          </div>
        </div>
      </div>

      {/* Internal note banner */}
      {isNote && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-amber-400">
          <i className="ri-lock-line w-4 h-4 flex items-center justify-center"></i>
          <span aria-label="Internal note">Internal note — not visible to customer</span>
        </div>
      )}

      {/* Body — plain text, preserved line breaks, no HTML rendering */}
      <p className="mt-3 text-sm text-foreground-200 leading-relaxed whitespace-pre-wrap break-words">
        {message.message_body}
      </p>

      {/* Attachments linked to this message */}
      {attachments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-background-200/40 space-y-1.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-background-200/50"
            >
              <i className={`${fileIcon(att.mime_type)} text-foreground-500 w-5 h-5 flex items-center justify-center`}></i>
              <div className="min-w-0 flex-1">
                <span className="text-xs text-foreground-200 truncate block">{att.file_name}</span>
                <span className="text-[10px] text-foreground-600">{formatFileSize(att.file_size)}</span>
              </div>
              <button
                type="button"
                onClick={() => onDownload(att.id)}
                aria-label={`Download ${att.file_name}`}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-400 hover:text-foreground-100 hover:bg-background-300/40 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-download-line text-base w-4 h-4 flex items-center justify-center"></i>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}