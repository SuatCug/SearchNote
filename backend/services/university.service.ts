import { University } from '../models/index.ts';

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

// Türkçe karakter ve büyük/küçük harf duyarsız karşılaştırma: "bogazici" → "Boğaziçi", "ODTU" → "ODTÜ"
export const normalize = (text: string) =>
  text
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

// Sunucu açılışında: liste boşsa (ilk kurulum) arka planda içe aktarır. İstekleri bekletmez.
export const ensureUniversities = async () => {
  try {
    if ((await University.estimatedDocumentCount()) > 0) return;
    console.log('🎓 University list is empty, importing from OpenAlex...');
    const total = await syncUniversities();
    console.log(`🎓 Imported ${total} universities.`);
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
// ("is tek" → İstanbul Teknik, "hacet" → Hacettepe). Aynı puandakilerde kullanıcının ülkesi, sonra bilinen okullar önde.
export const searchUniversities = async (query: string, homeCountry: string, limit: number) => {
  const q = normalize(query).slice(0, 100);
  const words = q.split(' ').filter(Boolean).slice(0, 6);
  if (!words.length) return [];
  const candidates = await University.find({ $and: words.map((w) => ({ tokens: { $regex: `^${w}` } })) })
    .select('name names tokens country countryName city worksCount')
    .sort({ worksCount: -1 })
    .limit(MAX_CANDIDATES)
    .lean();
  return candidates
    .map((u) => ({ u, s: scoreMatch(u, q, words), home: u.country === homeCountry ? 0 : 1 }))
    .sort((a, b) => a.s - b.s || a.home - b.home || b.u.worksCount - a.u.worksCount)
    .slice(0, limit)
    .map(({ u }) => u);
};
