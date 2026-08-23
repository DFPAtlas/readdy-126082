import { useRef, useState } from 'react';

export type ReplyMode = 'reply' | 'note';

export interface ReplyResult {
  success: boolean;
  message: string;
}

interface ReplyComposerProps {
  canModify: boolean;
  submitting: boolean;
  onSubmit: (mode: ReplyMode, text: string, files: File[]) => Promise<ReplyResult>;
}

const MAX_LENGTH = 20000;
const BLOCKED_EXT = ['exe', 'dll', 'bat', 'cmd', 'ps1', 'js', 'html', 'svg', 'sh', 'msi'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ReplyComposer({ canModify, submitting, onSubmit }: ReplyComposerProps) {
  const [mode, setMode] = useState<ReplyMode>('reply');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'info' | 'success'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!canModify) {
    return (
      <div className="bg-background-100 border border-background-200/60 rounded-lg px-4 py-4 text-center">
        <p className="text-sm text-foreground-500">
          You have read-only access. Contact an owner or admin to reply to this ticket.
        </p>
      </div>
    );
  }

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    for (const f of incoming) {
      const ext = (f.name.split('.').pop() ?? '').toLowerCase();
      if (BLOCKED_EXT.includes(ext)) {
        setFeedback({ type: 'error', message: `"${f.name}" is not an allowed file type.` });
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        setFeedback({ type: 'error', message: `"${f.name}" exceeds the 10 MB limit.` });
        return;
      }
    }
    setFiles((prev) => [...prev, ...incoming]);
    setFeedback(null);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setFeedback({ type: 'error', message: 'Write a message before sending.' });
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setFeedback({ type: 'error', message: 'Message is too long.' });
      return;
    }
    setFeedback(null);
    const result = await onSubmit(mode, trimmed, files);
    setFeedback({
      type: result.success ? 'success' : 'error',
      message: result.message,
    });
    if (result.success) {
      setText('');
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const modeCls = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
      active
        ? 'bg-background-50 text-foreground-50 shadow-[0_1px_3px_rgba(0,0,0,0.3)]'
        : 'text-foreground-500 hover:text-foreground-200'
    }`;

  return (
    <div className="bg-background-100 border border-background-200/60 rounded-lg p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        {/* Mode toggle */}
        <div
          className="inline-flex items-center p-1 rounded-full bg-background-200/60"
          role="tablist"
          aria-label="Composer mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'reply'}
            onClick={() => setMode('reply')}
            className={modeCls(mode === 'reply')}
          >
            Reply to customer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'note'}
            onClick={() => setMode('note')}
            className={modeCls(mode === 'note')}
          >
            Internal note
          </button>
        </div>

        <span className="text-[11px] text-foreground-600 whitespace-nowrap">
          {text.length}/{MAX_LENGTH}
        </span>
      </div>

      {mode === 'note' && (
        <p className="mb-2 text-[11px] text-amber-400 flex items-center gap-1.5">
          <i className="ri-lock-line w-4 h-4 flex items-center justify-center"></i>
          Internal notes are never sent to the customer.
        </p>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={MAX_LENGTH}
        placeholder={mode === 'reply' ? 'Write a reply to the customer…' : 'Add a private internal note…'}
        aria-label={mode === 'reply' ? 'Reply message' : 'Internal note message'}
        className="w-full bg-background-50 border border-background-300/60 focus:border-accent-500/40 rounded-lg px-3 py-2 text-sm text-foreground-100 placeholder:text-foreground-600 outline-none transition-colors resize-y"
      />

      {files.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-background-200/50">
              <i className="ri-file-line text-foreground-500 w-4 h-4 flex items-center justify-center"></i>
              <div className="min-w-0 flex-1">
                <span className="text-xs text-foreground-200 truncate block">{f.name}</span>
                <span className="text-[10px] text-foreground-600">{formatFileSize(f.size)}</span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(i)}
                aria-label={`Remove ${f.name}`}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-foreground-500 hover:text-red-400 hover:bg-background-300/40 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-base w-4 h-4 flex items-center justify-center"></i>
              </button>
            </div>
          ))}
        </div>
      )}

      {feedback && (
        <div
          className={`mt-3 px-3 py-2 rounded-lg text-sm border ${
            feedback.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-secondary-500/10 border-secondary-500/20 text-secondary-300'
          }`}
          role="status"
        >
          {feedback.message}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => addFiles(e.target.files)}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 text-sm text-foreground-400 hover:text-foreground-200 transition-colors px-3 py-2 rounded-lg border border-background-300/60 cursor-pointer whitespace-nowrap disabled:opacity-40"
          >
            <i className="ri-attachment-2 w-4 h-4 flex items-center justify-center"></i>
            Attach
          </button>
          {(text.trim() || files.length > 0) && (
            <button
              type="button"
              onClick={() => {
                setText('');
                setFiles([]);
                setFeedback(null);
              }}
              disabled={submitting}
              className="text-sm text-foreground-500 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !text.trim()}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 ${
            mode === 'note'
              ? 'bg-secondary-500 hover:bg-secondary-400 text-background-950'
              : 'bg-accent-500 hover:bg-accent-400 text-background-950'
          }`}
        >
          {submitting ? 'Sending…' : mode === 'note' ? 'Add note' : 'Send reply'}
        </button>
      </div>
    </div>
  );
}