import { useState } from 'react';
import { Star } from 'lucide-react';
import { useAppSelector } from '@/app/hooks';
import { useToggleFavoriteMutation } from '@/services/groupsApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { useDialog } from '@/components/common/DialogProvider';

// Grubu favorilere ekle / çıkar (yıldız). Üyesi olmadığım grup da favori olabilir; sadece ben görürüm.
// Yıldız anında değişir, sunucu hata verirse eski haline döner.
export default function FavoriteButton({
  groupId,
  isFavorite,
  variant = 'icon',
  className = '',
}: {
  groupId: string;
  isFavorite: boolean;
  variant?: 'icon' | 'button';
  className?: string;
}) {
  const token = useAppSelector((state) => state.auth.token);
  const [toggleFavorite, { isLoading }] = useToggleFavoriteMutation();
  // Yerel durum, yenilenen grup verisi yeni değeri getirene kadar tutulur (cevap ile yenileme arasında eski hale dönüp titremesin).
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [prevIsFavorite, setPrevIsFavorite] = useState(isFavorite);
  if (isFavorite !== prevIsFavorite) {
    setPrevIsFavorite(isFavorite);
    setOptimistic(null);
  }
  const dialog = useDialog();
  if (!token) return null;

  const active = optimistic ?? isFavorite;
  const label = active ? 'Remove from favorites' : 'Add to favorites';

  // Buton istek sırasında disabled yapılmaz ("yasak" imleci görünmesin); tekrar tıklama burada yok sayılır.
  const handleClick = async () => {
    if (isLoading) return;
    setOptimistic(!active);
    try {
      await toggleFavorite({ id: groupId, favorite: !active }).unwrap();
    } catch (err) {
      setOptimistic(null);
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  const star = <Star size={variant === 'icon' ? 18 : 16} className={active ? 'fill-amber-400 text-amber-400' : ''} />;

  if (variant === 'button') {
    return (
      <button type="button" onClick={handleClick} aria-pressed={active} className={`btn-secondary ${className}`}>
        {star} {active ? 'Favorited' : 'Favorite'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`relative z-[1] rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-500 transition-colors ${className}`}
    >
      {star}
    </button>
  );
}
