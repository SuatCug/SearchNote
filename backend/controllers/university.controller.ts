import asyncHandler from '../utils/asyncHandler.ts';
import { listDepartments, listUniversities } from '../services/university.service.ts';

// Okul ve bölüm seçici (mobil kayıt / profil / not formu). Giriş gerektirmez: kayıt sırasında da kullanılır.

// GET /api/universities → Türkiye'deki tüm üniversiteler, alfabetik
const list = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { universities: listUniversities() } });
});

// GET /api/universities/departments?university=<id> (ya da ?name=<okul adı>) → bölüm listesi
// source: 'university' (o okulun YÖK lisans + önlisans bölümleri), 'common' (Türkiye'nin klasik bölümleri)
const departments = asyncHandler(async (req, res) => {
  const id = typeof req.query.university === 'string' && req.query.university ? req.query.university : null;
  const name = typeof req.query.name === 'string' && req.query.name.trim() ? req.query.name : null;
  res.json({ success: true, data: listDepartments(id, name) });
});

export { departments, list };
