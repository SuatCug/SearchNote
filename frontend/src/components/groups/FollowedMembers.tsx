import UserAvatar from '@/components/users/UserAvatar';
import type { UserCard } from '@/types/api';

// "Ayşe, Mert and 3 more you follow are members" satırı: üst üste binen küçük avatarlar + metin.
// onClick verilirse satır tıklanabilir (grup sayfasında tüm listeyi açar).
export default function FollowedMembers({
  users = [],
  count = 0,
  onClick,
  className = '',
}: {
  users?: UserCard[];
  count?: number;
  onClick?: () => void;
  className?: string;
}) {
  if (!count || !users.length) return null;

  const names = users.slice(0, 2).map((u) => u.fullName.split(' ')[0]);
  const rest = count - names.length;
  const text =
    rest > 0
      ? `${names.join(', ')} and ${rest} more you follow ${count === 1 ? 'is a member' : 'are members'}`
      : `${names.join(' and ')} ${count === 1 ? 'is a member' : 'are members'}`;

  const content = (
    <>
      <span className="flex -space-x-1.5 shrink-0">
        {users.slice(0, 3).map((u) => (
          <UserAvatar key={u._id} user={u} size="xs" className="ring-2 ring-white" />
        ))}
      </span>
      <span className="min-w-0 truncate">{text}</span>
    </>
  );

  const base = `flex items-center gap-2 text-xs text-gray-600 ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${base} relative z-[1] text-left hover:text-navy-700`}>
      {content}
    </button>
  ) : (
    <p className={base}>{content}</p>
  );
}
