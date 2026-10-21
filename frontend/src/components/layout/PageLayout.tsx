import type { ReactNode } from 'react';
import { useAppSelector } from '@/app/hooks';
import Navbar from './Navbar';
import Logo from './Logo';
import GuestNavbar from './GuestNavbar';
import VerifyBanner from './VerifyBanner';
import Footer from './Footer';
import MobileTabBar from './MobileTabBar';

// Auth ekranları dışındaki tüm sayfaların ortak iskeleti. Ziyaretçi, karşılama sayfasındaki sade üst çubuğu görür.
// Giriş yapılmışsa telefonda alt sekme çubuğu çıkar; içerik onun altında kalmasın diye alttan boşluk bırakılır.
// hero: navbar'ın hemen altına, kenardan kenara konan alan (ör. yasal sayfaların başlık bandı).
// plain: gri yerine beyaz zemin ve üstte sadece logo (belge gibi okunan sayfalar, ör. yasal metinler).
export default function PageLayout({
  children,
  narrow = false,
  hero,
  plain = false,
}: {
  children: ReactNode;
  narrow?: boolean;
  hero?: ReactNode;
  plain?: boolean;
}) {
  const token = useAppSelector((state) => state.auth.token);

  return (
    <div className={`min-h-screen flex flex-col ${plain ? 'bg-white' : ''} ${token ? 'pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0' : ''}`}>
      {plain ? (
        <header className="sticky top-0 z-50 bg-navy-900 font-display">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center">
            <Logo light />
          </div>
        </header>
      ) : token ? (
        <Navbar />
      ) : (
        <GuestNavbar />
      )}
      <VerifyBanner />
      {hero}
      <main className={`flex-1 w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 ${narrow ? 'max-w-3xl' : 'max-w-6xl'}`}>
        {children}
      </main>
      <Footer />
      {token && <MobileTabBar />}
    </div>
  );
}
