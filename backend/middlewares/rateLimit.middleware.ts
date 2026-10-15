import type { RequestHandler } from 'express';
import ApiError from '../utils/apiError.ts';

// Basit, bellek içi sınırlayıcı (anahtar başına kayan pencere). İzin varsa true döner ve isteği sayar.
// Tek sunucu süreci için yeterli; birden fazla süreç/serverless ortamda Redis tabanlı bir sınırlayıcıya geçilmeli.
const createLimiter = ({ windowMs, max }: { windowMs: number; max: number }) => {
  const hits = new Map<string, number[]>();

  return (key: string) => {
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);

    if (recent.length >= max) return false;

    recent.push(now);
    hits.set(key, recent);

    // Bellek büyümesin diye ara sıra süresi dolmuş kayıtlar temizlenir.
    if (hits.size > 5000) {
      for (const [k, times] of hits) {
        if (!times.some((t) => now - t < windowMs)) hits.delete(k);
      }
    }
    return true;
  };
};

// Hazır bir sınırlayıcıyı middleware olarak kullanır (aynı sayaç socket tarafında da paylaşılabilir).
// authenticate'ten sonra kullanılmalıdır.
const rateLimitWith =
  (allow: (key: string) => boolean, message: string): RequestHandler =>
  (req, _res, next) =>
    allow(req.user?.id || req.ip || '') ? next() : next(new ApiError(429, message));

// Kullanıcı başına kayan pencere istek sınırlayıcı middleware'i.
const rateLimit = ({ windowMs, max, message }: { windowMs: number; max: number; message: string }): RequestHandler =>
  rateLimitWith(createLimiter({ windowMs, max }), message);

export { createLimiter, rateLimitWith };
export default rateLimit;
