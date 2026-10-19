import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Tarayıcının window.confirm / window.alert pencereleri yerine uygulamaya uygun, ekranın ortasında açılan pencere.
// Kullanım: const dialog = useDialog();
//   if (!(await dialog.confirm({ title: 'Delete note?', message: '...', confirmLabel: 'Delete', tone: 'danger' }))) return;
//   dialog.alert({ message: getErrorMessage(err) });

type Tone = 'danger' | 'default';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
}

interface AlertOptions {
  title?: string;
  message: ReactNode;
  buttonLabel?: string;
}

interface DialogApi {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
}

interface OpenDialog {
  kind: 'confirm' | 'alert';
  title: string;
  message?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  tone: Tone;
  resolve: (value: boolean) => void;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside <DialogProvider>');
  return ctx;
}

export default function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<OpenDialog | null>(null);

  // Açıkken yeni pencere istenirse önceki "vazgeçildi" sayılır.
  const open = useCallback((next: OpenDialog) => {
    setDialog((prev) => {
      prev?.resolve(false);
      return next;
    });
  }, []);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (o) =>
        new Promise<boolean>((resolve) =>
          open({
            kind: 'confirm',
            title: o.title,
            message: o.message,
            confirmLabel: o.confirmLabel ?? 'Confirm',
            cancelLabel: o.cancelLabel ?? 'Cancel',
            tone: o.tone ?? 'default',
            resolve,
          })
        ),
      alert: (o) =>
        new Promise<void>((resolve) =>
          open({
            kind: 'alert',
            title: o.title ?? 'Something went wrong',
            message: o.message,
            confirmLabel: o.buttonLabel ?? 'OK',
            cancelLabel: '',
            tone: 'danger',
            resolve: () => resolve(),
          })
        ),
    }),
    [open]
  );

  const close = (result: boolean) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog && <DialogWindow dialog={dialog} onClose={close} />}
    </DialogContext.Provider>
  );
}

function DialogWindow({ dialog, onClose }: { dialog: OpenDialog; onClose: (result: boolean) => void }) {
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    // Yıkıcı işlemlerde odak "Cancel"da başlar: yanlışlıkla Enter'a basılınca bir şey silinmesin.
    firstButtonRef.current?.focus();
    // Yakalama aşamasında dinlenir ve durdurulur: altta açık bir pencere (örn. LikesModal) varsa Esc onu da kapatmasın.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onCloseRef.current(false);
    };
    window.addEventListener('keydown', onKey, true);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, []);

  const { kind, tone } = dialog;
  // Uyarı (alert) penceresinin tek butonu mavi; onayda yıkıcı işlem kırmızı, diğerleri mavi (mobildeki gibi).
  const danger = kind === 'confirm' && tone === 'danger';
  const buttonClass =
    'block w-full min-h-12 border-t border-[#dbdbdb] px-4 py-3 text-center text-[15px] transition-colors hover:bg-gray-50 active:bg-[#f2f2f2] focus:outline-none focus-visible:bg-gray-100';

  // Instagram tarzı pencere (mobil uygulamadaki DialogHost ile aynı): ortada beyaz kart, başlık + kısa metin,
  // altında ince çizgiyle ayrılmış, alt alta yazı butonları (önce onay, sonra Cancel).
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-12" role="presentation">
      <div className="dialog-backdrop absolute inset-0 bg-black/60" onClick={() => onClose(false)} aria-hidden="true" />
      <div
        role={kind === 'alert' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={dialog.message ? 'dialog-message' : undefined}
        className="dialog-in relative w-full max-w-[400px] max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-[14px] bg-white text-center shadow-2xl"
      >
        <div className="px-6 pt-7 pb-6">
          <h2 id="dialog-title" className="text-lg font-semibold text-gray-900 break-words">
            {dialog.title}
          </h2>
          {dialog.message && (
            <p id="dialog-message" className="mt-2 text-sm leading-[19px] text-gray-500 break-words">
              {dialog.message}
            </p>
          )}
        </div>
        <button
          ref={kind === 'alert' ? firstButtonRef : undefined}
          type="button"
          onClick={() => onClose(true)}
          className={`${buttonClass} font-bold ${danger ? 'text-[#ed4956]' : 'text-[#0095f6]'}`}
        >
          {dialog.confirmLabel}
        </button>
        {kind === 'confirm' && (
          // Yıkıcı işlemlerde odak "Cancel"da başlar: yanlışlıkla Enter'a basılınca bir şey silinmesin.
          <button ref={firstButtonRef} type="button" onClick={() => onClose(false)} className={`${buttonClass} text-gray-900`}>
            {dialog.cancelLabel}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
