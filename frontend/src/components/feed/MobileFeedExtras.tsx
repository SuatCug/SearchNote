import { Link } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { Bookmark, Compass, FileText, Users } from 'lucide-react';
import UserAvatar from '@/components/users/UserAvatar';
import FollowButton from '@/components/users/FollowButton';
import { useGetActiveUsersQuery, useGetSuggestionsQuery } from '@/services/usersApi';
import { suggestionReason } from '@/lib/suggestionReason';
import { useGetTrendingCoursesQuery } from '@/services/notesApi';
import { courseLink } from '@/lib/links';
import { useFallbackPolling } from '@/lib/socket';

// Dar ekranlarda yan paneller gizli olduğu için onların içeriği akışın içine taşınır:
// kısayollar ve "aktif olanlar" üstte, takip önerileri birkaç gönderiden sonra yatay kaydırmalı kartlar olarak.

const ACTIVE_POLL_INTERVAL_MS = 60000;

// Sol menüdeki kısayollar (lg altında).
export function MobileShortcuts() {
  const userId = useAppSelector((state) => state.auth.user?.id);
  const items = [
    { to: '/?all=1', icon: Compass, label: 'Explore' },
    { to: '/?tab=saved', icon: Bookmark, label: 'Saved' },
    // Profildeki Notes sekmesi; profil açılınca notların olduğu bölüme kaydırılır.
    { to: `/users/${userId}?tab=notes`, state: { scrollTo: 'notes' }, icon: FileText, label: 'My notes' },
    { to: '/groups?tab=mine', icon: Users, label: 'My groups' },
  ];

  return (
    <nav aria-label="Shortcuts" className="lg:hidden mt-3 grid grid-cols-4 gap-2">
      {items.map(({ to, state, icon: Icon, label }) => (
        <Link
          key={label}
          to={to}
          state={state}
          className="card flex flex-col items-center gap-1.5 px-1 py-3 text-xs font-semibold text-gray-700 hover:border-navy-200 active:bg-navy-50 transition-colors"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-50 text-navy-600">
            <Icon size={18} />
          </span>
          {label}
        </Link>
      ))}
    </nav>
  );
}

// Hikâye (story) şeridi gibi: şu an aktif olan kişiler. Kimse yoksa hiç gösterilmez.
export function ActiveNowStrip() {
  const { data } = useGetActiveUsersQuery(undefined, {
    pollingInterval: useFallbackPolling(ACTIVE_POLL_INTERVAL_MS),
    skipPollingIfUnfocused: true,
  });
  const users = data?.data?.users ?? [];
  if (!users.length) return null;

  return (
    <section aria-label="Active now" className="xl:hidden mt-4">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Active now</h2>
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none]">
        {users.map((u) => (
          <Link key={u._id} to={`/users/${u._id}`} className="flex w-16 shrink-0 flex-col items-center gap-1">
            <span className="relative rounded-full p-0.5 ring-2 ring-emerald-400">
              <UserAvatar user={u} size="lg" className="!w-14 !h-14" />
              <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </span>
            <span className="w-full truncate text-center text-[11px] font-medium text-gray-700">
              {u.fullName.split(' ')[0]}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// Popüler dersler: yatay kaydırmalı etiketler.
export function CourseChips() {
  const { data } = useGetTrendingCoursesQuery();
  const courses = data?.data?.courses ?? [];
  if (!courses.length) return null;

  return (
    <div className="xl:hidden mt-4 -mx-4 px-4 sm:mx-0 sm:px-0 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
      {courses.map((c) => (
        <Link
          key={c.courseCode || c.courseName}
          to={courseLink(c)}
          className="shrink-0 rounded-full border border-navy-100 bg-white px-3 py-1.5 text-xs font-semibold text-navy-600 hover:bg-navy-50"
        >
          #{c.courseCode || c.courseName}
        </Link>
      ))}
    </div>
  );
}

// Akışın arasına yerleşen "Who to follow" kartları.
export function SuggestionsCarousel() {
  const { data } = useGetSuggestionsQuery();
  const users = data?.data?.users ?? [];
  if (!users.length) return null;

  return (
    <section aria-labelledby="suggestions-title" className="xl:hidden card py-4">
      <h2 id="suggestions-title" className="px-4 text-sm font-bold text-gray-900">
        Who to follow
      </h2>
      <div className="mt-3 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {users.map((u) => (
          <div key={u._id} className="flex w-36 shrink-0 flex-col items-center rounded-xl border border-gray-100 bg-gray-50/60 p-3 text-center">
            <Link to={`/users/${u._id}`} className="flex min-w-0 flex-col items-center">
              <UserAvatar user={u} size="lg" />
              <span className="mt-2 w-full truncate text-sm font-semibold text-gray-900">{u.fullName}</span>
              <span className="w-full truncate text-xs text-gray-500">{suggestionReason(u)}</span>
            </Link>
            <div className="mt-2.5">
              <FollowButton userId={u._id} isFollowing={false} compact />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
