import { readFileSync } from 'node:fs';
import path from 'node:path';
import { normalize } from '../utils/normalize.util.ts';

// Türkiye'deki üniversiteler ve bölümleri: YÖK Atlas'ın açık JSON API'si.
// ÖSYM tercih kılavuzundaki tüm programlar (~21 bin satır; her bölüm × dil/burs türü) 5 istekte gelir.
// Yurt dışındaki (KKTC vb.) YÖK'e bağlı okullar şimdilik alınmaz.
// Sonuç veritabanına değil data/universities-tr.json dosyasına yazılır (scripts/syncUniversities.ts); liste yılda bir değişir.
const YOK_URL = 'https://yokatlas.yok.gov.tr/api/tercih-kilavuz/search';
const PAGE_SIZE = 5000;

// Uygulama İngilizce olduğu için bölüm adları İngilizce saklanır: YÖK'teki Türkçe ad → İngilizce
// (data/department-names-en.json). Tabloda olmayan yeni bir bölüm çıkarsa Türkçe kalır ve betik uyarır.
const DEPARTMENT_NAMES_EN: Record<string, string> = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '..', 'data', 'department-names-en.json'), 'utf8')
);

export const toEnglishDepartments = (names: Iterable<string>, missing?: Set<string>) =>
  [
    ...new Set(
      [...names].map((n) => {
        const en = DEPARTMENT_NAMES_EN[n];
        if (!en) missing?.add(n);
        return en ?? n;
      })
    ),
  ].sort((a, b) => a.localeCompare(b, 'en'));

interface YokProgram {
  universiteId: number;
  universiteAdi: string; // "ABDULLAH GÜL ÜNİVERSİTESİ (KAYSERİ)"
  uniIlAdi: string | null; // yurt dışındakilerde boş, KKTC'dekilerde "KIBRIS"
  birimGrupAdi: string; // bölüm: "Bilgisayar Mühendisliği" (dil/burs eki olmadan)
  birimTuruAdi: string; // "LISANS" | "ÖNLISANS"
}

// Bilinen kısaltmalar: aramada "odtu", "itu" yazınca da bulunsun
const ALIASES: Record<string, string[]> = {
  'orta dogu teknik universitesi': ['ODTÜ', 'METU'],
  'istanbul teknik universitesi': ['İTÜ', 'ITU'],
  'yildiz teknik universitesi': ['YTÜ'],
  'karadeniz teknik universitesi': ['KTÜ'],
  'gebze teknik universitesi': ['GTÜ'],
  'izmir yuksek teknoloji enstitusu': ['İYTE'],
  'dokuz eylul universitesi': ['DEÜ'],
  'tobb ekonomi ve teknoloji universitesi': ['TOBB ETÜ'],
  'marmara universitesi': ['MÜ'],
  'ondokuz mayis universitesi': ['OMÜ'],
  'abdullah gul universitesi': ['AGÜ'],
  'ankara yildirim beyazit universitesi': ['AYBÜ'],
  'istanbul medeniyet universitesi': ['İMÜ'],
  'mimar sinan guzel sanatlar universitesi': ['MSGSÜ'],
  'eskisehir osmangazi universitesi': ['ESOGÜ'],
  'kahramanmaras sutcu imam universitesi': ['KSÜ'],
};

const SMALL_WORDS = new Set(['ve', 'ile', 'de', 'da']);

// "ORTA DOĞU TEKNİK ÜNİVERSİTESİ" → "Orta Doğu Teknik Üniversitesi", "BEZM-İ ÂLEM" → "Bezm-i Âlem"
const titleCase = (text: string) =>
  text
    .toLocaleLowerCase('tr')
    .split(' ')
    .filter(Boolean)
    .map((word, i) =>
      i > 0 && SMALL_WORDS.has(word)
        ? word
        : word
            .split('-')
            .map((part, j) => (j > 0 && part.length < 2 ? part : part.charAt(0).toLocaleUpperCase('tr') + part.slice(1)))
            .join('-')
    )
    .join(' ');

const fetchPrograms = async () => {
  const programs: YokProgram[] = [];
  for (let page = 0; ; page++) {
    const res = await fetch(YOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters: {}, page, size: PAGE_SIZE, sortBy: 'universiteAdi', direction: 'ASC' }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`YÖK Atlas request failed (${res.status}).`);
    const data = (await res.json()) as { content: YokProgram[]; last: boolean };
    programs.push(...data.content);
    if (data.last || !data.content.length) break;
  }
  return programs;
};

export interface UniversityRecord {
  id: string; // YÖK üniversite kimliği
  name: string;
  aliases: string[];
  city: string;
  departments: string[]; // lisans
  associateDepartments: string[]; // önlisans
}

// Türkiye'deki okulları ve bölümlerini YÖK'ten çeker (alfabetik)
export const fetchYokUniversities = async (log: (msg: string) => void = () => {}): Promise<UniversityRecord[]> => {
  const programs = await fetchPrograms();
  log(`YÖK: ${programs.length} programs`);

  type School = { rawName: string; city: string; bachelor: Set<string>; associate: Set<string> };
  const schools = new Map<number, School>();
  for (const p of programs) {
    // Sadece Türkiye: yurt dışındakilerde il boş, KKTC'dekilerin adında "(KKTC-...)" var
    if (!p.uniIlAdi || /KKTC/.test(p.universiteAdi)) continue;
    const school = schools.get(p.universiteId) ?? {
      rawName: p.universiteAdi,
      city: p.uniIlAdi,
      bachelor: new Set<string>(),
      associate: new Set<string>(),
    };
    (/^L/.test(p.birimTuruAdi) ? school.bachelor : school.associate).add(p.birimGrupAdi.trim());
    schools.set(p.universiteId, school);
  }
  if (!schools.size) throw new Error('YÖK Atlas returned no universities.');

  const missing = new Set<string>();
  const universities = [...schools]
    .map(([yokId, school]) => {
      const name = titleCase(school.rawName.replace(/\([^)]*\)/g, '').trim());
      return {
        id: String(yokId),
        name,
        aliases: ALIASES[normalize(name)] ?? [],
        city: titleCase(school.city),
        departments: toEnglishDepartments(school.bachelor, missing),
        associateDepartments: toEnglishDepartments(school.associate, missing),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  if (missing.size) log(`⚠️ No English name for ${missing.size} departments (add to department-names-en.json): ${[...missing].join(', ')}`);
  return universities;
};
