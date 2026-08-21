import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'accent';
  onConfirm: () => void;
  loading?: boolean;
  children?: React.ReactNode;
}

export default function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel = 'Delete',
  confirmVariant = 'danger',
  onConfirm,
  loading = false,
  children,
}: ConfirmDialogProps) {
  const isDanger = confirmVariant === 'danger';

  return (
    <Modal open={open} onClose={onClose} title={title} variant="dialog">
      <div className="p-5">
        <p className="text-sm text-foreground-300 leading-relaxed">{message}</p>
        {children}
        <div className="flex items-center justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-foreground-400 hover:text-foreground-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 ${
              isDanger
                ? 'bg-red-500 hover:bg-red-400 text-white'
                : 'bg-accent-500 hover:bg-accent-400 text-background-950'
            }`}
          >
            {loading ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}