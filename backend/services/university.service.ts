import { readFileSync } from 'node:fs';
import path from 'node:path';
import { University } from '../models/index.ts';
import { normalize } from '../utils/normalize.util.ts';
import { syncYok } from './yok.service.ts';

// Üniversite listesinin içe aktarılması ve aranması.
// Kaynak: OpenAlex (type:education, ~30 bin kurum). 200'lük sayfalarla ~150 istek; anahtarsız ve ücretsiz kotada.
const OPENALEX_URL = 'https://api.openalex.org/institutions';
const PAGE_SIZE = 200;
const FIELDS = 'id,ror,display_name,display_name_alternatives,display_name_acronyms,geo,works_count';

interface OpenAlexInstitution {
  id: string;
  ror: string | null;
  display_name: string;
  display_name_alternatives: string[] | null;
  display_name_acronyms: string[] | null;
  geo: { city: string | null; country_code: string | null; country: string | null } | null;
  works_count: number | null;
}

const toUniversity = (inst: OpenAlexInstitution) => {
  const alternatives = inst.display_name_alternatives ?? [];
  const acronyms = inst.display_name_acronyms ?? [];
  const country = inst.geo?.country_code ?? '';
  // Türkiye'deki okullarda Türkçe isim (kullanıcılar zaten "... Üniversitesi" diye yazıyor)
  const turkish = country === 'TR' ? alternatives.find((n) => /Üniversitesi$/.test(n)) : undefined;
  const name = turkish ?? inst.display_name;
  const names = [...new Set([inst.display_name, ...alternatives, ...acronyms])].filter((n) => n !== name);
  return {
    openalexId: inst.id,
    rorId: inst.ror ?? undefined,
    name,
    names,
    country,
    countryName: country === 'TR' ? 'Türkiye' : (inst.geo?.country ?? ''),
    city: inst.geo?.city ?? '',
    worksCount: inst.works_count ?? 0,
    tokens: [...new Set(normalize([name, ...names].join(' ')).split(' ').filter(Boolean))],
  };
};

// Tüm listeyi OpenAlex'ten çekip ekler/günceller (openalexId'ye göre upsert, tekrar çalıştırmak güvenli).
export const syncUniversities = async (log: (msg: string) => void = () => {}) => {
  let cursor = '*';
  let total = 0;
  while (cursor) {
    const url = `${OPENALEX_URL}?filter=type:education&per-page=${PAGE_SIZE}&select=${FIELDS}&cursor=${encodeURIComponent(cursor)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OpenAlex request failed (${res.status}).`);
    const page = (await res.json()) as { meta: { count: number; next_cursor: string | null }; results: OpenAlexInstitution[] };
    if (!page.results.length) break;
    await University.bulkWrite(
      page.results.map((inst) => {
        const doc = toUniversity(inst);
        return { updateOne: { filter: { openalexId: doc.openalexId }, update: { $set: doc }, upsert: true } };
      }),
      { ordered: false }
    );
    total += page.results.length;
    log(`${total} / ${page.meta.count}`);
    cursor = page.meta.next_cursor ?? '';
  }
  return total;
};

const YOK_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

// Sunucu açılışında, arka planda (istekleri bekletmez):
// - liste boşsa (ilk kurulum) OpenAlex'ten dünya listesini içe aktarır,
// - YÖK verisi hiç yoksa ya da 30 günden eskiyse Türkiye okullarını ve bölümlerini YÖK Atlas'tan günceller.
export const ensureUniversities = async () => {
  try {
    if ((await University.estimatedDocumentCount()) === 0) {
      console.log('🎓 University list is empty, importing from OpenAlex...');
      const total = await syncUniversities();
      console.log(`🎓 Imported ${total} universities.`);
    }
    const fresh = await University.exists({ yokSyncedAt: { $gt: new Date(Date.now() - YOK_REFRESH_MS) } });
    if (!fresh) {
      console.log('🎓 Updating Turkish universities and departments from YÖK Atlas...');
      await syncYok((msg) => console.log(`🎓 ${msg}`));
    }
  } catch (error) {
    console.error('❌ University import failed:', (error as Error).message);
  }
};

type Candidate = { name: string; names: string[]; tokens: string[]; country: string; worksCount: number };

// Sıralama (küçük = üstte): adı yazılan kelimeyle tam başlayan ya da bir ismi/kısaltması birebir aynı olan >
// adı yazılanla başlayan > bir kelimesi tam eşleşen > sadece kelime başlarıyla eşleşen.
// "koç" → Koç Üniversitesi, Kocaeli'nin önünde; "mit" → Massachusetts Institute of Technology (kısaltması MIT).
const scoreMatch = (u: Candidate, q: string, words: string[]) => {
  const name = `${normalize(u.name)} `;
  if (name.startsWith(`${q} `) || u.names.some((n) => normalize(n) === q)) return 0;
  if (name.startsWith(q)) return 1;
  return words.some((w) => u.tokens.includes(w)) ? 2 : 3;
};

const MAX_CANDIDATES = 300;

// Kelime başı araması: her kelime, okulun isimlerinden birindeki bir kelimenin başıyla eşleşmeli
// ("is tek" → İstanbul Teknik, "hacet" → Hacettepe). `country` verilirse sadece o ülkede aranır.
// Aynı puandakilerde bilinen (çok yayını olan) okullar önde.
export const searchUniversities = async (query: string, country: string | null, limit: number) => {
  const q = normalize(query).slice(0, 100);
  const words = q.split(' ').filter(Boolean).slice(0, 6);
  if (!words.length) return [];
  const candidates = await University.find({
    hidden: { $ne: true },
    ...(country ? { country } : {}),
    $and: words.map((w) => ({ tokens: { $regex: `^${w}` } })),
  })
    .select('name names tokens country countryName city worksCount')
    .sort({ worksCount: -1 })
    .limit(MAX_CANDIDATES)
    .lean();
  return candidates
    .map((u) => ({ u, s: scoreMatch(u, q, words) }))
    .sort((a, b) => a.s - b.s || b.u.worksCount - a.u.worksCount)
    .slice(0, limit)
    .map(({ u }) => u);
};

// Ülke seçici: okulu olan ülkeler ve okul sayıları. Liste sadece içe aktarmayla değiştiği için bellekte tutulur.
let countriesCache: { at: number; list: { code: string; name: string; count: number }[] } | null = null;
const COUNTRIES_TTL = 6 * 60 * 60 * 1000;

export const listCountries = async () => {
  if (countriesCache && Date.now() - countriesCache.at < COUNTRIES_TTL) return countriesCache.list;
  const groups = await University.aggregate<{ _id: string; name: string; count: number }>([
    { $match: { country: { $ne: '' }, hidden: { $ne: true } } },
    { $group: { _id: '$country', name: { $first: '$countryName' }, count: { $sum: 1 } } },
  ]);
  const list = groups
    .map((g) => ({ code: g._id, name: g.name || g._id, count: g.count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  // İçe aktarma sürerken (liste eksikken) önbelleğe alma
  if (list.length > 100) countriesCache = { at: Date.now(), list };
  return list;
};

// Bölüm listesi: okulun YÖK'teki bölümleri; yoksa Türkiye için tüm YÖK bölüm adları, diğer ülkeler için
// genel İngilizce alan listesi (ABD Eğitim Bakanlığı CIP 2020, kamu malı; data/fields-of-study.json).
// Listeler birkaç yüz/bin satır: hepsi bir kerede gönderilir, arama uygulamada yapılır.
const FIELDS_OF_STUDY: string[] = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '..', 'data', 'fields-of-study.json'), 'utf8')
);
let turkishDepartmentsCache: { at: number; list: string[] } | null = null;

const allTurkishDepartments = async () => {
  if (turkishDepartmentsCache && Date.now() - turkishDepartmentsCache.at < COUNTRIES_TTL) return turkishDepartmentsCache.list;
  const list = ((await University.distinct('departments', { country: 'TR' })) as string[]).sort((a, b) =>
    a.localeCompare(b, 'tr')
  );
  if (list.length) turkishDepartmentsCache = { at: Date.now(), list };
  return list;
};

export const listDepartments = async (universityId: string | null, country: string | null) => {
  const university = universityId
    ? await University.findById(universityId).select('departments country').lean()
    : null;
  if (university?.departments.length) return { source: 'university' as const, departments: university.departments };
  if ((university?.country ?? country) === 'TR') {
    const departments = await allTurkishDepartments();
    if (departments.length) return { source: 'country' as const, departments };
  }
  return { source: 'general' as const, departments: FIELDS_OF_STUDY };
};
