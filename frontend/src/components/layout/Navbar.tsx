import { useState, type ChangeEventHandler, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { MessageCircle, Search, Upload } from 'lucide-react';
import Logo from './Logo';
import AvatarMenu from './AvatarMenu';
import NotificationBell from './NotificationBell';
import { useGetUnreadCountQuery } from '@/services/messagesApi';
import { UNREAD_POLL_INTERVAL_MS } from '@/lib/constants';
import { useFallbackPolling } from '@/lib/socket';

interface SearchInputProps {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder: string;
}

function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  return (
    <label className="relative block">
      <span className="sr-only">Search notes and people</span>
      <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
      <input
        type="search"
        maxLength={100}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-white/10 pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/60 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
      />
    </label>
  );
}

// Giriş yapmış kullanıcının üst çubuğu (ziyaretçi GuestNavbar görür; bkz. PageLayout).
export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  // Ana sayfada geniş ekranda sol menü (FeedSidebar) olduğu için oradaki bağlantılar üst çubukta tekrarlanmaz.
  const onHome = location.pathname === '/';
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');

  // Ana sayfadaki arama parametresi değişirse (örn. filtre temizlendi) kutuyu senkronla.
  // (Effect yerine render sırasında önceki değerle karşılaştırılır.)
  const urlQuery = location.pathname === '/' ? (searchParams.get('q') ?? '') : null;
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery);
    if (urlQuery !== null) setSearch(urlQuery);
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = location.pathname === '/' ? new URLSearchParams(searchParams) : new URLSearchParams();
    const q = search.trim();
    if (q) params.set('q', q);
    else params.delete('q');
    params.delete('page');
    params.delete('tab');
    navigate(`/?${params.toString()}`);
  };

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-navy-900 to-navy-700 shadow-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 md:gap-6">
        <Logo light />

        <form onSubmit={handleSubmit} className="flex-1 min-w-0 max-w-xl hidden md:block" role="search">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes, courses or people..."
          />
        </form>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Gruplar, mesajlar ve not yükleme ana sayfanın sol menüsünde, telefonda alt sekme çubuğunda,
              diğer sayfalarda hesap menüsünde. Mesajlar ikonu sol menünün olmadığı yerlerde gösterilir. */}
          <MessagesLink hideOnLarge={onHome} />
          <Link
            to="/upload"
            title="Upload Note"
            aria-label="Upload Note"
            className="hidden md:inline-flex items-center gap-2 rounded-lg bg-white px-3 lg:px-4 py-2 text-sm font-semibold text-navy-900 shadow-sm hover:bg-navy-50 transition-colors"
          >
            <Upload size={16} />
            <span className="hidden lg:inline">Upload Note</span>
          </Link>
          <NotificationBell />
          <AvatarMenu />
        </div>
      </div>

      {/* Dar ekranlarda (md altı) arama kutusu ikinci satırda. */}
      <form onSubmit={handleSubmit} className="md:hidden px-4 sm:px-6 pb-3" role="search">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes or people..." />
      </form>
    </header>
  );
}

function MessagesLink({ hideOnLarge = false }) {
  const { data } = useGetUnreadCountQuery(undefined, {
    pollingInterval: useFallbackPolling(UNREAD_POLL_INTERVAL_MS),
    skipPollingIfUnfocused: true,
  });
  const count = data?.data?.count ?? 0;

  return (
    <Link
      to="/messages"
      className={`relative hidden md:inline-flex ${hideOnLarge ? 'lg:hidden' : ''} h-10 w-10 items-center justify-center rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors`}
      title="Messages"
      aria-label={count ? `Messages, ${count} unread` : 'Messages'}
    >
      <MessageCircle size={22} />
      {count > 0 && (
        <span className="absolute top-1 left-5 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-navy-800">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
