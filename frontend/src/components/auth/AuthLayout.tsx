import type { ReactNode } from 'react';
import Logo from '@/components/layout/Logo';
// Amfide konuşan öğrenciler. Unsplash Lisansı (ücretsiz, atıf gerekmez), fotoğraf: Vitaly Gariev,
// unsplash.com/photos/TB5HpfJf7mA (1920px genişliğe küçültüldü).
import studentsPhoto from '@/assets/auth/students-talking.jpg';

// Auth ekranları (Login/Register/Verify) için ortak iki panelli yerleşim.
// Solda gerçek öğrenci fotoğrafı (ikonlu özellik listesi şablon gibi duruyordu), sağda form paneli.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen lg:h-screen grid lg:grid-cols-2 bg-white">
      <div className="relative hidden lg:block overflow-hidden bg-navy-900">
        {/* Fotoğrafın solundaki konuşan grup panelde kalsın diye kırpma sola yakın. */}
        <img
          src={studentsPhoto}
          alt="University students talking and laughing in a lecture hall"
          // Fotoğrafın kendi ışığı hafif soğuk (pencereden gelen mavi ışık): biraz aydınlatıp ısıtılır.
          className="absolute inset-0 h-full w-full object-cover object-[30%_center] [filter:brightness(1.1)_saturate(1.05)_sepia(0.12)]"
        />
        {/* Logo ve başlık okunsun diye sadece üst kısımda hafif, renksiz (siyah) bir geçiş; lacivert geçiş
            fotoğrafı maviye boyuyordu. Fotoğrafın geri kalanı doğal (sıcak) renginde kalır. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.6)_0%,rgba(0,0,0,0.3)_22%,rgba(0,0,0,0)_38%)]"
        />
        <div className="relative flex flex-col items-center gap-6 p-12 text-center text-white">
          {/* Logo sol üstte, başlık ortada */}
          <div className="self-start">
            <Logo light iconOnly size={56} />
          </div>
          {/* Tek satır: panel genişliğine göre büyüyen yazı boyu (1024px'te 26px, 1536px+ 40px); "note" logodaki "Note" mavisinde */}
          <h2 className="m-0 font-display font-light leading-tight whitespace-nowrap text-[26px] xl:text-[34px] 2xl:text-[40px]">
            Search any <span className="text-sky-300">note</span>, share your own.
          </h2>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-8 overflow-y-auto">
        {/* 400px: Google butonu en fazla bu genişlikte çizilir; form alanları ve butonlar onunla aynı boyda olsun. */}
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
