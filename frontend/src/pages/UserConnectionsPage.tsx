import { useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { Search, UserMinus, Users } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Spinner from '@/components/common/Spinner';
import EmptyState from '@/components/common/EmptyState';
import Pagination from '@/components/common/Pagination';
import ProfileSidebar from '@/components/users/ProfileSidebar';
import UserCard from '@/components/users/UserCard';
import FollowButton from '@/components/users/FollowButton';
import { useDialog } from '@/components/common/DialogProvider';
import {
  useGetConnectionPageQuery,
  useGetProfileQuery,
  useRemoveFollowerMutation,
  type ConnectionType,
} from '@/services/usersApi';
import { useDebounce } from '@/hooks/useDebounce';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { formatCount, pluralize } from '@/lib/format';
import type { UserCard as UserCardData } from '@/types/api';

const PAGE_SIZE = 24;

// Bir kullanıcının takipçileri / takip ettikleri / ortak takipçiler (izleyicinin de takip ettiği takipçiler):
// solda kullanıcı paneli, sağda sunucu tarafında arama + sayfalı kullanıcı kartları.
// Kendi takipçi listemde her kişide "Remove" (takipçilerimden çıkar) vardır.
export default function UserConnectionsPage({ type }: { type: ConnectionType }) {
  const { id = '' } = useParams();
  const token = useAppSelector((state) => state.auth.token);
  const myId = useAppSelector((state) => state.auth.user?.id);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebounce(search.trim(), 300);
  // Arama değişince ilk sayfaya dön.
  const [prevTerm, setPrevTerm] = useState(term);
  if (term !== prevTerm) {
    setPrevTerm(term);
    setPage(1);
  }

  const profile = useGetProfileQuery(id);
  const isMe = profile.data?.data?.isMe ?? false;
  const list = useGetConnectionPageQuery(
    { id, type, page, limit: PAGE_SIZE, q: term || undefined },
    // Ortak takipçiler giriş gerektirir ve kendi profilimde anlamsızdır.
    { skip: type === 'mutual' && (!token || isMe || !profile.data) },
  );

  if (profile.isLoading) return <PageLayout><Spinner /></PageLayout>;
  if (profile.error || !profile.data) {
    return (
      <PageLayout narrow>
        <EmptyState title="User not found" action={<Link to="/" className="btn-primary">Back to home</Link>} />
      </PageLayout>
    );
  }

  const { user } = profile.data.data;
  const firstName = user.fullName.split(' ')[0];
  const users = list.data?.data?.users;
  const total = list.data?.data?.pagination?.total ?? 0;

  const tabs = [
    { to: `/users/${id}/followers`, label: 'Followers', count: user.followersCount },
    { to: `/users/${id}/following`, label: 'Following', count: user.followingCount },
    ...(token && !isMe ? [{ to: `/users/${id}/mutual`, label: 'Mutual', count: undefined }] : []),
  ];

  const summary = !users
    ? ' '
    : term
      ? `${pluralize(total, 'result')} for "${term}"`
      : type === 'followers'
        ? pluralize(total, 'follower')
        : type === 'following'
          ? `Following ${formatCount(total)} ${total === 1 ? 'person' : 'people'}`
          : `${pluralize(total, 'follower')} you also follow`;

  const emptyTitle = term
    ? 'No matching people'
    : type === 'followers'
      ? isMe
        ? "You don't have any followers yet"
        : 'No followers yet'
      : type === 'following'
        ? isMe
          ? "You aren't following anyone yet"
          : 'Not following anyone yet'
        : `None of ${firstName}'s followers are people you follow`;

  return (
    <PageLayout>
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] items-start">
        <ProfileSidebar profile={profile.data.data} />

        <section className="min-w-0" aria-labelledby="connections-title">
          <h2 id="connections-title" className="text-2xl font-bold text-gray-900">
            {isMe ? 'My Network' : `${firstName}'s Network`}
          </h2>
          <p className="mt-1 text-sm text-gray-500">{summary}</p>

          <div className="mt-4 border-b border-gray-200 flex gap-6" role="tablist">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                role="tab"
                className={({ isActive }) =>
                  `pb-3 -mb-px border-b-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                    isActive ? 'border-navy-600 text-navy-700' : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`
                }
              >
                {t.label} {t.count !== undefined && <span className="font-normal text-gray-400">{t.count}</span>}
              </NavLink>
            ))}
          </div>

          <div className="card p-3 mt-5">
            <label className="relative block">
              <span className="sr-only">Search people</span>
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, university or department..."
                className="form-input pl-10"
              />
            </label>
          </div>

          <div className={`mt-5 ${list.isFetching && !list.isLoading ? 'opacity-60 transition-opacity' : ''}`}>
            {list.isLoading ? (
              <Spinner />
            ) : !users?.length ? (
              <EmptyState icon={Users} title={emptyTitle} text={term ? 'Try a different name, university or department.' : undefined} />
            ) : (
              <ul className="grid gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
                {users.map((u) => (
                  <li key={u._id}>
                    <UserCard
                      user={u}
                      action={
                        isMe && type === 'followers' ? (
                          <RemoveFollowerButton user={u} />
                        ) : (
                          token &&
                          u._id !== myId &&
                          u.isFollowing !== undefined && (
                            <FollowButton userId={u._id} isFollowing={u.isFollowing} name={u.fullName} compact />
                          )
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
            <Pagination
              pagination={list.data?.data?.pagination}
              onPageChange={(p) => {
                setPage(p);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </div>
        </section>
      </div>
    </PageLayout>
  );
}

// Instagram'daki "Remove": kişi takipçilerimden çıkar, ona bildirim gitmez.
function RemoveFollowerButton({ user }: { user: UserCardData }) {
  const [removeFollower, { isLoading }] = useRemoveFollowerMutation();
  const dialog = useDialog();

  const handleClick = async () => {
    const ok = await dialog.confirm({
      title: `Remove ${user.fullName}?`,
      message: "They won't be told they were removed from your followers.",
      confirmLabel: 'Remove',
      tone: 'danger',
      icon: UserMinus,
    });
    if (!ok) return;
    try {
      await removeFollower(user._id).unwrap();
    } catch (err) {
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  return (
    <button type="button" onClick={handleClick} disabled={isLoading} className="btn-secondary px-2.5 py-1.5 text-xs gap-1">
      <UserMinus size={14} /> Remove
    </button>
  );
}
