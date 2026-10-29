import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useAppSelector } from '@/app/hooks';
import Spinner from '@/components/common/Spinner';
import { useDialog } from '@/components/common/DialogProvider';
import UserAvatar from './UserAvatar';
import FollowButton from './FollowButton';
import {
  useGetConnectionPageQuery,
  useRemoveFollowerMutation,
  useToggleFollowMutation,
  type ConnectionType,
} from '@/services/usersApi';
import { useDebounce } from '@/hooks/useDebounce';
import { getErrorMessage } from '@/lib/getErrorMessage';
import type { UserCard } from '@/types/api';

const PAGE_SIZE = 20;

const TITLES: Record<ConnectionType, string> = {
  followers: 'Followers',
  following: 'Following',
  mutual: 'Followers you know',
};

// Instagram'daki takipçi / takip edilen penceresi: ortada beyaz kart (telefonda tam ekran), ortalanmış başlık + X,
// gri arama kutusu ve aşağı kaydırdıkça yüklenen kişi satırları. Kendi takipçilerimde "Remove", diğer listelerde
// Follow / Following. Kendi takipçi listemde geri takip etmediğim kişinin adının yanında "· Follow" bağlantısı olur.
export default function ConnectionsModal({
  userId,
  type,
  isMe,
  onClose,
}: {
  userId: string;
  type: ConnectionType;
  isMe: boolean;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const term = useDebounce(search.trim(), 300);
  const [pages, setPages] = useState(1);
  // Arama değişince yeniden ilk sayfadan başla.
  const [prevTerm, setPrevTerm] = useState(term);
  if (term !== prevTerm) {
    setPrevTerm(term);
    setPages(1);
  }

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-4" role="presentation">
      <div className="dialog-backdrop absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connections-title"
        className="dialog-in relative flex h-full w-full flex-col bg-white pt-safe sm:pt-0 sm:h-[min(440px,85vh)] sm:max-w-[400px] sm:rounded-xl sm:shadow-2xl"
      >
        <header className="relative flex h-[43px] shrink-0 items-center justify-center border-b border-gray-200">
          <h2 id="connections-title" className="text-base font-bold text-gray-900">
            {TITLES[type]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-gray-900 hover:bg-gray-100"
          >
            <X size={22} />
          </button>
        </header>

        <div className="shrink-0 px-4 py-2">
          <label className="relative block">
            <span className="sr-only">Search</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="h-9 w-full rounded-lg border-0 bg-gray-100 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-safe">
          {Array.from({ length: pages }, (_, i) => (
            <ConnectionPage
              key={`${term}-${i}`}
              userId={userId}
              type={type}
              isMe={isMe}
              page={i + 1}
              term={term}
              last={i === pages - 1}
              onMore={() => setPages((p) => p + 1)}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Tek bir sayfanın satırları; son sayfada devamı varsa liste sonuna gelince bir sonrakini ister.
function ConnectionPage({
  userId,
  type,
  isMe,
  page,
  term,
  last,
  onMore,
}: {
  userId: string;
  type: ConnectionType;
  isMe: boolean;
  page: number;
  term: string;
  last: boolean;
  onMore: () => void;
}) {
  const token = useAppSelector((state) => state.auth.token);
  const myId = useAppSelector((state) => state.auth.user?.id);
  const { data, isLoading } = useGetConnectionPageQuery(
    { id: userId, type, page, limit: PAGE_SIZE, q: term || undefined },
    { skip: type === 'mutual' && !token }
  );
  const users = data?.data?.users ?? [];
  const pagination = data?.data?.pagination;
  const hasMore = last && !!pagination && pagination.page < pagination.totalPages;

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore || !sentinel.current) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && onMore(), { rootMargin: '120px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasMore, onMore]);

  if (isLoading) return <Spinner />;
  if (page === 1 && !users.length) {
    return <p className="px-6 py-10 text-center text-sm text-gray-500">{term ? 'No results found.' : emptyText(type, isMe)}</p>;
  }

  const ownFollowers = isMe && type === 'followers';
  return (
    <>
      <ul>
        {users.map((u) => (
          <li key={u._id} className="flex items-center gap-3 px-4 py-2">
            <Link to={`/users/${u._id}`} className="shrink-0">
              <UserAvatar user={u} className="!h-11 !w-11" />
            </Link>
            <div className="min-w-0 flex-1 text-sm">
              <p className="flex min-w-0 items-center gap-1">
                <Link to={`/users/${u._id}`} className="truncate font-semibold text-gray-900 hover:opacity-70">
                  {u.fullName}
                </Link>
                {ownFollowers && u.isFollowing === false && <FollowBackLink user={u} />}
              </p>
              {(u.university || u.department) && (
                <p className="truncate text-gray-500">{[u.university, u.department].filter(Boolean).join(' · ')}</p>
              )}
            </div>
            {ownFollowers ? (
              <RemoveButton user={u} />
            ) : (
              token &&
              u._id !== myId &&
              u.isFollowing !== undefined && <FollowButton userId={u._id} isFollowing={u.isFollowing} name={u.fullName} variant="list" />
            )}
          </li>
        ))}
      </ul>
      {hasMore && <div ref={sentinel} className="h-8" aria-hidden="true" />}
    </>
  );
}

function emptyText(type: ConnectionType, isMe: boolean) {
  if (type === 'followers') return isMe ? "You don't have any followers yet." : 'No followers yet.';
  if (type === 'following') return isMe ? "You aren't following anyone yet." : 'Not following anyone yet.';
  return 'None of their followers are people you follow.';
}

// Kendi takipçi listemde, geri takip etmediğim kişinin adının yanındaki "· Follow".
function FollowBackLink({ user }: { user: UserCard }) {
  const dialog = useDialog();
  const [toggleFollow] = useToggleFollowMutation();
  // Takip edince bağlantı sunucuyu beklemeden kaybolur; hata olursa geri gelir.
  const [followed, setFollowed] = useState(false);
  if (followed) return null;
  return (
    <>
      <span className="text-gray-900" aria-hidden="true">
        ·
      </span>
      <button
        type="button"
        onClick={async () => {
          setFollowed(true);
          try {
            await toggleFollow({ id: user._id, following: false }).unwrap();
          } catch (err) {
            setFollowed(false);
            dialog.alert({ message: getErrorMessage(err) });
          }
        }}
        className="shrink-0 font-semibold text-navy-600 hover:text-navy-800"
      >
        Follow
      </button>
    </>
  );
}

// Instagram'daki "Remove": kişi takipçilerimden çıkar, ona bildirim gitmez.
// Onaydan sonra buton sunucuyu beklemeden "Removed" olur; hata olursa geri döner.
function RemoveButton({ user }: { user: UserCard }) {
  const [removeFollower] = useRemoveFollowerMutation();
  const [removed, setRemoved] = useState(false);
  const dialog = useDialog();

  const handleClick = async () => {
    const ok = await dialog.confirm({
      title: 'Remove follower?',
      message: `We won't tell ${user.fullName.split(' ')[0]} they were removed from your followers.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    setRemoved(true);
    try {
      await removeFollower(user._id).unwrap();
    } catch (err) {
      setRemoved(false);
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  if (removed) {
    return (
      <span className="inline-flex h-8 shrink-0 items-center rounded-lg px-4 text-sm font-semibold text-gray-400">Removed</span>
    );
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex h-8 shrink-0 items-center rounded-lg bg-gray-100 px-4 text-sm font-semibold text-gray-900 hover:bg-gray-200"
    >
      Remove
    </button>
  );
}
