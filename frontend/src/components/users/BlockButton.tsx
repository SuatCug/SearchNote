import { Ban, ShieldCheck } from 'lucide-react';
import { useToggleBlockMutation } from '@/services/usersApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { useDialog } from '@/components/common/DialogProvider';

// Engelle / engeli kaldır. Engellenince karşılıklı takip kalkar ve iki taraf birbirine mesaj atamaz.
// variant: 'link' sade yazı bağlantısı, 'menu' açılır menü satırı, 'button' çerçeveli buton.
// onDone: tıklama işlendikten sonra (onaylansın ya da vazgeçilsin) çağrılır; menüyü kapatmak için.
interface BlockButtonProps {
  userId: string;
  isBlocked: boolean;
  name: string;
  variant?: 'link' | 'menu' | 'button';
  onDone?: () => void;
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<BlockButtonProps['variant']>, { block: string; unblock: string }> = {
  link: {
    block: 'inline-flex items-center justify-center gap-1.5 text-sm font-medium text-gray-400 hover:text-rose-500',
    unblock: 'inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-navy-600 hover:text-navy-800',
  },
  menu: {
    block: 'w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50',
    unblock: 'w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-gray-800 hover:bg-gray-50',
  },
  button: {
    block: 'btn-secondary text-rose-600 hover:bg-rose-50 hover:border-rose-200',
    unblock: 'btn-secondary',
  },
};

export default function BlockButton({ userId, isBlocked, name, variant = 'link', onDone, className = '' }: BlockButtonProps) {
  const [toggleBlock, { isLoading }] = useToggleBlockMutation();
  // Buton istek sırasında pasif yapılmaz (profil zaten iyimser olarak değişir); tekrar tıklama yok sayılır.
  const dialog = useDialog();

  const handleClick = async () => {
    onDone?.();
    if (isLoading) return;
    const ok = await dialog.confirm(
      isBlocked
        ? {
            title: `Unblock ${name}?`,
            message: 'You will be able to follow and message each other again.',
            confirmLabel: 'Unblock',
          }
        : {
            title: `Block ${name}?`,
            message: "You won't be able to message each other, and any follows between you will be removed.",
            confirmLabel: 'Block',
            tone: 'danger',
          }
    );
    if (!ok) return;
    try {
      await toggleBlock({ id: userId, blocked: isBlocked }).unwrap();
    } catch (err) {
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  const Icon = isBlocked ? ShieldCheck : Ban;
  const label = isBlocked ? 'Unblock' : 'Block';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`transition-colors ${VARIANT_CLASSES[variant][isBlocked ? 'unblock' : 'block']} ${className}`}
    >
      <Icon size={15} className="shrink-0" />
      {variant === 'menu' ? <span className="truncate">{`${label} ${name}`}</span> : label}
    </button>
  );
}
