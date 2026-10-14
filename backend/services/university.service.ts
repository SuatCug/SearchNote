import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SyncState, University } from '../models/index.ts';
import { countryAliases, countryName } from '../utils/country.util.ts';
import { normalize } from '../utils/normalize.util.ts';
import { syncYok } from './yok.service.ts';

// Üniversite listesinin içe aktarılması ve aranması.
// Kaynak: OpenAlex (type:education, ~30 bin kurum). 200'lük sayfalarla ~150 istek; anahtarsız ve ücretsiz kotada.
// Türkiye'deki okullar ve bölümleri ayrıca YÖK Atlas'tan güncellenir (yok.service.ts).
const OPENALEX_URL = 'https://api.openalex.org/institutions';
const PAGE_SIZE = 200;
const FIELDS = 'id,ror,display_name,display_name_alternatives,display_name_acronyms,geo,works_count';
const SYNC_ID = 'openalex';
const MAX_ATTEMPTS = 6;

interface OpenAlexInstitution {
  id: string;
  ror: string | null;
  display_name: string;
  display_name_alternatives: string[] | null;
  display_name_acronyms: string[] | null;
  geo: { city: string | null; country_code: string | null } | null;
  works_count: number | null;
}

type OpenAlexPage = { meta: { count: number; next_cursor: string | null }; results: OpenAlexInstitution[] };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toUniversity = (inst: OpenAlexInstitution) => {
  const alternatives = inst.display_name_alternatives ?? [];
  const acronyms = inst.display_name_acronyms ?? [];
  const country = inst.geo?.country_code ?? '';
  // Türkiye'deki okullarda Türkçe isim (YÖK adımı ayrıca resmi adı yazar)
  const turkish = country === 'TR' ? alternatives.find((n) => /Üniversitesi$/.test(n)) : undefined;
  const name = turkish ?? inst.display_name;
  const names = [...new Set([inst.display_name, ...alternatives, ...acronyms])].filter((n) => n !== name);
  return {
    openalexId: inst.id,
    rorId: inst.ror ?? undefined,
    name,
    names,
    country,
    countryName: country ? countryName(country) : '',
    city: inst.geo?.city ?? '',
    worksCount: inst.works_count ?? 0,
    tokens: [...new Set(normalize([name, ...names].join(' ')).split(' ').filter(Boolean))],
  };
};

class PermanentError extends Error {}

// Geçici hatalarda (istek sınırı, ağ, sunucu hatası) artan beklemeyle tekrar dener
const getJson = async <T>(url: string): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (res.ok) return (await res.json()) as T;
      const message = `OpenAlex request failed (${res.status}): ${(await res.text()).slice(0, 200)}`;
      if (res.status !== 429 && res.status < 500) throw new PermanentError(message);
      if (attempt >= MAX_ATTEMPTS) throw new Error(message);
    } catch (error) {
      if (error instanceof PermanentError || attempt >= MAX_ATTEMPTS) throw error;
    }
    await sleep(15_000 * attempt);
  }
};

// Okulu olan ülkeler ve okul sayıları (tek istek)
const fetchCountryCounts = async () => {
  const data = await getJson<{ group_by: { key: string; count: number }[] }>(
    `${OPENALEX_URL}?filter=type:education&group_by=country_code&per-page=200`
  );
  return data.group_by
    .map((g) => ({ code: g.key.split('/').pop() ?? '', count: g.count }))
    .filter((g) => /^[A-Z]{2}$/.test(g.code))
    .sort((a, b) => a.code.localeCompare(b.code));
};

// Dünya listesini OpenAlex'ten çekip ekler/günceller (openalexId'ye göre upsert, tekrar çalıştırmak güvenli).
// OpenAlex anahtarsız kullanımda "cursor" ile sayfalamaya izin vermiyor ve sayfa numarasıyla en fazla 10 bin kayıt
// veriyor; bu yüzden liste ülke ülke çekilir (en büyük ülke ~4.500 okul). Toplam ~300 istek.
// İlerleme ("ülke:sayfa") her sayfadan sonra kaydedilir: `resume` ile yarım kalan aktarma kaldığı yerden devam eder.
export const syncUniversities = async (log: (msg: string) => void = () => {}, { resume = false } = {}) => {
  const state = resume ? await SyncState.findById(SYNC_ID).lean() : null;
  const [resumeCountry = '', resumePage = '1'] = state && !state.done && state.cursor.includes(':') ? state.cursor.split(':') : [];
  const countries = (await fetchCountryCounts()).filter((c) => c.code >= resumeCountry);
  let total = 0;
  for (const { code, count } of countries) {
    const pages = Math.ceil(count / PAGE_SIZE);
    for (let page = code === resumeCountry ? Number(resumePage) : 1; page <= pages; page++) {
      await SyncState.updateOne(
        { _id: SYNC_ID },
        { $set: { cursor: `${code}:${page}`, done: false, updatedAt: new Date() } },
        { upsert: true }
      );
      const data = await getJson<OpenAlexPage>(
        `${OPENALEX_URL}?filter=type:education,country_code:${code}&per-page=${PAGE_SIZE}&page=${page}&select=${FIELDS}`
      );
      if (!data.results.length) break;
      await University.bulkWrite(
        data.results.map((inst) => {
          const doc = toUniversity(inst);
          return { updateOne: { filter: { openalexId: doc.openalexId }, update: { $set: doc }, upsert: true } };
        }),
        { ordered: false }
      );
      total += data.results.length;
    }
    log(`${code}: ${count} (${total} in this run)`);
  }
  await SyncState.updateOne({ _id: SYNC_ID }, { $set: { cursor: '', done: true, updatedAt: new Date() } }, { upsert: true });
  return total;
};

const YOK_REFRESH_MS = 30 * 24 * 60 * 60 * 1000;
const RETRY_MS = 30 * 60 * 1000;
let ensuring = false;

// Sunucu açılışında, arka planda (istekleri bekletmez):
// - dünya listesi hiç aktarılmadıysa ya da yarım kaldıysa OpenAlex'ten (kaldığı yerden) aktarır,
// - ardından ya da YÖK verisi 30 günden eskiyse Türkiye okullarını ve bölümlerini YÖK Atlas'tan günceller
//   (OpenAlex adımı Türkiye okullarının adlarını eskisiyle değiştirebildiği için her zaman ondan sonra).
// Hata olursa 30 dakika sonra tekrar dener.
export const ensureUniversities = async (): Promise<void> => {
  if (ensuring) return;
  ensuring = true;
  try {
    const state = await SyncState.findById(SYNC_ID).lean();
    let runYok = false;
    if (!state?.done) {
      console.log(`🎓 ${state ? 'Resuming' : 'Starting'} university import from OpenAlex...`);
      const total = await syncUniversities((msg) => console.log(`🎓 OpenAlex ${msg}`), { resume: true });
      console.log(`🎓 OpenAlex import finished (${total} in this run).`);
      runYok = true;
    }
    if (!runYok) {
      runYok = !(await University.exists({ yokSyncedAt: { $gt: new Date(Date.now() - YOK_REFRESH_MS) } }));
    }
    if (runYok) {
      console.log('🎓 Updating Turkish universities and departments from YÖK Atlas...');
      await syncYok((msg) => console.log(`🎓 ${msg}`));
    }
    countriesCache = null;
  } catch (error) {
    console.error('❌ University import failed, retrying in 30 minutes:', (error as Error).message);
    setTimeout(() => void ensureUniversities(), RETRY_MS);
  } finally {
    ensuring = false;
  }
};

type Candidate = { name: string; names: string[]; tokens: string[]; country: string; worksCount: number };

// Sıralama (küçük = üstte), eşitlerde bilinen (çok yayını olan) okul önde:
// 0: adı ya da bir kısaltması birebir yazılan ("mit" → MIT, "odtu" → ODTÜ)
// 1: yazılan her kelime tam kelime olarak geçen ("oxford" → University of Oxford, "koç" → Koç Üniversitesi)
// 2: sadece kelime başlarıyla eşleşen ("harv" → Harvard, "koç" → Kocaeli)
const scoreMatch = (u: Candidate, q: string, words: string[]) => {
  if (normalize(u.name) === q || u.names.some((n) => normalize(n) === q)) return 0;
  return words.every((w) => u.tokens.includes(w)) ? 1 : 2;
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

// Ülke seçici: okulu olan ülkeler, okul sayıları ve aramada kullanılacak diğer adları ("Almanya", "Turkey").
// Liste sadece içe aktarmayla değişir; kısa süre bellekte tutulur.
type CountryItem = { code: string; name: string; aliases: string[]; count: number };
let countriesCache: { at: number; list: CountryItem[] } | null = null;
const COUNTRIES_TTL = 10 * 60 * 1000;

export const listCountries = async () => {
  if (countriesCache && Date.now() - countriesCache.at < COUNTRIES_TTL) return countriesCache.list;
  const groups = await University.aggregate<{ _id: string; count: number }>([
    { $match: { country: { $ne: '' }, hidden: { $ne: true } } },
    { $group: { _id: '$country', count: { $sum: 1 } } },
  ]);
  const list = groups
    .map((g) => ({ code: g._id, name: countryName(g._id), aliases: countryAliases(g._id), count: g.count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  countriesCache = { at: Date.now(), list };
  return list;
};

// Bölüm listeleri:
// - Türkiye'deki (YÖK'teki) okul: o okulun lisans bölümleri + önlisans programları
// - Türkiye'de listede olmayan okul: Türkiye'nin klasik lisans bölümleri (en az 5 üniversitede okutulanlar, YÖK)
// - Diğer ülkeler: klasik İngilizce bölüm listesi
const readList = (file: string): string[] =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, '..', 'data', file), 'utf8'));
const DEPARTMENTS_TR = readList('departments-tr.json');
const DEPARTMENTS_EN = readList('departments-en.json');

export const listDepartments = async (universityId: string | null, country: string | null) => {
  const university = universityId
    ? await University.findById(universityId).select('departments associateDepartments country').lean()
    : null;
  if (university && (university.departments?.length || university.associateDepartments?.length)) {
    return {
      source: 'university' as const,
      departments: university.departments ?? [],
      associateDepartments: university.associateDepartments ?? [],
    };
  }
  if ((university?.country ?? country) === 'TR') {
    return { source: 'country' as const, departments: DEPARTMENTS_TR, associateDepartments: [] };
  }
  return { source: 'general' as const, departments: DEPARTMENTS_EN, associateDepartments: [] };
};
