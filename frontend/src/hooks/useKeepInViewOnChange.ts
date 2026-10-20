import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

// Aynı adreste sekme değişince (?tab=...) adres yolu değişmediği için ScrollToTop çalışmaz ve kaydırma konumu
// korunur; yeni içerik kısaysa tarayıcı konumu sayfa sonuna sıkıştırır ("en alta atıyor").
// Kullanıcı hedefin (sekme çubuğu / içerik başı) altına kaydırmışsa, key değişince hedef ekranın üstüne getirilir.
// Hedefe scroll-mt-* verilmeli (üst çubuk altında kalsın). İçeriğe min-h verilirse kısa listelerde de hedef üste çıkabilir.
export function useKeepInViewOnChange(key: string, ref: RefObject<HTMLElement | null>, offset = 80) {
  const prevKey = useRef(key);
  // Değişimden önceki son durum: hedef ekranın üstünde mi kalmıştı.
  const past = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      past.current = Boolean(ref.current && ref.current.getBoundingClientRect().top < offset);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [ref, offset]);

  // Scroll olayı bir sonraki karede geldiği için past burada hâlâ değişimden önceki değeri taşır.
  useLayoutEffect(() => {
    if (prevKey.current === key) return;
    prevKey.current = key;
    if (past.current) ref.current?.scrollIntoView({ block: 'start' });
  }, [key, ref]);
}
