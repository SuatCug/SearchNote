import { Link } from 'react-router-dom';
import UserAvatar from './UserAvatar';
import { useGetMutualFollowersQuery } from '@/services/usersApi';

// Başka birinin profilinde "Followed by Ayşe, Mert and 4 others you follow" satırı.
// Tıklanınca ortak takipçilerin tam listesi (bağlantılar sayfasının "Mutual" sekmesi) açılır.
export default function MutualFollowers({ userId }: { userId: string }) {
  const { data } = useGetMutualFollowersQuery(userId);
  const users = data?.data?.users ?? [];
  const total = data?.data?.total ?? 0;
  if (!total || !users.length) return null;

  const names = users.slice(0, 2).map((u) => u.fullName);
  const rest = total - names.length;

  return (
    <Link
      to={`/users/${userId}/mutual`}
      className="mt-3 inline-flex max-w-full items-center gap-2 text-sm text-gray-600 hover:text-navy-700"
    >
      <span className="flex -space-x-1.5 shrink-0">
        {users.slice(0, 3).map((u) => (
          <UserAvatar key={u._id} user={u} size="xs" className="ring-2 ring-white" />
        ))}
      </span>
      <span className="min-w-0 truncate">
        Followed by <span className="font-semibold text-gray-800">{names.join(', ')}</span>
        {rest > 0 && (
          <>
            {' '}
            and <span className="font-semibold text-gray-800">{rest} {rest === 1 ? 'other' : 'others'}</span>
          </>
        )}{' '}
        you follow
      </span>
    </Link>
  );
}
