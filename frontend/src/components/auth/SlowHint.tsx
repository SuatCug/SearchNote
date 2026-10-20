import { useEffect, useState } from 'react';

// İstek birkaç saniyeden uzun sürerse butonun altında gösterilir: Render'daki sunucu uykudan uyanıyor olabilir
// (mobil uygulamadaki useSlowHint ile aynı süre ve metin).
export default function SlowHint({ loading, delayMs = 4000 }: { loading: boolean; delayMs?: number }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setSlow(true), delayMs);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [loading, delayMs]);

  if (!loading || !slow) return null;
  return <p className="mt-3 text-center text-[13px] text-gray-500">Waking up the server, this can take up to a minute…</p>;
}
