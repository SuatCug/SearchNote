import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import Modal from '@/components/common/Modal';
import Spinner from '@/components/common/Spinner';
import UserAvatar from './UserAvatar';
import FollowButton from './FollowButton';
import type { UserCard } from '@/types/api';

// Kişi listesi penceresi (grupta takip ettiğim üyeler, şu an aktif olanlar...). Satırdaki kişiye tıklayınca profiline gider.
// showFollow: satırda Follow / Following butonu (kişinin isFollowing bilgisi gelmişse).
export default function PeopleModal({
  title,
  users,
  isLoading,
  emptyText = 'No one here yet.',
  showFollow = false,
  onClose,
}: {
  title: ReactNode;
  users?: UserCard[];
  isLoading?: boolean;
  emptyText?: string;
  showFollow?: boolean;
  onClose: () => void;
}) {
  const myId = useAppSelector((state) => state.auth.user?.id);
  return (
    <Modal title={title} onClose={onClose}>
      <div className="px-2 py-2">
        {isLoading ? (
          <Spinner />
        ) : !users?.length ? (
          <p className="px-3 py-8 text-center text-sm text-gray-500">{emptyText}</p>
        ) : (
          <ul>
            {users.map((u) => (
              <li key={u._id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-50">
                <Link to={`/users/${u._id}`} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatar user={u} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-900">{u.fullName}</span>
                    <span className="block truncate text-xs text-gray-500">
                      {[u.university, u.department].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </Link>
                {showFollow && u.isFollowing !== undefined && u._id !== myId && (
                  <FollowButton userId={u._id} isFollowing={u.isFollowing} name={u.fullName} compact />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
