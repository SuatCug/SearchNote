import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md';
}

// Telefonda alttan açılan sayfa, büyük ekranda ortada pencere (LikesModal ile aynı görünüm).
// Esc ve arka plana tıklama kapatır; açıkken arkadaki sayfa kaymaz.
export default function Modal({ title, onClose, children, footer, size = 'md' }: ModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4" role="presentation">
      <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[85vh] sm:max-h-[min(640px,85vh)] w-full ${
          size === 'sm' ? 'sm:max-w-sm' : 'sm:max-w-md'
        } flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl pb-safe`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
          <h2 id={titleId} className="flex min-w-0 items-center gap-2 text-base font-bold text-gray-900">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </header>
        <div className="overflow-y-auto overscroll-contain">{children}</div>
        {footer && <footer className="border-t border-gray-100 px-5 py-3.5">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}
