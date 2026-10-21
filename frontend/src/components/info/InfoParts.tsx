// Bilgi sayfalarının (About, How it works, Guidelines, Help) ortak parçaları. Karşılama sayfasının diliyle aynı:
// ince büyük başlıklar, sola hizalı metin, bej bantlar; ikonlu kart yok.
import type { ReactNode } from 'react';

export const muted = 'text-[#5e6670]';
export const band = 'bg-[#f4f2ee]';
export const textLink = 'font-semibold text-navy-900 underline-offset-2 hover:underline hover:text-navy-950';
export const pillBase = 'inline-flex items-center justify-center rounded-full font-semibold transition-colors';
export const pillPrimary = `${pillBase} min-h-12 px-7 text-base bg-navy-900 text-white hover:bg-navy-950`;
export const pillOutline = `${pillBase} min-h-12 px-6 text-base border border-[#5e6670] text-[#3d434a] hover:border-navy-900 hover:text-navy-900`;
// Tıklanmayan bilgi çipi (dosya türleri gibi)
export const chip = `${pillBase} min-h-10 px-4 text-[15px] border border-[#8c9199] text-[#3d434a]`;

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`max-w-6xl mx-auto px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="m-0 font-light leading-[1.15] text-navy-900 text-balance text-[36px] sm:text-[44px] lg:text-[52px]">
      {children}
    </h1>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return <h2 className="m-0 font-light leading-[1.15] text-navy-900 text-balance text-[28px] sm:text-[32px] lg:text-[38px]">{children}</h2>;
}

// Üstü lacivert çizgili sade metin sütunu (karşılama sayfasındaki "Who is SearchNote for?" gibi).
export function RuledColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t-2 border-navy-900 pt-4">
      <span className="text-lg font-semibold">{title}</span>
      <div className={muted}>{children}</div>
    </div>
  );
}
