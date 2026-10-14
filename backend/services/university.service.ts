import { readFileSync } from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { normalize } from '../utils/normalize.util.ts';
import type { UniversityRecord } from './yok.service.ts';

// Türkiye'deki üniversiteler ve bölümleri. Veritabanında değil, YÖK Atlas'tan üretilen dosyada durur
// (data/universities-tr.json, `npm run sync:universities` ile yenilenir); sunucu açılışta belleğe okur.
const readData = <T>(file: string): T =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, '..', 'data', file), 'utf8')) as T;

const UNIVERSITIES = readData<UniversityRecord[]>('universities-tr.json');
const BY_ID = new Map(UNIVERSITIES.map((u) => [u.id, u]));
const BY_NAME = new Map(UNIVERSITIES.map((u) => [normalize(u.name), u]));
// Okul listede yoksa (elle yazılmışsa): Türkiye'nin klasik lisans bölümleri (en az 5 üniversitede okutulanlar)
const COMMON_DEPARTMENTS = readData<string[]>('departments-tr.json');

// Liste ekranı için bölümler olmadan (hafif)
const LIST = UNIVERSITIES.map(({ id, name, aliases, city }) => ({ id, name, aliases, city }));
export const listUniversities = () => LIST;

export const listDepartments = (universityId: string | null, universityName: string | null) => {
  const university =
    (universityId && BY_ID.get(universityId)) || (universityName && BY_NAME.get(normalize(universityName))) || null;
  if (university) {
    return {
      source: 'university' as const,
      departments: university.departments,
      associateDepartments: university.associateDepartments,
    };
  }
  return { source: 'common' as const, departments: COMMON_DEPARTMENTS, associateDepartments: [] };
};

// Önceki sürümler üniversite listesini MongoDB'de tutuyordu; artık gerekmeyen bu koleksiyonları siler.
// Koleksiyonlar yoksa hiçbir şey yapmaz (her açılışta güvenle çalışır).
export const dropLegacyUniversityData = async () => {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
    for (const name of ['universities', 'syncstates']) {
      if (existing.has(name)) {
        await db.dropCollection(name);
        console.log(`🧹 Dropped unused collection: ${name}`);
      }
    }
  } catch (error) {
    console.error('❌ Could not drop old university collections:', (error as Error).message);
  }
};
