import { readFileSync } from 'node:fs';
import path from 'node:path';
import { University } from '../models/index.ts';
import { normalize } from '../utils/normalize.util.ts';
import { syncYok } from './yok.service.ts';

// Türkiye'deki üniversiteler ve bölümleri (veri YÖK Atlas'tan, bkz. yok.service.ts).

const YOK_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;
const RETRY_MS = 30 * 60 * 1000;
let ensuring = false;

// Sunucu açılışında, arka planda (istekleri bekletmez): liste boşsa ya da 30 günden eskiyse YÖK'ten günceller.
// Hata olursa 30 dakika sonra tekrar dener.
export const ensureUniversities = async (): Promise<void> => {
  if (ensuring) return;
  ensuring = true;
  try {
    const fresh = await University.exists({ yokSyncedAt: { $gt: new Date(Date.now() - YOK_REFRESH_MS) } });
    if (!fresh) {
      console.log('🎓 Updating universities and departments from YÖK Atlas...');
      await syncYok((msg) => console.log(`🎓 ${msg}`));
    }
  } catch (error) {
    console.error('❌ University import failed, retrying in 30 minutes:', (error as Error).message);
    setTimeout(() => void ensureUniversities(), RETRY_MS);
  } finally {
    ensuring = false;
  }
};

// Tüm okullar, alfabetik (~200 kayıt; arama uygulamada yapılır)
export const listUniversities = () =>
  University.find().select('name aliases city').collation({ locale: 'tr' }).sort({ name: 1 }).lean();

// Bölüm listesi: okulun YÖK'teki lisans bölümleri ve önlisans programları; okul listede yoksa
// (elle yazılmışsa) Türkiye'nin klasik lisans bölümleri (en az 5 üniversitede okutulanlar).
const DEPARTMENTS: string[] = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '..', 'data', 'departments-tr.json'), 'utf8')
);

export const listDepartments = async (universityId: string | null, universityName: string | null) => {
  const university = universityId
    ? await University.findById(universityId).select('departments associateDepartments').lean()
    : universityName
      ? (await University.find().select('name departments associateDepartments').lean()).find(
          (u) => normalize(u.name) === normalize(universityName)
        )
      : null;
  if (university) {
    return {
      source: 'university' as const,
      departments: university.departments,
      associateDepartments: university.associateDepartments,
    };
  }
  return { source: 'common' as const, departments: DEPARTMENTS, associateDepartments: [] };
};
