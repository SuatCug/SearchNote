import type { Request } from 'express';
import asyncHandler from '../utils/asyncHandler.ts';
import { University } from '../models/index.ts';
import { searchUniversities } from '../services/university.service.ts';

// Üniversite seçici (mobil kayıt / profil / not formu). Giriş gerektirmez: kayıt sırasında da kullanılır.
const DEFAULT_COUNTRY = 'TR';
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const countryParam = (req: Request) => {
  const value = String(req.query.country ?? DEFAULT_COUNTRY).toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : DEFAULT_COUNTRY;
};

type UniversityDoc = { _id: unknown; name: string; names: string[]; city: string; country: string; countryName: string };

const toDto = (u: UniversityDoc) => ({
  id: String(u._id),
  name: u.name,
  aliases: u.names,
  city: u.city,
  country: u.country,
  countryName: u.countryName,
});

// GET /api/universities?country=TR → bir ülkedeki tüm okullar, alfabetik (açılır listenin varsayılan hali)
const listByCountry = asyncHandler(async (req, res) => {
  const universities = await University.find({ country: countryParam(req) })
    .select('name names city country countryName')
    .collation({ locale: 'tr' })
    .sort({ name: 1 })
    .lean();
  res.set('Cache-Control', 'public, max-age=86400');
  res.json({ success: true, data: { universities: universities.map(toDto) } });
});

// GET /api/universities/search?q=hacet&country=TR&limit=20 → dünya çapında arama (kullanıcının ülkesi önde)
const search = asyncHandler(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const limit = Math.min(Math.max(Number(req.query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const universities = await searchUniversities(q, countryParam(req), limit);
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ success: true, data: { universities: universities.map(toDto) } });
});

export { listByCountry, search };
