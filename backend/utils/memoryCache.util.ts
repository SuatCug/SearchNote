// Sık istenen ama nadiren değişen sonuçlar (arama filtreleri, popüler dersler) için küçük bir bellek önbelleği.
// Tek sunucu örneği için yeterli; değer süresi dolunca bir sonraki istekte yeniden hesaplanır.
// Aynı anahtar hesaplanırken gelen istekler aynı sorguyu bekler (veritabanına tek sorgu gider).
const createCache = <T>({ ttlMs, maxEntries = 500 }: { ttlMs: number; maxEntries?: number }) => {
  const entries = new Map<string, { value: Promise<T>; expiresAt: number }>();

  return (key: string, compute: () => PromiseLike<T>) => {
    const now = Date.now();
    const hit = entries.get(key);
    if (hit && hit.expiresAt > now) return hit.value;

    // Bellek büyümesin diye en eski kayıt atılır (Map ekleme sırasını korur).
    if (!hit && entries.size >= maxEntries) entries.delete(entries.keys().next().value!);

    // Promise.resolve: Mongoose sorguları (Query, Aggregate) her await'te yeniden çalışır; sorgu bir kez çalışıp
    // sonucu saklanan gerçek bir Promise'e dönüşür.
    const value = Promise.resolve(compute());
    entries.set(key, { value, expiresAt: now + ttlMs });
    // Hata önbellekte kalmasın: bir sonraki istek yeniden dener.
    value.catch(() => {
      if (entries.get(key)?.value === value) entries.delete(key);
    });
    return value;
  };
};

export { createCache };
