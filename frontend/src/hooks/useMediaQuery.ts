import { useEffect, useState } from 'react';

// Tailwind'in lg kırılımı: büyük ekran düzenine geçilen genişlik.
export const DESKTOP_QUERY = '(min-width: 1024px)';

// CSS medya sorgusu şu an eşleşiyor mu; pencere boyutu değişince güncellenir.
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
