import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Copy, CornerUpRight, Pencil, Reply, Trash2 } from 'lucide-react';

export type MessageAction = 'reply' | 'forward' | 'copy' | 'edit' | 'delete';

interface MessageActionMenuProps {
  // Basılı tutulan balonun ekrandaki konumu: kopyası aynı yere çizilir, menü altına (sığmazsa üstüne) açılır.
  rect: DOMRect;
  mine: boolean;
  bubble: ReactNode;
  canEdit: boolean;
  canDelete: boolean;
  onAction: (action: MessageAction) => void;
  onClose: () => void;
}

const GAP = 8;
const EDGE = 12;
const MENU_WIDTH = 244;

// Mesajı basılı tutunca (masaüstünde sağ tık / "⋯") açılan menü: arka plan karartılır, mesaj öne çıkar.
export default function MessageActionMenu({ rect, mine, bubble, canEdit, canDelete, onAction, onClose }: MessageActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuTop, setMenuTop] = useState<number | null>(null);
  // Basılı tutma bitince parmağın kalkmasıyla gelen tıklama arka plana düşer; menü sadece arka planda
  // başlayan yeni bir dokunuş/tıklamayla kapanır.
  const pressedBackdrop = useRef(false);

  // Menü yüksekliği ölçüldükten sonra konumlanır.
  useLayoutEffect(() => {
    const height = menuRef.current?.offsetHeight ?? 0;
    const vh = window.innerHeight;
    let top = rect.bottom + GAP;
    if (top + height > vh - EDGE) {
      top = rect.top - GAP - height >= EDGE ? rect.top - GAP - height : Math.max(EDGE, vh - height - EDGE);
    }
    setMenuTop(top);
  }, [rect]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    // Ekran kayarsa / boyutu değişirse konum bozulmasın diye menü kapanır.
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const vw = window.innerWidth;
  const width = Math.min(MENU_WIDTH, vw - EDGE * 2);
  const left = Math.min(Math.max(EDGE, mine ? rect.right - width : rect.left), vw - width - EDGE);

  const item = (action: MessageAction, label: string, icon: ReactNode, danger = false) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => onAction(action)}
      className={`w-full flex items-center justify-between px-4 py-3 text-[15px] font-medium focus:outline-none focus-visible:bg-gray-100 hover:bg-gray-50 active:bg-gray-100 ${
        danger ? 'text-rose-700 font-semibold' : 'text-gray-900'
      }`}
    >
      {label}
      {icon}
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-[90]" role="presentation">
      <div
        className="absolute inset-0 bg-navy-950/25 backdrop-blur-[2px]"
        onPointerDown={() => {
          pressedBackdrop.current = true;
        }}
        onClick={() => pressedBackdrop.current && onClose()}
        onContextMenu={(e) => e.preventDefault()}
      />
      {/* Basılı tutulan mesajın kopyası, aynı konumda */}
      <div
        className="absolute pointer-events-none select-none"
        style={{ top: rect.top, left: rect.left, width: rect.width }}
        aria-hidden="true"
      >
        {bubble}
      </div>
      <div
        ref={menuRef}
        role="menu"
        aria-label="Message actions"
        className="sheet-up absolute overflow-hidden rounded-2xl bg-white py-1 shadow-2xl ring-1 ring-black/5"
        style={{ top: menuTop ?? -9999, left, width, visibility: menuTop === null ? 'hidden' : 'visible' }}
      >
        {item('reply', 'Reply', <Reply size={19} />)}
        {item('forward', 'Forward', <CornerUpRight size={19} />)}
        {item('copy', 'Copy', <Copy size={19} />)}
        {canEdit && item('edit', 'Edit', <Pencil size={18} />)}
        {canDelete && (
          <>
            <div className="mx-3 my-1 h-px bg-gray-200" />
            {item('delete', 'Delete', <Trash2 size={18} />, true)}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
