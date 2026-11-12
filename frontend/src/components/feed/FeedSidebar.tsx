import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { Bookmark, Compass, FileSearch, Home, ListChecks, MessageCircle, Network, Sparkles, UserRound, Users } from 'lucide-react';
import UserAvatar from '@/components/users/UserAvatar';
import { useGetUnreadCountQuery } from '@/services/messagesApi';
import { UNREAD_POLL_INTERVAL_MS } from '@/lib/constants';
import { useFallbackPolling } from '@/lib/socket';

const itemClass = (active: boolean) =>
  `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${
    active ? 'bg-navy-50 text-navy-700 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  }`;

// Ana sayfa akışının sol menüsü (sadece geniş ekranlarda; telefonda alt sekme çubuğu kullanılır).
export default function FeedSidebar() {
  const user = useAppSelector((state) => state.auth.user);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { data } = useGetUnreadCountQuery(undefined, {
    pollingInterval: useFallbackPolling(UNREAD_POLL_INTERVAL_MS),
    skipPollingIfUnfocused: true,
  });
  const unread = data?.data?.count ?? 0;

  // Ana sayfa sekmeleri query string ile ayrıldığı için aktiflik elle hesaplanır.
  const onHome = location.pathname === '/';
  const isExplore = onHome && [...searchParams.keys()].some((k) => k !== 'tab');
  const tab = searchParams.get('tab');
  const isSaved = onHome && !isExplore && tab === 'saved';
  const isHome = onHome && !isExplore && !isSaved;

  return (
    <nav aria-label="Main" className="space-y-1">
      <Link to={`/users/${user?.id}`} className="mb-3 flex items-center gap-3 rounded-2xl p-2 hover:bg-gray-100 transition-colors">
        <UserAvatar user={user} size="md" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-gray-900">{user?.fullName}</span>
          <span className="block truncate text-xs text-gray-500">{user?.department}</span>
        </span>
      </Link>

      <Link to="/" className={itemClass(isHome)}>
        <Home size={20} /> Home
      </Link>
      <Link to="/?all=1" className={itemClass(isExplore)}>
        <Compass size={20} /> Explore
      </Link>
      <NavLink to="/messages" className={({ isActive }) => itemClass(isActive)}>
        <MessageCircle size={20} /> Messages
        {unread > 0 && (
          <span className="ml-auto min-w-[20px] rounded-full bg-rose-500 px-1.5 text-center text-[11px] font-bold leading-5 text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </NavLink>
      <NavLink to="/groups" className={({ isActive }) => itemClass(isActive)}>
        <Users size={20} /> Groups
      </NavLink>
      <Link to="/?tab=saved" className={itemClass(isSaved)}>
        <Bookmark size={20} /> Saved
      </Link>
      <NavLink to={`/users/${user?.id}`} end className={({ isActive }) => itemClass(isActive)}>
        <UserRound size={20} /> Profile
      </NavLink>

      {/* AI ile çalışan özellikler tek başlık altında */}
      <div role="group" aria-labelledby="sidebar-ai-title" className="mt-4 space-y-1 border-t border-gray-100 pt-4">
        <p id="sidebar-ai-title" className="flex items-center gap-1.5 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          <Sparkles size={14} /> Learn with AI
        </p>
        <NavLink to="/ask" className={({ isActive }) => itemClass(isActive)}>
          <FileSearch size={20} /> Search inside notes
        </NavLink>
        <NavLink to="/practice" className={({ isActive }) => itemClass(isActive)}>
          <ListChecks size={20} /> Quizzes & flashcards
        </NavLink>
        <NavLink to="/knowledge" className={({ isActive }) => itemClass(isActive)}>
          <Network size={20} /> Knowledge map
        </NavLink>
      </div>
    </nav>
  );
}
