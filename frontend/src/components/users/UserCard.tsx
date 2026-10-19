import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import UserAvatar from './UserAvatar';
import type { UserCard as UserCardData } from '@/types/api';

// Ortalanmış kullanıcı kartı: kare avatar, ad, üniversite, bölüm.
// action: kartın altında bağlantı dışında kalan buton (örn. takipçi listesinde Follow / Remove).
export default function UserCard({ user, action }: { user: UserCardData; action?: ReactNode }) {
  const body = (
    <>
      <UserAvatar user={user} size="card" square />
      <span className="mt-3 w-full text-[15px] font-semibold text-gray-900 group-hover:text-navy-600 truncate">
        {user.fullName}
      </span>
      <span className="mt-0.5 w-full text-xs leading-snug text-gray-600 line-clamp-1">{user.university}</span>
      <span className="w-full text-xs leading-snug text-gray-600 line-clamp-1">{user.department}</span>
    </>
  );

  if (!action) {
    return (
      <Link
        to={`/users/${user._id}`}
        className="card h-full flex flex-col items-center text-center px-4 pt-5 pb-4 hover:border-navy-100 hover:shadow-md transition-all group"
      >
        {body}
      </Link>
    );
  }

  return (
    <div className="card h-full flex flex-col items-center text-center px-4 pt-5 pb-4 hover:border-navy-100 hover:shadow-md transition-all">
      <Link to={`/users/${user._id}`} className="w-full flex flex-col items-center group">
        {body}
      </Link>
      <div className="mt-3 w-full flex justify-center">{action}</div>
    </div>
  );
}
