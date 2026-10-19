import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Info, Lightbulb, Users, type LucideIcon } from 'lucide-react';
import Logo from './Logo';

type NavItem = { label: string; icon: LucideIcon } & ({ section: string } | { to: string });

// Dersler ve bölümler karşılama sayfasında tek bölüm (sekmeli) olduğu için tek bağlantı: "Courses".
// "How it works" footer'daki gibi ayrı How It Works sayfasına gider (aynı ad iki farklı yere gitmesin).
const NAV_ITEMS: NavItem[] = [
  { section: 'features', label: 'Courses', icon: BookOpen },
  { to: '/how-it-works', label: 'How it works', icon: Lightbulb },
  { section: 'community', label: 'Groups', icon: Users },
  { to: '/about', label: 'About', icon: Info },
];

// Giriş yapmamış ziyaretçinin lacivert üst çubuğu (karşılama sayfası ve diğer tüm sayfalar).
// Simgeli bağlantılar karşılama sayfasındaki bölümlere gider; telefonda gizlenir, sadece Sign up / Log in görünür.
export default function GuestNavbar() {
  const location = useLocation();
  const onLanding = location.pathname === '/' && !location.search;

  // Zaten karşılama sayfasındaysa (aynı #bölüm adresine tekrar tıklanınca da) doğrudan kaydırılır;
  // başka sayfadan gelindiğinde kaydırmayı ScrollToTop adresteki #bölüme göre yapar.
  const handleSectionClick = (id: string) => {
    if (!onLanding) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <header className="sticky top-0 z-50 bg-navy-900 font-display">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Diğer sayfalarla (giriş, footer, üye navbar'ı) aynı ikonlu logo */}
        <div className="flex min-h-11 items-center">
          <Logo light onClick={() => handleSectionClick('top')} />
        </div>

        <nav aria-label="Main" className="flex items-center">
          <div className="hidden lg:flex items-center">
            {NAV_ITEMS.map(({ label, icon: Icon, ...item }) => {
              const active = 'to' in item && location.pathname === item.to;
              const className = `flex min-h-11 flex-col items-center gap-0.5 px-4 py-1.5 text-xs transition-colors ${
                active ? 'text-white' : 'text-[#c9d3e3] hover:text-white'
              }`;
              const content = (
                <>
                  <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
                  {label}
                </>
              );
              return 'to' in item ? (
                <Link key={label} to={item.to} className={className} aria-current={active ? 'page' : undefined}>
                  {content}
                </Link>
              ) : (
                <Link key={label} to={`/#${item.section}`} onClick={() => handleSectionClick(item.section)} className={className}>
                  {content}
                </Link>
              );
            })}
            <span aria-hidden="true" className="ml-4 mr-5 h-10 w-px bg-white/25" />
          </div>

          <Link
            to="/register"
            className="flex min-h-11 items-center justify-center rounded-full bg-white w-24 sm:w-32 text-[15px] sm:text-base font-semibold text-navy-900 hover:bg-navy-50 transition-colors whitespace-nowrap"
          >
            Sign up
          </Link>
          <Link
            to="/login"
            className="ml-2 flex min-h-11 items-center justify-center rounded-full bg-white w-24 sm:w-32 text-[15px] sm:text-base font-semibold text-navy-900 hover:bg-navy-50 transition-colors whitespace-nowrap"
          >
            Log in
          </Link>
        </nav>
      </div>
    </header>
  );
}
