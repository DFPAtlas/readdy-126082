import { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'dialog';
  /** Prevents scroll on body while open */
  lockScroll?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className = '',
  variant = 'default',
  lockScroll = true,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lockScroll) return;
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open, lockScroll]);

  if (!open) return null;

  const isDialog = variant === 'dialog';

  return (
    <div
      className={`fixed inset-0 z-[100] flex ${isDialog ? 'items-center justify-center' : 'items-start justify-center pt-[10vh]'} px-4`}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? 'Dialog'}
    >
      {/* Overlay with blur for strong visual separation */}
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* Modal container — solid, clearly lighter than the page, visible border + shadow */}
      <div
        className={`relative bg-background-200 border border-background-400/70 ring-1 ring-black/40 rounded-xl w-full flex flex-col shadow-[0_24px_70px_-12px_rgba(0,0,0,0.75)] ${
          isDialog ? 'max-w-sm mx-auto' : 'max-h-[80vh]'
        } ${className}`}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-background-400/60 shrink-0">
            <h2 className="text-lg font-heading font-semibold text-foreground-50">
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="w-8 h-8 flex items-center justify-center text-foreground-300 hover:text-foreground-50 hover:bg-background-400/50 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-lg w-5 h-5 flex items-center justify-center"></i>
            </button>
          </div>
        )}

        {/* Body */}
        <div className={`flex-1 ${isDialog ? '' : 'overflow-y-auto'} ${!title && !footer ? '' : ''}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-background-400/60 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}