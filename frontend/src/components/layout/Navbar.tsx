import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Home, MessageCircle, Search, Upload, Users, X, type LucideIcon } from 'lucide-react';
import Logo from './Logo';
import AvatarMenu from './AvatarMenu';
import NotificationBell from './NotificationBell';
import SearchBox from './SearchBox';
import { NAV_BADGE, NAV_INDICATOR, NAV_ITEM, NAV_LABEL } from './navStyles';
import { useGetUnreadCountQuery } from '@/services/messagesApi';
import { UNREAD_POLL_INTERVAL_MS } from '@/lib/constants';
import { useFallbackPolling } from '@/lib/socket';

// Telefonda aşağı kaydırırken üst çubuk bu kadar kaydırmadan sonra gizlenir; yukarı kaydırınca geri gelir.
const HIDE_AFTER_PX = 80;
const MOBILE_QUERY = '(max-width: 767px)';

// Giriş yapmış kullanıcının üst çubuğu (ziyaretçi GuestNavbar görür; bkz. PageLayout).
// Geniş ekran (LinkedIn gibi): logo + arama solda; Home / Groups / Messages / Notifications, "Upload Note" ve avatar menüsü sağda.
// Telefonda: logo, arama ikonu, bildirimler, avatar (diğer bağlantılar alt sekme çubuğunda).
export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Ana sayfadaki arama parametresi değişirse (örn. filtre temizlendi) kutuyu senkronla.
  // (Effect yerine render sırasında önceki değerle karşılaştırılır.)
  const urlQuery = location.pathname === '/' ? (searchParams.get('q') ?? '') : null;
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  // Telefonda arama kutusu ikonla açılır; ana sayfada bir arama yapılmışsa açık gelir (aranan kelime görünsün).
  const [mobileSearchOpen, setMobileSearchOpen] = useState(Boolean(urlQuery));
  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery);
    if (urlQuery !== null) setSearch(urlQuery);
    if (urlQuery) setMobileSearchOpen(true);
  }

  const hidden = useHideOnScroll(!mobileSearchOpen);

  // "/" tuşu arama kutusuna odaklanır (yazı yazılan bir alanda değilken).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      e.preventDefault();
      if (window.matchMedia(MOBILE_QUERY).matches) {
        setMobileSearchOpen(true);
        requestAnimationFrame(() => mobileInputRef.current?.focus());
      } else {
        desktopInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const runSearch = (q: string) => {
    const params = location.pathname === '/' ? new URLSearchParams(searchParams) : new URLSearchParams();
    if (q) params.set('q', q);
    else params.delete('q');
    params.delete('page');
    params.delete('tab');
    navigate(`/?${params.toString()}`);
  };

  const toggleMobileSearch = () => {
    if (mobileSearchOpen) {
      setMobileSearchOpen(false);
      return;
    }
    setMobileSearchOpen(true);
    requestAnimationFrame(() => mobileInputRef.current?.focus());
  };

  return (
    // Gizlenme transform yerine top ile: transform, içerideki "fixed" menü panellerini çubuğa bağlardı.
    <header
      className={`sticky z-50 bg-gradient-to-r from-navy-900 to-navy-700 shadow-md transition-[top] duration-200 ${hidden ? '-top-16' : 'top-0'}`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 md:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
          <Logo light />
          <div className="hidden md:block min-w-0 flex-1 max-w-md">
            <SearchBox
              inputRef={desktopInputRef}
              value={search}
              onChange={setSearch}
              onSearch={runSearch}
              placeholder="Search notes, courses or people..."
            />
          </div>
        </div>

        <div className="flex items-center gap-1 lg:gap-0.5 shrink-0">
          {/* Telefonda ana sayfa / gruplar / mesajlar / yükleme alt sekme çubuğunda; burada sadece arama ikonu. */}
          <button
            type="button"
            onClick={toggleMobileSearch}
            aria-expanded={mobileSearchOpen}
            aria-label={mobileSearchOpen ? 'Close search' : 'Search'}
            className={`${NAV_ITEM} text-white/90 md:hidden`}
          >
            {mobileSearchOpen ? <X size={21} /> : <Search size={21} />}
          </button>
          <nav aria-label="Main" className="hidden md:flex items-center gap-1 lg:gap-0.5">
            <NavIcon to="/" end icon={Home} label="Home" />
            <NavIcon to="/groups" icon={Users} label="Groups" />
            <MessagesLink />
          </nav>
          <NotificationBell />
          <Link
            to="/upload"
            title="Upload Note"
            aria-label="Upload Note"
            className="mx-1 hidden md:inline-flex items-center gap-2 rounded-lg bg-white px-3 lg:px-4 py-2 text-sm font-semibold text-navy-900 shadow-sm hover:bg-navy-50 transition-colors"
          >
            <Upload size={16} />
            <span className="hidden lg:inline">Upload Note</span>
          </Link>
          <AvatarMenu />
        </div>
      </div>

      {/* Dar ekranlarda (md altı) arama kutusu ikinci satırda, arama ikonuyla açılıp kapanır. */}
      {mobileSearchOpen && (
        <div className="md:hidden px-4 sm:px-6 pb-3">
          <SearchBox
            inputRef={mobileInputRef}
            value={search}
            onChange={setSearch}
            onSearch={runSearch}
            placeholder="Search notes or people..."
          />
        </div>
      )}
    </header>
  );
}

// Telefonda aşağı kaydırınca true (çubuk gizlenir), yukarı kaydırınca false. enabled false iken hep görünür.
function useHideOnScroll(enabled: boolean) {
  const [hidden, setHidden] = useState(false);
  const [prevEnabled, setPrevEnabled] = useState(enabled);
  if (enabled !== prevEnabled) {
    setPrevEnabled(enabled);
    if (!enabled) setHidden(false);
  }

  useEffect(() => {
    if (!enabled) return;
    const mobile = window.matchMedia(MOBILE_QUERY);
    let lastY = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      if (!mobile.matches || y < HIDE_AFTER_PX) setHidden(false);
      else if (Math.abs(y - lastY) > 6) setHidden(y > lastY);
      lastY = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return enabled && hidden;
}

// Ana bağlantı: ikon, geniş ekranda altında etiket; aktif sayfada altında beyaz çizgi.
function NavIcon({ to, end = false, icon: Icon, label }: { to: string; end?: boolean; icon: LucideIcon; label: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      aria-label={label}
      className={({ isActive }) => `${NAV_ITEM} ${isActive ? 'text-white' : 'text-white/70'}`}
    >
      {({ isActive }) => (
        <>
          <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
          <span className={NAV_LABEL}>{label}</span>
          {isActive && <span className={NAV_INDICATOR} aria-hidden="true" />}
        </>
      )}
    </NavLink>
  );
}

function MessagesLink() {
  const { data } = useGetUnreadCountQuery(undefined, {
    pollingInterval: useFallbackPolling(UNREAD_POLL_INTERVAL_MS),
    skipPollingIfUnfocused: true,
  });
  const count = data?.data?.count ?? 0;

  return (
    <NavLink
      to="/messages"
      className={({ isActive }) => `${NAV_ITEM} ${isActive ? 'text-white' : 'text-white/70'}`}
      title="Messages"
      aria-label={count ? `Messages, ${count} unread` : 'Messages'}
    >
      {({ isActive }) => (
        <>
          <MessageCircle size={22} strokeWidth={isActive ? 2.4 : 2} />
          <span className={NAV_LABEL}>Messages</span>
          {isActive && <span className={NAV_INDICATOR} aria-hidden="true" />}
          {count > 0 && <span className={NAV_BADGE}>{count > 99 ? '99+' : count}</span>}
        </>
      )}
    </NavLink>
  );
}
