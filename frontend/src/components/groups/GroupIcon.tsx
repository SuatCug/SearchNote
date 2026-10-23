import { assetUrl } from '@/lib/assetUrl';
import { groupCode, groupColor } from '@/lib/groupStyle';
import type { GroupColor } from '@/types/api';

const SIZES = {
  sm: 'w-9 h-9 rounded-[10px]',
  md: 'w-11 h-11 rounded-xl',
  lg: 'w-14 h-14 rounded-2xl',
  // Grup sayfası başlığı: kullanıcı profil fotoğrafıyla aynı boyut (telefonda 108px, geniş ekranda 124px).
  profile: 'w-[108px] h-[108px] rounded-[28px] sm:w-[124px] sm:h-[124px] sm:rounded-[32px]',
};

// Uzun kodlar (CENG, İE332) biraz küçük yazılır.
const FONT: Record<keyof typeof SIZES, [string, string, string]> = {
  sm: ['text-[13px]', 'text-[11px]', 'text-[10px]'],
  md: ['text-[15px]', 'text-[12px]', 'text-[11px]'],
  lg: ['text-lg', 'text-[15px]', 'text-[13px]'],
  profile: ['text-3xl sm:text-4xl', 'text-2xl sm:text-3xl', 'text-xl sm:text-2xl'],
};

// Grubun renkli ikonu, içinde kısa kodu (CENG, MAT, İE332...). Grup fotoğrafı yüklenmişse fotoğraf gösterilir.
export default function GroupIcon({
  name,
  color,
  courseCode,
  avatarUrl,
  size = 'md',
}: {
  name: string;
  color?: GroupColor;
  courseCode?: string;
  avatarUrl?: string;
  size?: keyof typeof SIZES;
}) {
  if (avatarUrl) {
    return (
      <img
        src={assetUrl(avatarUrl)}
        alt=""
        className={`${SIZES[size]} shrink-0 max-w-none object-cover bg-gray-100`}
        aria-hidden="true"
      />
    );
  }
  const code = groupCode(name, courseCode);
  const [short, mid, long] = FONT[size];
  const font = code.length > 4 ? long : code.length > 3 ? mid : short;
  return (
    <span
      className={`${SIZES[size]} ${font} shrink-0 flex items-center justify-center font-extrabold tracking-wide text-white`}
      style={{ backgroundColor: groupColor(color) }}
      aria-hidden="true"
    >
      {code}
    </span>
  );
}
