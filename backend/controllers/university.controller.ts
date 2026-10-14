import type { Request } from 'express';
import asyncHandler from '../utils/asyncHandler.ts';
import mongoose from 'mongoose';
import ApiError from '../utils/apiError.ts';
import { University } from '../models/index.ts';
import { listCountries, listDepartments, searchUniversities } from '../services/university.service.ts';

// Okul seçici (mobil kayıt / profil / not formu): önce ülke, sonra o ülkenin üniversiteleri.
// Giriş gerektirmez: kayıt sırasında da kullanılır.
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const PAGE_SIZE = 100;

// ?country=TR → "TR" (geçersizse null)
const countryParam = (req: Request) => {
  const value = String(req.query.country ?? '').toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : null;
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

// GET /api/universities/countries → [{ code: 'TR', name: 'Türkiye', count: 222 }, ...] (alfabetik)
const countries = asyncHandler(async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.json({ success: true, data: { countries: await listCountries() } });
});

// GET /api/universities?country=TR&page=1 → o ülkenin okulları, alfabetik, 100'erli sayfalar
const listByCountry = asyncHandler(async (req, res) => {
  const country = countryParam(req);
  if (!country) throw new ApiError(422, 'A valid country code is required.');
  const page = Math.max(Number(req.query.page) || 1, 1);
  const [universities, total] = await Promise.all([
    University.find({ country, hidden: { $ne: true } })
      .select('name names city country countryName')
      .collation({ locale: country === 'TR' ? 'tr' : 'en' })
      .sort({ name: 1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    University.countDocuments({ country, hidden: { $ne: true } }),
  ]);
  res.set('Cache-Control', 'public, max-age=86400');
  res.json({
    success: true,
    data: { universities: universities.map(toDto), page, hasMore: page * PAGE_SIZE < total, total },
  });
});

// GET /api/universities/search?q=hacet&country=TR&limit=20 → arama (country verilirse sadece o ülkede)
const search = asyncHandler(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const limit = Math.min(Math.max(Number(req.query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const universities = await searchUniversities(q, countryParam(req), limit);
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ success: true, data: { universities: universities.map(toDto) } });
});

// GET /api/universities/departments?university=<id>&country=TR → bölüm listesi
// source: 'university' (o okulun YÖK bölümleri), 'country' (Türkiye'deki tüm bölüm adları), 'general' (İngilizce alanlar)
const departments = asyncHandler(async (req, res) => {
  const id = typeof req.query.university === 'string' && mongoose.isValidObjectId(req.query.university)
    ? req.query.university
    : null;
  res.set('Cache-Control', 'public, max-age=86400');
  res.json({ success: true, data: await listDepartments(id, countryParam(req)) });
});

export { countries, departments, listByCountry, search };
