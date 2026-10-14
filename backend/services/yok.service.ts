import { University } from '../models/index.ts';
import { countryName } from '../utils/country.util.ts';
import { normalize } from '../utils/normalize.util.ts';

// Türkiye'deki (ve YÖK'e bağlı KKTC / yurt dışı) üniversiteler ve bölümleri: YÖK Atlas'ın açık JSON API'si.
// ÖSYM tercih kılavuzundaki tüm programlar (~21 bin satır; her bölüm × dil/burs türü) 5 istekte gelir.
// OpenAlex'in Türkiye listesi eski kalabiliyor (yeni kurulan / adı değişen / kapanan okullar), bu yüzden
// Türkiye için doğru kaynak YÖK: eşleşen okulların adı ve bölümleri güncellenir, eşleşmeyen YÖK okulları eklenir,
// YÖK listesinde olmayan Türkiye okulları (kapanmış, eski adı) gizlenir.
const YOK_URL = 'https://yokatlas.yok.gov.tr/api/tercih-kilavuz/search';
const PAGE_SIZE = 5000;

interface YokProgram {
  universiteId: number;
  universiteAdi: string; // "ABDULLAH GÜL ÜNİVERSİTESİ (KAYSERİ)"
  uniIlAdi: string | null;
  birimGrupAdi: string; // bölüm: "Bilgisayar Mühendisliği" (dil/burs eki olmadan)
  birimTuruAdi: string; // "LISANS" | "ÖNLISANS"
}

// Yurt dışındaki YÖK'e bağlı okullar: parantez içindeki yere göre ülke
const FOREIGN_COUNTRIES: [RegExp, string][] = [
  [/KKTC/, 'CY'],
  [/BOSNA/, 'BA'],
  [/KIRGIZ/, 'KG'],
  [/MAKEDONYA/, 'MK'],
  [/KAZAK/, 'KZ'],
  [/ARNAVUT/, 'AL'],
  [/AZERBAYCAN/, 'AZ'],
];

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

const tokensOf = (names: string[]) => [...new Set(normalize(names.join(' ')).split(' ').filter(Boolean))];

const fetchPrograms = async () => {
  const programs: YokProgram[] = [];
  for (let page = 0; ; page++) {
    const res = await fetch(YOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters: {}, page, size: PAGE_SIZE, sortBy: 'universiteAdi', direction: 'ASC' }),
    });
    if (!res.ok) throw new Error(`YÖK Atlas request failed (${res.status}).`);
    const data = (await res.json()) as { content: YokProgram[]; last: boolean };
    programs.push(...data.content);
    if (data.last || !data.content.length) break;
  }
  return programs;
};

type ExistingDoc = { _id: unknown; openalexId: string; name: string; names: string[]; country: string };

// YÖK adını mevcut (OpenAlex) kayıtla eşleştirir: önce birebir isim, sonra "sonu aynı" kuralı
// ("Aydın Adnan Menderes Üniversitesi" ↔ "Adnan Menderes Üniversitesi"; en az iki kelimelik isimlerle, en uzunu).
const findMatch = (key: string, candidates: ExistingDoc[], used: Set<string>) => {
  let best: { doc: ExistingDoc; length: number } | null = null;
  for (const doc of candidates) {
    if (used.has(String(doc._id))) continue;
    for (const n of [doc.name, ...doc.names].map(normalize)) {
      if (n === key) return doc;
      if (n.split(' ').length >= 2 && key.endsWith(` ${n}`) && (!best || n.length > best.length)) {
        best = { doc, length: n.length };
      }
    }
  }
  return best?.doc ?? null;
};

export const syncYok = async (log: (msg: string) => void = () => {}) => {
  const startedAt = new Date();
  const programs = await fetchPrograms();
  log(`YÖK: ${programs.length} programs`);

  // Okul bazında grupla
  // Okul bazında grupla: lisans bölümleri ve önlisans programları ayrı
  type School = { rawName: string; city: string | null; bachelor: Set<string>; associate: Set<string> };
  const schools = new Map<number, School>();
  for (const p of programs) {
    const school = schools.get(p.universiteId) ?? {
      rawName: p.universiteAdi,
      city: p.uniIlAdi,
      bachelor: new Set<string>(),
      associate: new Set<string>(),
    };
    (/^L/.test(p.birimTuruAdi) ? school.bachelor : school.associate).add(p.birimGrupAdi.trim());
    schools.set(p.universiteId, school);
  }
  const sorted = (set: Set<string>) => [...set].sort((a, b) => a.localeCompare(b, 'tr'));

  // Eşleştirmede OpenAlex kayıtları (diğer adları ve yayın sayısıyla) YÖK'ün önceki çalıştırmada eklediklerinden önce gelir
  const candidatesByCountry = new Map<string, ExistingDoc[]>();
  const candidatesFor = async (country: string) => {
    if (!candidatesByCountry.has(country)) {
      const docs = await University.find({ country }).select('openalexId name names country').lean();
      docs.sort((a, b) => Number(a.openalexId.startsWith('yok:')) - Number(b.openalexId.startsWith('yok:')));
      candidatesByCountry.set(country, docs);
    }
    return candidatesByCountry.get(country)!;
  };

  const used = new Set<string>();
  let matched = 0;
  let added = 0;
  for (const [yokId, school] of schools) {
    const place = school.rawName.match(/\(([^)]*)\)/)?.[1] ?? '';
    const foreign = !school.city || /KKTC/.test(place);
    const country = foreign ? FOREIGN_COUNTRIES.find(([re]) => re.test(place))?.[1] : 'TR';
    if (!country) {
      log(`skipped (unknown country): ${school.rawName}`);
      continue;
    }
    const plainName = school.rawName.replace(/\([^)]*\)/g, '').trim();
    const key = normalize(plainName);
    // Yurt dışındakilerde şehir parantezin ilk parçası: "(KKTC-GAZİMAĞUSA)" → Gazimağusa, "(BİŞKEK-KIRGIZİSTAN)" → Bişkek
    const city = titleCase(
      foreign ? (place.replace(/^KKTC-/, '').split('-')[0] ?? '').trim() : (school.city ?? '')
    );

    const match = findMatch(key, await candidatesFor(country), used);
    const exactName = match && [match.name, ...match.names].find((n) => normalize(n) === key);
    // Düzgün yazılmış bir isim varsa onu, yoksa YÖK'teki BÜYÜK HARFLİ adın düzeltilmiş halini kullan
    const name = exactName && /Üniversitesi|Yüksekokulu/.test(exactName) ? exactName : titleCase(plainName);
    const fields = {
      name,
      city,
      departments: sorted(school.bachelor),
      associateDepartments: sorted(school.associate),
      yokId,
      yokSyncedAt: startedAt,
      hidden: false,
    };

    if (match) {
      used.add(String(match._id));
      const names = [...new Set([match.name, ...match.names])].filter((n) => n !== name);
      await University.updateOne({ _id: match._id }, { $set: { ...fields, names, tokens: tokensOf([name, ...names]) } });
      // Okul önceki bir çalıştırmada (OpenAlex verisi henüz yokken) YÖK'ten ayrı kayıt olarak eklendiyse o kopyayı sil
      if (!match.openalexId.startsWith('yok:')) await University.deleteOne({ openalexId: `yok:${yokId}` });
      matched++;
    } else {
      await University.updateOne(
        { openalexId: `yok:${yokId}` },
        {
          $set: { ...fields, names: [], tokens: tokensOf([name]), country, countryName: countryName(country) },
          $setOnInsert: { openalexId: `yok:${yokId}`, worksCount: 0 },
        },
        { upsert: true }
      );
      added++;
    }
  }

  // YÖK listesinde olmayan Türkiye okulları: kapanmış ya da eski adıyla kalmış kayıtlar
  const { modifiedCount: hidden } = await University.updateMany(
    { country: 'TR', $or: [{ yokSyncedAt: { $exists: false } }, { yokSyncedAt: { $lt: startedAt } }] },
    { $set: { hidden: true } }
  );
  log(`YÖK: ${matched} matched, ${added} added, ${hidden} hidden`);
  return { matched, added, hidden };
};
