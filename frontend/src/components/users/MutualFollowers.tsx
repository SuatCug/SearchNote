import { Link } from 'react-router-dom';
import UserAvatar from './UserAvatar';
import { useGetMutualFollowersQuery } from '@/services/usersApi';

// Başka birinin profilinde "Followed by Suat and Elif" / "Followed by Suat, Elif and 3 others" satırı
// (mobildeki gibi ilk isimler). Tıklanınca ortak takipçilerin tam listesi (bağlantılar sayfasının "Mutual" sekmesi) açılır.
export default function MutualFollowers({ userId }: { userId: string }) {
  const { data } = useGetMutualFollowersQuery(userId);
  const users = data?.data?.users ?? [];
  const total = data?.data?.total ?? 0;
  if (!total || !users.length) return null;

  const names = users.slice(0, 2).map((u) => u.fullName.split(' ')[0]);
  const rest = total - names.length;

  return (
    <Link
      to={`/users/${userId}/mutual`}
      state={{ fromProfile: true }}
      className="inline-flex max-w-full items-center gap-2.5 text-sm text-gray-500 hover:text-navy-700"
    >
      <span className="flex -space-x-2 shrink-0">
        {users.slice(0, 3).map((u) => (
          <UserAvatar key={u._id} user={u} size="sm" className="ring-2 ring-white" />
        ))}
      </span>
      <span className="min-w-0 truncate">
        Followed by{' '}
        {rest > 0 ? (
          <>
            <b className="font-semibold text-gray-800">{names.join(', ')}</b> and{' '}
            <b className="font-semibold text-gray-800">
              {rest} {rest === 1 ? 'other' : 'others'}
            </b>
          </>
        ) : (
          names.map((n, i) => (
            <span key={n}>
              {i > 0 && ' and '}
              <b className="font-semibold text-gray-800">{n}</b>
            </span>
          ))
        )}
      </span>
    </Link>
  );
}
