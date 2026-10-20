import { assetUrl } from '@/lib/assetUrl';

const SIZES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  chat: 'w-[52px] h-[52px] text-base',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
  card: 'w-[88px] h-[88px] text-2xl',
  // Profil başlığı: telefonda 108px, geniş ekranda 124px (mobil uygulamayla aynı).
  profile: 'w-[108px] h-[108px] text-3xl sm:w-[124px] sm:h-[124px] sm:text-4xl',
};

interface UserAvatarProps {
  // Oturum kullanıcısı, profil ya da liste kartı olabilir: sadece ad ve avatar okunur.
  user?: { fullName?: string; avatarUrl?: string } | null;
  size?: keyof typeof SIZES;
  square?: boolean;
  className?: string;
}

// Avatar yüklenmemişse ad soyadın baş harflerini gösterir. square: yuvarlak yerine köşeleri yumuşatılmış kare.
export default function UserAvatar({ user, size = 'md', square = false, className = '' }: UserAvatarProps) {
  const shape = square ? 'rounded-xl' : 'rounded-full';
  const initials =
    user?.fullName
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toLocaleUpperCase('tr'))
      .join('') || '?';

  if (user?.avatarUrl) {
    return (
      <img
        src={assetUrl(user.avatarUrl)}
        alt={user.fullName}
        // Google profil fotoğrafı (lh3.googleusercontent.com) başka sitenin Referer'ıyla istenince resim yerine
        // hata döner ve tarayıcı engeller (ERR_BLOCKED_BY_ORB); Referer gönderilmeyince yüklenir.
        referrerPolicy="no-referrer"
        className={`${SIZES[size]} ${shape} max-w-none object-cover shrink-0 bg-gray-100 ${className}`}
      />
    );
  }

  return (
    <span
      className={`${SIZES[size]} ${shape} bg-navy-100 text-navy-700 font-semibold flex items-center justify-center shrink-0 ${className}`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
