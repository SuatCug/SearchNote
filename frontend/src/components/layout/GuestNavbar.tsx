import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Logo from './Logo';
import { AppIcon, CoursesIcon, GroupsIcon, PopularNotesIcon, StudentsIcon } from './GuestNavIcons';
import Modal from '@/components/common/Modal';
import appQr from '@/assets/landing/app-qr.png';

// LinkedIn'in ziyaretçi navbar'ı gibi uygulamanın bölümleri. Ziyaretçi hiçbir şeyi hesapsız kullanamadığı için hepsi giriş
// sayfasına gider; `from` giriş yapılınca o bölümün açılmasını sağlar.
// How it works ve About footer'da.
const NAV_ITEMS = [
  { from: '/?all=1&sort=popular', label: 'Popular Notes', icon: PopularNotesIcon },
  { from: '/?all=1', label: 'Courses', icon: CoursesIcon },
  { from: '/', label: 'Students', icon: StudentsIcon },
  { from: '/groups?tab=explore', label: 'Groups', icon: GroupsIcon },
];

// Giriş yapmamış ziyaretçinin lacivert üst çubuğu (karşılama sayfası ve diğer tüm sayfalar).
// Simgeli bağlantılar telefonda gizlenir, sadece Sign up / Log in görünür.
export default function GuestNavbar() {
  const location = useLocation();
  const onLanding = location.pathname === '/' && !location.search;
  const [appOpen, setAppOpen] = useState(false);

  // Karşılama sayfasındayken logo sayfanın başına kaydırır.
  const handleSectionClick = (id: string) => {
    if (!onLanding) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <header className="sticky top-0 z-50 bg-navy-900 font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Diğer sayfalarla (giriş, footer, üye navbar'ı) aynı ikonlu logo */}
        <div className="flex min-h-11 items-center">
          <Logo light onClick={() => handleSectionClick('top')} />
        </div>

        <nav aria-label="Main" className="flex items-center">
          <div className="hidden lg:flex items-center">
            {NAV_ITEMS.map(({ from, label, icon: Icon }) => (
              <Link
                key={label}
                to="/login"
                state={{ from }}
                className="flex min-h-11 flex-col items-center gap-0.5 px-4 py-1.5 text-[13px] text-white/70 hover:text-white transition-colors"
              >
                <Icon />
                {label}
              </Link>
            ))}
            {/* Uygulamayı indirmek hesap gerektirmez: giriş sayfasına değil QR penceresine açılır */}
            <button type="button" onClick={() => setAppOpen(true)} className="flex min-h-11 flex-col items-center gap-0.5 px-4 py-1.5 text-[13px] text-white/70 hover:text-white transition-colors">
              <AppIcon />
              Get the app
            </button>
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

      {appOpen && (
        <Modal title="Get the app" size="sm" onClose={() => setAppOpen(false)}>
          {/* QR, afişteki (SearchNote-afis.png) Android uygulaması koduyla aynı */}
          <div className="flex flex-col items-center gap-2 px-6 pt-2 pb-4 text-center">
            <img src={appQr} alt="QR code for the SearchNote Android app" width={192} height={192} className="mb-2 h-48 w-48" />
            <p className="text-[15px] font-semibold text-gray-900">Scan to get the Android app</p>
            <p className="text-sm text-gray-500">Point your Android phone&rsquo;s camera at the code. The app is not available for iPhone.</p>
          </div>
        </Modal>
      )}
    </header>
  );
}
