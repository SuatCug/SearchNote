import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { Bookmark, FileText, UserPlus, Users } from 'lucide-react';
import UserAvatar from '@/components/users/UserAvatar';
import PeopleModal from '@/components/users/PeopleModal';
import FollowButton from '@/components/users/FollowButton';
import { useGetActiveUsersQuery, useGetSuggestionsQuery } from '@/services/usersApi';
import { useGetTrendingCoursesQuery } from '@/services/notesApi';
import { courseLink } from '@/lib/links';
import { useFallbackPolling } from '@/lib/socket';

const ACTIVE_POLL_INTERVAL_MS = 60000;

// Akışın sağ paneli: kısayollar, popüler dersler, şu an aktif olanlar ve takip önerileri.
export default function FeedRightRail() {
  return (
    <div className="space-y-4">
      <ForYouCard />
      <PopularCoursesCard />
      <ActiveNowCard />
      <WhoToFollowCard />
    </div>
  );
}

function RailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ForYouCard() {
  const userId = useAppSelector((state) => state.auth.user?.id);
  const links = [
    { to: '/?tab=following', icon: UserPlus, label: 'People you follow' },
    { to: '/?tab=saved', icon: Bookmark, label: 'Saved notes' },
    { to: `/users/${userId}/notes`, icon: FileText, label: 'My notes' },
    { to: '/groups?tab=mine', icon: Users, label: 'My groups' },
  ];

  return (
    <RailCard title="For You">
      <ul className="-mx-2 space-y-0.5">
        {links.map(({ to, icon: Icon, label }) => (
          <li key={label}>
            <Link
              to={to}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-navy-700"
            >
              <Icon size={16} className="text-gray-400" /> {label}
            </Link>
          </li>
        ))}
      </ul>
    </RailCard>
  );
}

function PopularCoursesCard() {
  const { data, isLoading } = useGetTrendingCoursesQuery();
  const courses = data?.data?.courses ?? [];
  if (!isLoading && !courses.length) return null;

  return (
    <RailCard title="Popular Courses">
      <div className="flex flex-wrap gap-1.5">
        {isLoading
          ? Array.from({ length: 6 }, (_, i) => <span key={i} className="skeleton-box h-6 w-16 rounded-md" />)
          : courses.map((c) => (
              <Link
                key={c.courseCode || c.courseName}
                to={courseLink(c)}
                title={`${c.courseName} · ${c.notesCount} notes`}
                className="rounded-md bg-navy-50 px-2 py-1 text-xs font-medium text-navy-600 hover:bg-navy-100"
              >
                #{c.courseCode || c.courseName}
              </Link>
            ))}
      </div>
    </RailCard>
  );
}

function ActiveNowCard() {
  const { data, isLoading } = useGetActiveUsersQuery(undefined, {
    pollingInterval: useFallbackPolling(ACTIVE_POLL_INTERVAL_MS),
    skipPollingIfUnfocused: true,
  });
  const users = data?.data?.users ?? [];
  const extra = (data?.data?.total ?? 0) - users.length;
  const [allOpen, setAllOpen] = useState(false);
  // "See all" penceresi açıkken hepsi (en fazla 100) istenir.
  const all = useGetActiveUsersQuery({ limit: 100 }, { skip: !allOpen });

  return (
    <RailCard title="Active Now">
      {isLoading ? (
        <div className="flex gap-1.5">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="skeleton-box h-9 w-9 rounded-full" />
          ))}
        </div>
      ) : users.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {users.map((u) => (
            <Link key={u._id} to={`/users/${u._id}`} title={u.fullName} className="relative">
              <UserAvatar user={u} size="md" className="ring-2 ring-white" />
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
            </Link>
          ))}
          {extra > 0 && (
            <button
              type="button"
              onClick={() => setAllOpen(true)}
              className="ml-1 text-xs font-semibold text-navy-600 hover:text-navy-700"
            >
              +{extra} · See all
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500">None of your mutual follows are online right now.</p>
      )}
      {allOpen && (
        <PeopleModal
          title={`Active now · ${data?.data?.total ?? 0}`}
          users={all.data?.data?.users}
          isLoading={all.isLoading}
          emptyText="None of your mutual follows are online right now."
          onClose={() => setAllOpen(false)}
        />
      )}
    </RailCard>
  );
}

function WhoToFollowCard() {
  const { data } = useGetSuggestionsQuery();
  const users = data?.data?.users ?? [];
  if (!users.length) return null;

  return (
    <RailCard title="Who to Follow">
      <ul className="space-y-3">
        {users.map((u) => (
          <li key={u._id} className="flex items-center gap-2.5">
            <Link to={`/users/${u._id}`} className="flex min-w-0 flex-1 items-center gap-2.5 group">
              <UserAvatar user={u} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-gray-900 group-hover:text-navy-700">
                  {u.fullName}
                </span>
                <span className="block truncate text-xs text-gray-500">{u.university}</span>
              </span>
            </Link>
            <FollowButton userId={u._id} isFollowing={false} compact />
          </li>
        ))}
      </ul>
    </RailCard>
  );
}
