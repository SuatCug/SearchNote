import mongoose from 'mongoose';
import { extractText } from 'unpdf';
import mammoth from 'mammoth';
import { Note, NoteChunk, QuizAttempt, StudySet, User } from '../models/index.ts';
import { readNoteFile } from './storage.service.ts';
import { visibleNotesMatch } from './note.service.ts';
import { canOcr, transcribeFile, OCR_MAX_PAGES } from './ai.service.ts';
import { getExtension } from '../utils/fileTypes.util.ts';
import { containsRegex } from '../utils/regex.util.ts';

// Not içeriği araması: yüklenen dosyanın metni sayfa sayfa çıkarılır, parçalara bölünür ve NoteChunk
// koleksiyonuna yazılır. Arama, MongoDB metin indeksiyle (Türkçe kök bulma) ve VOYAGE_API_KEY tanımlıysa
// ek olarak Atlas Vector Search ile (anlamsal arama) yapılır; iki sonuç listesi birleştirilir.
//
// İndeksleme arka planda, tek tek sırayla yapılır (sunucu belleği küçük). Not yüklenince sıraya girer;
// sunucu açılışında da henüz indekslenmemiş eski notlar sıraya alınır.

const CHUNK_MAX_CHARS = 1500;
const CHUNK_MIN_CHARS = 20;
// Sayfa başına ortalama bundan az karakter çıkarsa PDF taranmış (resim) kabul edilir.
const SCANNED_CHARS_PER_PAGE = 40;
// Claude'a gönderilebilecek en büyük dosyalar (base64 ile büyür; istek sınırı 32 MB, görsel sınırı 5 MB).
const OCR_MAX_PDF_BYTES = 20 * 1024 * 1024;
const OCR_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// ---------- Dil tespiti ----------

const TURKISH_HINT = /[çğışöüÇĞİŞÖÜ]|\b(ve|bir|bu|için|ile|olarak|olan|nedir|nasıl|değer|veya)\b/gi;
const ENGLISH_HINT = /\b(the|and|of|is|are|for|with|what|how|which|this|that)\b/gi;

const detectLang = (text: string) => {
  const sample = text.slice(0, 4000);
  const tr = sample.match(TURKISH_HINT)?.length ?? 0;
  const en = sample.match(ENGLISH_HINT)?.length ?? 0;
  return en > tr * 1.5 ? 'english' : 'turkish';
};

// ---------- Metin çıkarma ----------

interface PageText {
  page: number | null;
  text: string;
}

const cleanText = (text: string) =>
  text
    .replace(/\u0000/g, '')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

type Extraction = { status: 'ready' | 'empty' | 'unsupported'; pages: PageText[]; pageCount?: number; ocr?: boolean };

const extractPages = async (buffer: Buffer, ext: string): Promise<Extraction> => {
  if (ext === '.pdf') {
    const { totalPages, text } = await extractText(new Uint8Array(buffer), { mergePages: false });
    const pages = text.map((t, i) => ({ page: i + 1, text: cleanText(t) }));
    const chars = pages.reduce((sum, p) => sum + p.text.length, 0);
    const scanned = chars < SCANNED_CHARS_PER_PAGE * Math.min(totalPages, OCR_MAX_PAGES);
    if (scanned && canOcr() && buffer.length <= OCR_MAX_PDF_BYTES) {
      const ocrPages = await transcribeFile(buffer, 'application/pdf');
      return {
        status: 'ready',
        pages: ocrPages.map((p) => ({ page: p.page, text: cleanText(p.text) })),
        pageCount: totalPages,
        ocr: true,
      };
    }
    return { status: 'ready', pages, pageCount: totalPages };
  }

  if (ext === '.docx') {
    const { value } = await mammoth.extractRawText({ buffer });
    return { status: 'ready', pages: [{ page: null, text: cleanText(value) }] };
  }

  if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
    if (!canOcr() || buffer.length > OCR_MAX_IMAGE_BYTES) return { status: 'unsupported', pages: [] };
    const ocrPages = await transcribeFile(buffer, ext === '.png' ? 'image/png' : 'image/jpeg');
    return {
      status: 'ready',
      pages: [{ page: 1, text: cleanText(ocrPages.map((p) => p.text).join('\n\n')) }],
      pageCount: 1,
      ocr: true,
    };
  }

  // ZIP / RAR içeriği okunmaz.
  return { status: 'unsupported', pages: [] };
};

// Uzun bir sayfayı paragraf / cümle sınırlarından bölerek CHUNK_MAX_CHARS'ı aşmayan parçalara ayırır.
const splitText = (text: string) => {
  const pieces: string[] = [];
  let current = '';
  const units = text.split(/(?<=[.!?:;])\s+|\n+/);
  for (const unit of units) {
    if (!unit.trim()) continue;
    if (current && current.length + unit.length + 1 > CHUNK_MAX_CHARS) {
      pieces.push(current);
      current = '';
    }
    // Tek başına çok uzun bir birim (noktalama olmayan metin) sert biçimde kesilir.
    let rest = unit;
    while (rest.length > CHUNK_MAX_CHARS) {
      pieces.push(rest.slice(0, CHUNK_MAX_CHARS));
      rest = rest.slice(CHUNK_MAX_CHARS);
    }
    current = current ? `${current} ${rest}` : rest;
  }
  if (current) pieces.push(current);
  return pieces.filter((p) => p.trim().length >= CHUNK_MIN_CHARS);
};

// ---------- Anlamsal arama (isteğe bağlı, Voyage AI) ----------

const VOYAGE_KEY = process.env.VOYAGE_API_KEY;
// voyage-4: hesap başına ilk 200M token ücretsiz (voyage-3.5'te ücretsiz kota yok); varsayılan boyutu 1024.
// Model değiştirilirse eski vektörlerle karışmasın diye tüm parçalar yeniden işlenmelidir.
const VOYAGE_MODEL = process.env.VOYAGE_MODEL || 'voyage-4';
const EMBEDDING_DIMENSIONS = 1024;
const VECTOR_INDEX = 'chunk_embedding';
const isVectorEnabled = () => Boolean(VOYAGE_KEY);
// Anlamsal aramada bu benzerlik skorunun (Atlas vectorSearchScore, 0–1) altındaki parçalar alakasız sayılır:
// en yakın komşu araması her soruya bir şey döndürdüğü için eşik olmadan rastgele sorularda da sonuç gelirdi.
// 2026-11-14 ölçümü (voyage-4, 215 parça): alakasız sorularda en yüksek skor 0.59–0.66, alakalılarda 0.70–0.84.
const VECTOR_MIN_SCORE = Number(process.env.VECTOR_MIN_SCORE) || 0.68;

const embedTexts = async (texts: string[], inputType: 'document' | 'query') => {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += 64) {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOYAGE_KEY}` },
      body: JSON.stringify({ input: texts.slice(i, i + 64), model: VOYAGE_MODEL, input_type: inputType }),
    });
    if (!res.ok) throw new Error(`Voyage embeddings failed (${res.status}): ${await res.text()}`);
    const body = (await res.json()) as { data: { embedding: number[]; index: number }[] };
    body.data.sort((a, b) => a.index - b.index).forEach((d) => vectors.push(d.embedding));
  }
  return vectors;
};

// Atlas Vector Search indeksi yoksa oluşturur (Atlas dışındaki MongoDB'lerde sessizce atlanır).
const ensureVectorIndex = async () => {
  if (!isVectorEnabled()) return;
  try {
    const existing = await NoteChunk.collection.listSearchIndexes(VECTOR_INDEX).toArray();
    if (existing.length) return;
    await NoteChunk.collection.createSearchIndex({
      name: VECTOR_INDEX,
      type: 'vectorSearch',
      definition: {
        fields: [
          { type: 'vector', path: 'embedding', numDimensions: EMBEDDING_DIMENSIONS, similarity: 'cosine' },
          { type: 'filter', path: 'note' },
        ],
      },
    });
    console.log('🧭 Atlas Vector Search index created:', VECTOR_INDEX);
  } catch (error) {
    console.error('Vector index could not be created:', (error as Error).message);
  }
};

// Vektörü olmayan parçaları arka planda işler: açılışta (anahtar sonradan eklendiyse) ve her not indekslendikten
// sonra. Aynı anda tek çalışma olur; çalışırken yeni parça eklenirse bitince tekrar bakılır.
let backfillRunning: Promise<void> | null = null;
let backfillAgain = false;
const backfillEmbeddings = (): Promise<void> => {
  if (!isVectorEnabled()) return Promise.resolve();
  if (backfillRunning) {
    backfillAgain = true;
    return backfillRunning;
  }
  backfillRunning = (async () => {
    try {
      do {
        backfillAgain = false;
        await embedMissingChunks();
      } while (backfillAgain);
    } finally {
      backfillRunning = null;
    }
  })();
  return backfillRunning;
};

const embedMissingChunks = async () => {
  // Ödeme yöntemi eklenmemiş Voyage hesabı dakikada 3 istek / 10K token ile sınırlı: küçük gruplar, 429'da bekleyip tekrar.
  const BATCH = 16;
  let done = 0;
  let retries = 0;
  for (;;) {
    const chunks = await NoteChunk.find({ embedding: { $exists: false } }).select('text').limit(BATCH).lean();
    if (!chunks.length) break;
    let vectors: number[][];
    try {
      vectors = await embedTexts(chunks.map((c) => c.text), 'document');
      retries = 0;
    } catch (error) {
      if (!String((error as Error).message).includes('(429)') || ++retries > 10) throw error;
      await new Promise((r) => setTimeout(r, 30_000));
      continue;
    }
    await NoteChunk.bulkWrite(
      chunks.map((c, i) => ({ updateOne: { filter: { _id: c._id }, update: { $set: { embedding: vectors[i] } } } }))
    );
    done += chunks.length;
  }
  if (done) console.log(`🧭 ${done} chunk(s) embedded for semantic search.`);
};

// ---------- İndeksleme sırası ----------

const queue: string[] = [];
let running = false;

const indexNote = async (noteId: string) => {
  const note = await Note.findById(noteId).select('+fileUrl');
  if (!note) return;
  await Note.updateOne({ _id: noteId }, { $set: { 'ai.status': 'processing' } });

  try {
    const buffer = await readNoteFile(note.fileUrl);
    if (!buffer) throw new Error('File not found in storage.');
    const extraction = await extractPages(buffer, getExtension(note.fileUrl));

    let order = 0;
    const chunks = extraction.pages.flatMap((p) =>
      splitText(p.text).map((text) => ({ note: note._id, page: p.page, order: order++, text, lang: detectLang(text) }))
    );

    await NoteChunk.deleteMany({ note: note._id });
    // Not bu sırada silindiyse parçalar sahipsiz kalmasın.
    if (!(await Note.exists({ _id: note._id }))) return;
    if (chunks.length) await NoteChunk.insertMany(chunks);

    const status = extraction.status === 'ready' && !chunks.length ? 'empty' : extraction.status;
    await Note.updateOne(
      { _id: note._id },
      {
        $set: {
          ai: {
            status,
            pages: extraction.pageCount ?? undefined,
            ocr: extraction.ocr ?? false,
            indexedAt: new Date(),
          },
        },
      }
    );
    console.log(`📚 Indexed note ${noteId}: ${status}, ${chunks.length} chunks${extraction.ocr ? ' (OCR)' : ''}`);
    // Anlamsal arama vektörleri arka planda, Voyage hız sınırına uygun küçük gruplarla eklenir. Not bu arada
    // kelime aramasıyla bulunabilir ve çalışma araçları kullanılabilir (status zaten ready).
    if (chunks.length) void backfillEmbeddings().catch((e) => console.error('Embedding backfill error:', (e as Error).message));
  } catch (error) {
    console.error(`Indexing failed for note ${noteId}:`, (error as Error).message);
    await Note.updateOne({ _id: noteId }, { $set: { 'ai.status': 'failed', 'ai.indexedAt': new Date() } });
  }
};

const drain = async () => {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const id = queue.shift()!;
      await indexNote(id);
    }
  } finally {
    running = false;
  }
};

const enqueueNoteIndex = async (noteId: string | mongoose.Types.ObjectId) => {
  const id = String(noteId);
  await Note.updateOne({ _id: id }, { $set: { 'ai.status': 'pending' } });
  if (!queue.includes(id)) queue.push(id);
  void drain();
};

// Sunucu açılışı: hiç indekslenmemiş notlar ve yarıda kalanlar (sunucu yeniden başladı) sıraya alınır.
const resumePendingIndexing = async () => {
  if (String(process.env.AI_INDEX_ON_START || 'true').toLowerCase() === 'false') return;
  await ensureVectorIndex();
  // Arka planda: bekleyen notların indekslenmesi vektör tamamlamayı beklemez.
  void backfillEmbeddings().catch((e) => console.error('Embedding backfill error:', (e as Error).message));
  const conditions: Record<string, unknown>[] = [
    { 'ai.status': { $exists: false } },
    { 'ai.status': { $in: ['pending', 'processing'] } },
  ];
  // Yapay zekâ anahtarı sonradan eklendiyse: daha önce metni okunamayan taranmış PDF / fotoğraflar tekrar denenir.
  if (canOcr()) {
    conditions.push({ 'ai.status': { $in: ['empty', 'unsupported'] }, fileType: { $in: ['pdf', 'image'] }, 'ai.ocr': { $ne: true } });
  }
  const ids = await Note.find({ $or: conditions })
    .sort({ createdAt: -1 })
    .distinct('_id');
  if (!ids.length) return;
  console.log(`📚 ${ids.length} note(s) queued for content indexing.`);
  for (const id of ids) {
    const key = String(id);
    if (!queue.includes(key)) queue.push(key);
  }
  void drain();
};

// Not(lar) silinince içerik parçaları ve çalışma setleri de silinir.
const removeNoteAiData = async (noteIds: (string | mongoose.Types.ObjectId)[]) => {
  if (!noteIds.length) return;
  await Promise.all([
    NoteChunk.deleteMany({ note: { $in: noteIds } }),
    StudySet.deleteMany({ note: { $in: noteIds } }),
    QuizAttempt.deleteMany({ note: { $in: noteIds } }),
  ]);
};

// ---------- Arama ----------

// Soru kalıpları aramada gürültü yapar ("nedir", "what is" ...): metin aramasından çıkarılır.
const QUESTION_WORDS = new Set(
  'nedir ne neler nasıl neden niçin niye hangi hangisi kaç mi mı mu mü midir mıdır mudur müdür açıkla anlat örnek ' +
    'what is are how why which when explain define does do the a an of'.split(' ')
);

const searchTerms = (query: string) =>
  query
    .toLocaleLowerCase('tr')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !QUESTION_WORDS.has(w));

interface RawHit {
  _id: mongoose.Types.ObjectId;
  note: mongoose.Types.ObjectId;
  page: number | null;
  text: string;
}

// Notlar Türkçe ya da İngilizce olabilir ve soru başka dilde sorulabilir ("Thevenin eşdeğeri" -> İngilizce not):
// sorgu iki dilin kök bulma kurallarıyla ayrı ayrı aranır, sonuçlar birleştirilir.
// scope: sadece bu notların içinde ara (tek not ya da ders filtresi).
type Scope = mongoose.Types.ObjectId[] | undefined;

const textSearch = async (query: string, language: 'turkish' | 'english', scope: Scope): Promise<RawHit[]> => {
  const terms = searchTerms(query);
  if (!terms.length) return [];
  return NoteChunk.aggregate([
    {
      $match: {
        $text: { $search: terms.join(' '), $language: language },
        ...(scope && { note: { $in: scope } }),
      },
    },
    { $sort: { score: { $meta: 'textScore' } } },
    { $limit: 150 },
    { $project: { note: 1, page: 1, text: 1 } },
  ]);
};

const vectorSearch = async (query: string, scope: Scope): Promise<RawHit[]> => {
  if (!isVectorEnabled()) return [];
  try {
    const [vector] = await embedTexts([query], 'query');
    return await NoteChunk.aggregate([
      {
        $vectorSearch: {
          index: VECTOR_INDEX,
          path: 'embedding',
          queryVector: vector,
          numCandidates: 300,
          limit: 60,
          ...(scope && { filter: { note: { $in: scope } } }),
        },
      },
      { $project: { note: 1, page: 1, text: 1, score: { $meta: 'vectorSearchScore' } } },
      { $match: { score: { $gte: VECTOR_MIN_SCORE } } },
      { $project: { score: 0 } },
    ]);
  } catch (error) {
    console.error('Vector search error:', (error as Error).message);
    return [];
  }
};

// İki sıralı listeyi birleştirir (Reciprocal Rank Fusion): iki aramada da üstte çıkan parça öne geçer.
const fuseResults = (lists: RawHit[][]) => {
  const scores = new Map<string, { hit: RawHit; score: number }>();
  for (const list of lists) {
    list.forEach((hit, rank) => {
      const key = String(hit._id);
      const entry = scores.get(key) ?? { hit, score: 0 };
      entry.score += 1 / (60 + rank);
      scores.set(key, entry);
    });
  }
  return [...scores.values()].sort((a, b) => b.score - a.score).map((e) => e.hit);
};

// ---------- Ders adıyla / koduyla arama ----------
// "calculus 2 örnek soruları" gibi sorgularda ders adı notun metninde geçmez (sadece notun ders bilgisindedir).
// Sorgu bir dersin adını (tüm kelimeleriyle) ya da kodunu içeriyorsa o dersin notları sonuçlarda öne alınır.

// Küçük harf, Türkçe karakterler sadeleşir; romen rakamları sayıya çevrilir ("Calculus II" = "calculus 2").
const ROMAN: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4' };
const foldTokens = (value: string) =>
  value
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((t) => ROMAN[t] ?? t);

const COURSE_NOTE_LIMIT = 20;

// Aday notlar: ders adında / kodunda metnin bir kelimesi geçen, indekslenmiş notlar; kesin eşleşmeyi `accept` söyler.
const findCourseNotes = async (
  text: string,
  minTermLength: number,
  accept: (code: string, nameTokens: string[]) => boolean
) => {
  const terms = searchTerms(text).filter((t) => t.length >= minTermLength);
  if (!terms.length) return [];
  const candidates = await Note.find({
    'ai.status': 'ready',
    $or: terms.flatMap((t) => [{ courseName: containsRegex(t) }, { courseCode: containsRegex(t) }]),
  })
    .select('courseName courseCode')
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
  return candidates
    .filter((n) => accept(foldTokens(n.courseCode ?? '').join(''), foldTokens(n.courseName ?? '')))
    .map((n) => n._id);
};

// Sorgunun içinde bir dersin adı (tüm kelimeleri) ya da kodu geçiyor mu ("calculus 2 örnek soruları").
const courseMatchedNoteIds = async (query: string) => {
  const queryTokens = foldTokens(query);
  const tokenSet = new Set(queryTokens);
  const compact = queryTokens.join('');
  const ids = await findCourseNotes(
    query,
    3,
    (code, name) => (code.length >= 4 && compact.includes(code)) || (name.length > 0 && name.every((t) => tokenSet.has(t)))
  );
  return ids.slice(0, COURSE_NOTE_LIMIT);
};

// Ders filtresi (Ask sayfasındaki "Course code or name" kutusu): kodu ya da adı tam olarak bu olan dersin notları.
// "MATH 203" = "MATH203", "Calculus II" = "calculus 2". Tam eşleşen ders yoksa adı bu kelimelerin hepsini içeren
// dersler alınır ("Calculus" -> Calculus I, Calculus 2 ...).
const courseFilterNoteIds = async (course: string) => {
  const inputTokens = foldTokens(course);
  const tokens = inputTokens.join(' ');
  const compact = inputTokens.join('');
  if (!compact) return [];
  const exact = await findCourseNotes(course, 2, (code, name) => code === compact || (name.length > 0 && name.join(' ') === tokens));
  if (exact.length) return exact;
  return findCourseNotes(course, 2, (_code, name) => inputTokens.every((t) => name.includes(t)));
};

// Ders eşleşen notların parçaları en öne alınır: içlerinde de aramayla eşleşen parçalar önce, diğerleri sayfa
// sırasıyla. Geri kalan sonuçlar ardından gelir.
const boostCourseNotes = async (fused: RawHit[], courseNoteIds: mongoose.Types.ObjectId[]) => {
  if (!courseNoteIds.length) return fused;
  const ids = new Set(courseNoteIds.map(String));
  const matched = fused.filter((h) => ids.has(String(h.note)));
  const seen = new Set(matched.map((h) => String(h._id)));
  const rest = (
    await NoteChunk.find({ note: { $in: courseNoteIds } })
      .sort({ order: 1 })
      .select('note page text')
      .limit(200)
      .lean<RawHit[]>()
  ).filter((h) => !seen.has(String(h._id)));
  return [...matched, ...rest, ...fused.filter((h) => !ids.has(String(h.note)))];
};

// Arama kelimesinin geçtiği yerin çevresinden kısa bir alıntı.
const makeSnippet = (text: string, query: string) => {
  const SIZE = 260;
  let at = -1;
  for (const term of searchTerms(query).sort((a, b) => b.length - a.length)) {
    // Kelimenin kökü (ilk 5 harf) yeterli: "dönüşümünde" -> "dönüş".
    const match = containsRegex(term.slice(0, Math.max(4, Math.min(term.length, 5)))).exec(text);
    if (match) {
      at = match.index;
      break;
    }
  }
  if (at < 0 || text.length <= SIZE) return text.length <= SIZE ? text : `${text.slice(0, SIZE).trimEnd()}…`;
  const start = Math.max(0, at - 80);
  const end = Math.min(text.length, start + SIZE);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
};

export interface ContentHit {
  chunkId: string;
  page: number | null;
  text: string;
  snippet: string;
  note: {
    _id: string;
    title: string;
    courseCode?: string;
    courseName: string;
    fileType: string;
    author: { _id: string; fullName: string; avatarUrl?: string } | null;
  };
}

interface SearchOptions {
  query: string;
  viewerId: string;
  // Sadece bu notun içinde ara (görünürlüğü çağıran kontrol eder).
  noteId?: string;
  courseCode?: string;
  limit?: number;
  perNote?: number;
}

const searchNotesContent = async ({ query, viewerId, noteId, courseCode, limit = 8, perNote = 2 }: SearchOptions) => {
  const primary = detectLang(query);
  const secondary = primary === 'turkish' ? 'english' : 'turkish';
  // Ders filtresi verildiyse arama o dersin notlarıyla sınırlanır (dersin notu yoksa sonuç da yoktur).
  const filterIds = !noteId && courseCode ? await courseFilterNoteIds(courseCode) : undefined;
  if (filterIds && !filterIds.length) return [];
  const scope = noteId ? [new mongoose.Types.ObjectId(noteId)] : filterIds;
  const [lists, courseNoteIds] = await Promise.all([
    Promise.all([textSearch(query, primary, scope), textSearch(query, secondary, scope), vectorSearch(query, scope)]),
    // Öne alınacak ders notları: filtre varsa filtredeki ders (metinde kelime eşleşmesi olmasa da o dersin sayfaları
    // gelir: "örnek soru" İngilizce bir notta geçmez), yoksa sorguda adı / kodu geçen ders. Tek not içinde gerekmez.
    noteId ? Promise.resolve([]) : filterIds ?? courseMatchedNoteIds(query),
  ]);
  const fused = await boostCourseNotes(fuseResults(lists), courseNoteIds);
  if (!fused.length) return [];

  // Sadece izleyicinin görebileceği notlar (grup notları genel aramada çıkmaz; tek not içinde aramada izin
  // kontrolü önceden yapılmıştır).
  const noteIds = [...new Set(fused.map((h) => String(h.note)))];
  let visibility = {};
  if (!noteId) {
    const viewer = await User.findById(viewerId).select('following').lean();
    // Ders filtresi yukarıda scope ile uygulandı.
    visibility = visibleNotesMatch(viewerId, viewer?.following);
  }
  const notes = await Note.find({ _id: { $in: noteIds }, ...visibility })
    .select('title courseCode courseName fileType author')
    .populate('author', 'fullName avatarUrl')
    .lean();
  const notesById = new Map(notes.map((n) => [String(n._id), n]));

  const perNoteCount = new Map<string, number>();
  const hits: ContentHit[] = [];
  for (const hit of fused) {
    const note = notesById.get(String(hit.note));
    if (!note) continue;
    const count = perNoteCount.get(String(note._id)) ?? 0;
    if (count >= perNote) continue;
    perNoteCount.set(String(note._id), count + 1);
    const author = note.author as unknown as { _id: mongoose.Types.ObjectId; fullName: string; avatarUrl?: string } | null;
    hits.push({
      chunkId: String(hit._id),
      page: hit.page,
      text: hit.text,
      snippet: makeSnippet(hit.text, query),
      note: {
        _id: String(note._id),
        title: note.title,
        courseCode: note.courseCode ?? undefined,
        courseName: note.courseName,
        fileType: note.fileType,
        author: author ? { _id: String(author._id), fullName: author.fullName, avatarUrl: author.avatarUrl } : null,
      },
    });
    if (hits.length >= limit) break;
  }
  return hits;
};

// Quiz / flashcard üretimi için notun tüm metni ("[Page 3]" işaretleriyle), en fazla maxChars karakter.
const loadNoteText = async (noteId: string, maxChars = 120_000) => {
  const chunks = await NoteChunk.find({ note: noteId }).sort({ order: 1 }).select('page text').lean();
  let out = '';
  let lastPage: number | null | undefined;
  for (const c of chunks) {
    const header = c.page !== lastPage && c.page !== null ? `\n\n[Page ${c.page}]\n` : '\n';
    lastPage = c.page;
    if (out.length + header.length + c.text.length > maxChars) break;
    out += header + c.text;
  }
  return out.trim();
};

export {
  enqueueNoteIndex,
  resumePendingIndexing,
  removeNoteAiData,
  searchNotesContent,
  loadNoteText,
  isVectorEnabled,
};
