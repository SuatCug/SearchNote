import type { ComponentType } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import Logo from './Logo';
import { AskIcon, CoursesIcon, GroupsIcon, KnowledgeIcon, PopularNotesIcon, PracticeIcon } from './GuestNavIcons';
import { NAV_INDICATOR } from './navStyles';

type Section = 'explore' | 'popular' | 'groups';

// Ziyaretçi notları hesapsız gezebilir: Explore / Popular / Groups doğrudan sayfalara gider.
// Ask / AI Practice / Knowledge map en son eklenen AI özellikleri; giriş gerektirir
// (RequireAuth giriş sayfasına yollar, girişten sonra o sayfa açılır).
const NAV_ITEMS: { id: Section | 'ask' | 'practice' | 'knowledge'; to: string; label: string; icon: ComponentType }[] = [
  { id: 'explore', to: '/?all=1', label: 'Explore', icon: CoursesIcon },
  { id: 'popular', to: '/?all=1&sort=popular', label: 'Popular', icon: PopularNotesIcon },
  { id: 'groups', to: '/groups', label: 'Groups', icon: GroupsIcon },
  { id: 'ask', to: '/ask', label: 'Ask', icon: AskIcon },
  { id: 'practice', to: '/practice', label: 'AI Practice', icon: PracticeIcon },
  { id: 'knowledge', to: '/knowledge', label: 'Knowledge map', icon: KnowledgeIcon },
];

// Hangi bölümün açık olduğu (altı çizili gösterilir).
function useActiveSection(): Section | null {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  if (pathname.startsWith('/groups')) return 'groups';
  if (pathname !== '/' || !params.toString()) return null;
  return params.get('sort') === 'popular' && !params.get('q') ? 'popular' : 'explore';
}

// Giriş yapmamış ziyaretçinin lacivert üst çubuğu (karşılama sayfası ve diğer tüm sayfalar).
// Arama kutusu yok: ziyaretçi aramayı Explore sayfasının üstündeki büyük kutudan yapar.
// Geniş ekran: logo solda; Explore / Popular / Groups / Ask / AI Practice / Knowledge map ve Sign up / Log in sağda.
// md–lg: bağlantılar ikinci satırda. Telefonda: logo, Log in ve Explore'a (arama + bölüm kısayolları) giden arama ikonu;
// tanıtım sayfasında arama ikonu yerine Sign up (orada odak kayıtta, aramaya hero'daki bağlantıyla geçilir).
// 1024px'te (lg) her şey sığsın diye bağlantılar ve butonlar biraz dar, xl'de tam boy.
export default function GuestNavbar() {
  const location = useLocation();
  const active = useActiveSection();
  const onLanding = location.pathname === '/' && !location.search;

  // Karşılama sayfasındayken logo sayfanın başına kaydırır.
  const scrollToTop = () => {
    if (!onLanding) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  return (
    <header className="sticky top-0 z-50 bg-navy-900 font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 lg:gap-4">
        <div className="flex min-w-0 items-center">
          <Logo light onClick={scrollToTop} />
        </div>

        <div className="flex shrink-0 items-center">
          {!onLanding && (
            <Link
              to="/?all=1"
              aria-label="Search notes"
              title="Search notes"
              className="mr-1 inline-flex h-11 w-11 items-center justify-center rounded-full text-white/90 hover:bg-white/10 md:hidden"
            >
              <Search size={22} />
            </Link>
          )}
          <nav aria-label="Main" className="hidden lg:flex h-16 items-stretch gap-1">
            {NAV_ITEMS.map(({ id, to, label, icon: Icon }) => (
              <Link
                key={id}
                to={to}
                aria-current={active === id ? 'page' : undefined}
                className={`relative flex min-w-[68px] xl:min-w-[76px] whitespace-nowrap flex-col items-center justify-center gap-1 px-2 xl:px-3 text-[12px] font-medium transition-colors ${
                  active === id ? 'text-white' : 'text-white/70 hover:text-white'
                }`}
              >
                <Icon />
                {label}
                {active === id && <span className={NAV_INDICATOR} aria-hidden="true" />}
              </Link>
            ))}
            <span aria-hidden="true" className="ml-2 mr-3 xl:ml-3 xl:mr-5 my-3 w-px bg-white/25" />
          </nav>

          <Link
            to="/register"
            className={`${onLanding ? 'flex' : 'hidden sm:flex'} min-h-11 sm:min-w-[124px] lg:min-w-[112px] xl:min-w-[124px] items-center justify-center rounded-full px-5 sm:px-8 lg:px-6 xl:px-8 text-base sm:text-[17px] font-semibold text-white hover:bg-white/10 transition-colors whitespace-nowrap`}
          >
            Sign up
          </Link>
          <Link
            to="/login"
            state={{ from: `${location.pathname}${location.search}`, plain: true }}
            className="ml-1.5 sm:ml-2 flex min-h-11 sm:min-w-[124px] lg:min-w-[112px] xl:min-w-[124px] items-center justify-center rounded-full bg-white px-5 sm:px-8 lg:px-6 xl:px-8 text-base sm:text-[17px] font-semibold text-navy-900 hover:bg-navy-50 transition-colors whitespace-nowrap"
          >
            Log in
          </Link>
        </div>
      </div>

      {/* md–lg: bölüm bağlantıları için ince ikinci satır */}
      <div className="hidden md:block lg:hidden border-t border-white/10">
        <nav aria-label="Sections" className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1 h-11">
          {NAV_ITEMS.map(({ id, to, label }) => (
            <Link
              key={id}
              to={to}
              aria-current={active === id ? 'page' : undefined}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                active === id ? 'bg-white text-navy-900' : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

// Telefonda (md altı) navbar'da bölüm bağlantıları olmadığı için Explore sayfasında, arama kutusunun altında gösterilir.
export function GuestSectionChips({ className = '' }: { className?: string }) {
  const active = useActiveSection();
  return (
    <nav aria-label="Sections" className={`-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 ${className}`}>
      {NAV_ITEMS.map(({ id, to, label }) => (
        <Link
          key={id}
          to={to}
          aria-current={active === id ? 'page' : undefined}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
            active === id ? 'border-navy-700 bg-navy-700 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
