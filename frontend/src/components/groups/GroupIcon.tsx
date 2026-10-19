import { groupCode, groupColor } from '@/lib/groupStyle';
import type { GroupColor } from '@/types/api';

const SIZES = {
  sm: 'w-9 h-9 rounded-[10px]',
  md: 'w-11 h-11 rounded-xl',
  lg: 'w-14 h-14 rounded-2xl',
  xl: 'w-20 h-20 rounded-[22px]',
};

// Uzun kodlar (CENG, İE332) biraz küçük yazılır.
const FONT: Record<keyof typeof SIZES, [string, string, string]> = {
  sm: ['text-[13px]', 'text-[11px]', 'text-[10px]'],
  md: ['text-[15px]', 'text-[12px]', 'text-[11px]'],
  lg: ['text-lg', 'text-[15px]', 'text-[13px]'],
  xl: ['text-2xl', 'text-xl', 'text-lg'],
};

// Grubun renkli ikonu, içinde kısa kodu (CENG, MAT, İE332...).
export default function GroupIcon({
  name,
  color,
  courseCode,
  size = 'md',
}: {
  name: string;
  color?: GroupColor;
  courseCode?: string;
  size?: keyof typeof SIZES;
}) {
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
