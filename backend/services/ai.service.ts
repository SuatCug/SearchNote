import Anthropic from '@anthropic-ai/sdk';
import ApiError from '../utils/apiError.ts';
import { AiUsage } from '../models/index.ts';

// Claude API ile yapılan işler: notlardan soru cevaplama (kaynak sayfa gösterimiyle), quiz / flashcard üretimi
// ve taranmış (el yazısı / fotoğraf) notların metnini okuma.
// ANTHROPIC_API_KEY tanımlı değilse bu özellikler kapalıdır; içerik araması (kelime bazlı) yine çalışır.

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

// Yerel deneme modu (AI_MOCK=true): API anahtarı / kredi olmadan arayüzü denemek için Claude'a gidilmez,
// notun kendi metninden hazırlanan örnek cevap / quiz / flashcard döner. Anahtar tanımlıysa ya da
// NODE_ENV=production ise kapalıdır. Üretilen setler model: 'mock' ile kaydedilir ve gerçek modda yok sayılır.
const MOCK = !client && String(process.env.AI_MOCK).toLowerCase() === 'true' && process.env.NODE_ENV !== 'production';
if (MOCK) console.log('🧪 AI_MOCK is on: AI features return sample output (no API calls).');

const AI_MODEL = MOCK ? 'mock' : process.env.AI_MODEL || 'claude-haiku-5-5';

const isAiEnabled = () => Boolean(client) || MOCK;
const isMock = () => MOCK;
// Taranmış notları okumak gerçek API ister (deneme modunda yapılmaz).
const canOcr = () => Boolean(client);

const requireClient = () => {
  if (!client) throw new ApiError(503, 'AI features are not configured on this server.');
  return client;
};

// ---------- Günlük kullanım sınırı ----------

const limitFromEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
const DAILY_LIMITS = {
  ask: limitFromEnv('AI_DAILY_ASKS', 40),
  study: limitFromEnv('AI_DAILY_STUDY_SETS', 10),
};

// Kullanıcının bugünkü hakkından bir tane düşer; hak bittiyse 429.
const consumeQuota = async (userId: string, kind: keyof typeof DAILY_LIMITS) => {
  if (MOCK) return;
  const day = new Date().toISOString().slice(0, 10);
  const usage = await AiUsage.findOneAndUpdate(
    { user: userId, day },
    { $inc: { [kind]: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  if ((usage?.[kind] ?? 0) > DAILY_LIMITS[kind]) {
    await AiUsage.updateOne({ user: userId, day }, { $inc: { [kind]: -1 } });
    throw new ApiError(429, 'You have reached today’s AI limit. Try again tomorrow.');
  }
};

// İstek başarısız olursa harcanan hak geri verilir.
const refundQuota = async (userId: string, kind: keyof typeof DAILY_LIMITS) =>
  MOCK ||
  AiUsage.updateOne({ user: userId, day: new Date().toISOString().slice(0, 10) }, { $inc: { [kind]: -1 } });

// ---------- Ortak yardımcılar ----------

const textOf = (message: Anthropic.Message) =>
  message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

const assertCompleted = (message: Anthropic.Message) => {
  if (message.stop_reason === 'refusal') throw new ApiError(422, 'The AI declined to process this content.');
  if (message.stop_reason === 'max_tokens') throw new ApiError(502, 'The AI response was cut off. Please try again.');
};

// Akışla gelen JSON metninden, üst düzey nesnenin `key` dizisindeki elemanları tamamlandıkça çıkarır
// ({"questions":[{...},{...}], ...} → her {...} kapanınca onItem). Model şemaya uyan geçerli JSON yazdığı için
// karakter karakter derinlik / string takibi yeterlidir.
const arrayItemScanner = (key: string, onItem: (item: unknown) => void) => {
  let text = '';
  let pos = 0;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let stringStart = 0;
  let lastKey = '';
  let inArray = false;
  let itemStart = -1;
  return (delta: string) => {
    text += delta;
    for (; pos < text.length; pos++) {
      const ch = text[pos];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') {
          inString = false;
          if (depth === 1) lastKey = text.slice(stringStart + 1, pos);
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
        stringStart = pos;
      } else if (ch === '{' || ch === '[') {
        depth++;
        if (ch === '[' && depth === 2 && lastKey === key) inArray = true;
        else if (ch === '{' && inArray && depth === 3) itemStart = pos;
      } else if (ch === '}' || ch === ']') {
        if (ch === '}' && inArray && depth === 3 && itemStart >= 0) {
          try {
            onItem(JSON.parse(text.slice(itemStart, pos + 1)));
          } catch {
            // Bozuk eleman atlanır; tam cevap yine sonda ayrıştırılır.
          }
          itemStart = -1;
        } else if (ch === ']' && inArray && depth === 2) inArray = false;
        depth--;
      }
    }
  };
};

// JSON şemalı (structured output) istek: model şemaya uyan JSON döndürür.
// stream verilirse `stream.key` dizisinin her elemanı yazılır yazılmaz stream.onItem ile bildirilir.
const createJson = async <T>(params: {
  system: string;
  content: Anthropic.ContentBlockParam[];
  schema: Record<string, unknown>;
  maxTokens: number;
  effort?: 'low' | 'medium';
  stream?: { key: string; onItem: (item: unknown) => void };
}): Promise<T> => {
  const stream = requireClient().messages.stream({
    model: AI_MODEL,
    max_tokens: params.maxTokens,
    system: params.system,
    messages: [{ role: 'user', content: params.content }],
    output_config: { effort: params.effort ?? 'low', format: { type: 'json_schema', schema: params.schema } },
  });
  if (params.stream) stream.on('text', arrayItemScanner(params.stream.key, params.stream.onItem));
  const message = await stream.finalMessage();
  assertCompleted(message);
  try {
    return JSON.parse(textOf(message)) as T;
  } catch {
    throw new ApiError(502, 'The AI returned an unreadable response. Please try again.');
  }
};

// ---------- Taranmış notları okuma (OCR) ----------

const OCR_MAX_PAGES = 40;
const PAGES_SCHEMA = {
  type: 'object',
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        properties: { page: { type: 'integer' }, text: { type: 'string' } },
        required: ['page', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['pages'],
  additionalProperties: false,
};

type MediaType = 'application/pdf' | 'image/jpeg' | 'image/png';

// Metni çıkarılamayan (taranmış / el yazısı) PDF'leri ve not fotoğraflarını sayfa sayfa yazıya döker.
const transcribeFile = async (buffer: Buffer, mediaType: MediaType) => {
  const data = buffer.toString('base64');
  const source: Anthropic.ContentBlockParam =
    mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: mediaType, data } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data } };

  const result = await createJson<{ pages: { page: number; text: string }[] }>({
    system:
      'You transcribe university lecture notes (often handwritten or scanned) so they can be searched. ' +
      'Copy the readable text faithfully in its original language; do not translate, summarize or add anything. ' +
      'Write formulas in plain text (e.g. x^2 + 1, ∫ f(x) dx). Describe a diagram in one short line in square brackets only if it has labels. ' +
      'Return one entry per page (page numbers start at 1). Use an empty string for a page with no readable text.',
    content: [
      source,
      { type: 'text', text: `Transcribe this note page by page (at most the first ${OCR_MAX_PAGES} pages).` },
    ],
    schema: PAGES_SCHEMA,
    maxTokens: 64000,
  });
  return result.pages.filter((p) => Number.isInteger(p.page) && p.page > 0);
};

// ---------- Notlardan soru cevaplama ----------

export interface AnswerSource {
  title: string;
  text: string;
}

export interface AnswerSegment {
  text: string;
  // Cevabın bu kısmının dayandığı kaynakların sırası (sources dizisindeki index).
  sources: number[];
}

const ASK_SYSTEM =
  'You are SearchNote’s study assistant. Students ask questions and you answer ONLY from the numbered note excerpts ' +
  'you are given (each excerpt is a page of a student’s lecture note, numbered from 0). ' +
  'First decide whether the excerpts actually answer the question. If they do not (the question is unrelated to them, ' +
  'or they only share a word with it), set covered to false, answer to an empty string and sources to an empty list. ' +
  'Each excerpt title starts with its course code and course name. Students also search for material instead of ' +
  'asking a question (e.g. "calculus 2 example questions", "thermodynamics summary"): if excerpts from that course ' +
  'or topic contain such material, the request is covered; briefly describe what they contain (e.g. which topics ' +
  'the questions are on) and list them in sources. ' +
  'Never use outside knowledge and never invent facts. ' +
  'If they do, set covered to true and write the answer clearly and concisely (at most about 150 words), like a helpful ' +
  'classmate explaining the topic. Write every sentence in the language of the question; if the excerpts are in another ' +
  'language, translate them in your own words (technical terms may stay in parentheses). Do not paste sentences from ' +
  'the excerpts. Give the answer directly: never mention the notes, excerpts, pages, documents or their authors in the ' +
  'answer (no "according to the notes", "the notes say" or "in note X"), because the sources are listed separately ' +
  'below it. Plain text only, no Markdown; use short paragraphs. ' +
  'In sources, list the numbers of only the excerpts the answer actually relies on.';

const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    covered: { type: 'boolean' },
    answer: { type: 'string' },
    sources: { type: 'array', items: { type: 'integer' } },
  },
  required: ['covered', 'answer', 'sources'],
  additionalProperties: false,
};

// Kaynak parçalar numaralı "document" blokları olarak verilir; model JSON ile cevabı ve dayandığı parçaların
// numaralarını döndürür. (Citation özelliği kapalı: açıkken model kaynak cümleleri birebir kopyalıyordu, ayrıca
// structured output ile birlikte kullanılamıyor.)
// Notlar soruyu cevaplamıyorsa null döner.
const answerFromSources = async (question: string, sources: AnswerSource[]): Promise<AnswerSegment[] | null> => {
  if (MOCK) {
    // Deneme: ilk iki kaynağın ilk cümlesi, kaynak işaretleriyle.
    return sources.slice(0, 2).map((s, i) => ({
      text: `${i ? ' ' : '[Demo answer] '}${firstSentence(s.text)}`,
      sources: [i],
    }));
  }
  const result = await createJson<{ covered: boolean; answer: string; sources: number[] }>({
    system: ASK_SYSTEM,
    maxTokens: 4000,
    content: [
      ...sources.map(
        (s, i): Anthropic.DocumentBlockParam => ({
          type: 'document',
          source: { type: 'text', media_type: 'text/plain', data: s.text },
          title: `Excerpt ${i}: ${s.title}`,
        })
      ),
      { type: 'text', text: question },
    ],
    schema: ANSWER_SCHEMA,
  });

  const cited = [...new Set(result.sources)].filter((i) => Number.isInteger(i) && i >= 0 && i < sources.length);
  const text = result.answer.trim();
  // Notlara dayanan bir cevap en az bir kaynağa dayanır; aksi halde "notlarda yok" sayılır.
  if (!result.covered || !text || !cited.length) return null;
  return [{ text, sources: cited }];
};

// ---------- Quiz / flashcard üretimi ----------

// Sorunun kaynağı: note = notta zaten olan soru (çıkmış soru, alıştırma, örnek) çoktan seçmeliye çevrildi;
// similar = notta bulunan bir soruya benzer yeni soru (aynı beceri, farklı sayı / senaryo); concept = notun
// açıklayıcı içeriğinden üretildi. Eski setlerde yok.
export type QuizOrigin = 'note' | 'similar' | 'concept';

export interface QuizItem {
  question: string;
  origin?: QuizOrigin;
  // Modelin şıkları yazmadan önce yazdığı adım adım çözüm: cevabın doğruluğunu artırır, öğrenci de cevapladıktan
  // sonra "Show step-by-step solution" ile görür. Eski topic-quiz setlerinde yok.
  solution?: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  page: number | null;
  // Bilgi haritası için sorunun konusu (topics listesindeki adlardan biri).
  topic: string;
}

// Notun konuları ve her birinin ön koşulları (notta geçmeyen temel konular da olabilir).
export interface TopicInfo {
  name: string;
  prerequisites: string[];
}

export interface FlashcardItem {
  front: string;
  back: string;
  page: number | null;
}

// Sorular konu listesinden önce gelir: akışta ilk soru, konular yazılmadan öğrenciye gösterilebilsin.
const quizSchema = (origins: QuizOrigin[]) => ({
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        // Sıra önemli: model önce soruyu ve çözümünü yazar, şıkları ve doğru cevabı ondan sonra seçer.
        properties: {
          question: { type: 'string' },
          origin: { type: 'string', enum: origins },
          solution: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          answerIndex: { type: 'integer' },
          explanation: { type: 'string' },
          page: { type: ['integer', 'null'] },
          topic: { type: 'string' },
        },
        required: ['question', 'origin', 'solution', 'options', 'answerIndex', 'explanation', 'page', 'topic'],
        additionalProperties: false,
      },
    },
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          prerequisites: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'prerequisites'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions', 'topics'],
  additionalProperties: false,
});

const FLASHCARD_SCHEMA = {
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          front: { type: 'string' },
          back: { type: 'string' },
          page: { type: ['integer', 'null'] },
        },
        required: ['front', 'back', 'page'],
        additionalProperties: false,
      },
    },
  },
  required: ['cards'],
  additionalProperties: false,
};

// Web arayüzü formülleri KaTeX ile gösterir (MathText): yalnız \( \) ve \[ \] ayırıcıları tanınır ($ değil:
// para birimiyle karışırdı). Mobil uygulama bunları ham metin olarak gösterir.
const MATH_RULE =
  ' Write every mathematical expression (formulas, equations, integrals, fractions, powers, Greek letters) in LaTeX: ' +
  'inline between \\( and \\), e.g. \\(\\int_0^1 x^2\\,dx = \\tfrac{1}{3}\\); a long formula on its own between ' +
  '\\[ and \\], kept on a single line. Never use $ as a math delimiter. Do not use Markdown. In the JSON, ' +
  'escape each LaTeX backslash exactly once, so the text contains \\frac, not \\\\frac.';

const STUDY_SYSTEM =
  'You create exam-preparation material for university students from their lecture notes. ' +
  'Use only what is in the note; write in the same language as the note. ' +
  'Pages are marked like [Page 3]; set "page" to the page an item comes from (null if the note has no page marks). ' +
  'Prefer the important concepts, definitions, formulas and typical exam topics over trivia.' +
  MATH_RULE;

// Konu listesi ve ön koşulları (bilgi haritası); iki quiz türünde de aynı. Şemada konular sorulardan sonra
// yazılır (akışta ilk soru erken gelsin), bu yüzden konu adları önce belirlenir, liste sonda yazılır.
const TOPICS_INSTRUCTION =
  'Decide the 3-8 main topics of this note first. Topic names are short (1-3 words), general course concepts ' +
  '(e.g. "Derivatives", "AVL Trees", "Türev"), in the note’s language. Write the questions first; after them, ' +
  'in "topics", list exactly those topics (every topic a question uses) and for each give its prerequisites: ' +
  'the foundational topics a student must know first (e.g. Derivatives -> Functions, Limits). Prerequisites may be ' +
  'topics that are not in the note. ';

// Çözüm şıklardan önce yazılır (şemadaki sıra), bu yüzden şıklara değil soruya dayanır.
const SOLUTION_RULE =
  'In "solution", solve the question before writing the options, as a worked solution the student will read after ' +
  'answering: numbered steps, each on its own line ("1. ...", "2. ..."), naming the rule, formula or definition used ' +
  'and showing the intermediate results, then a last line with the final answer. Explain why, not only what; keep ' +
  'it short for simple questions. Write it in the same language as the question. ';

const QUESTION_RULES =
  'Each question has exactly 4 options with one correct answer (answerIndex is 0-3), a one or two sentence ' +
  'explanation of why the answer is correct, and "topic" set to exactly one of the topic names you decided on. ' +
  SOLUTION_RULE +
  'Then write the options so that the correct one matches your solution and the wrong ones are plausible mistakes. Vary the position of the correct answer. Options are ' +
  'shown in random order, so never refer to them by letter or position (no "option B", "all of the above").';

// Model bazen JSON'da ters eğik çizgiyi iki kez kaçırıyor: \(\frac..\) yerine \\(\\frac..\\) geliyor ve
// formüller arayüzde bozuk görünüyor. Metinde \\( ya da \\[ varsa bütün metin çift kaçırılmıştır: \\ → \.
// (Doğru yazılmış metinde \\( geçmez; frontend MathText eski kayıtlar için aynısını yapar.)
const fixLatex = (text: string) => (/\\\\[([]/.test(text) ? text.replace(/\\\\/g, '\\') : text);

const fixQuestionLatex = <T extends Omit<QuizItem, 'page'>>(q: T): T => ({
  ...q,
  question: fixLatex(q.question),
  solution: q.solution && fixLatex(q.solution),
  options: q.options.map(fixLatex),
  explanation: fixLatex(q.explanation),
});

const isValidQuestion = (q: Omit<QuizItem, 'page'> | undefined | null) =>
  !!q &&
  typeof q.question === 'string' &&
  Array.isArray(q.options) &&
  q.options.length >= 2 &&
  Number.isInteger(q.answerIndex) &&
  q.answerIndex >= 0 &&
  q.answerIndex < q.options.length;

const validQuestions = (questions: QuizItem[]) => questions.filter(isValidQuestion).map(fixQuestionLatex);

// Akışla üretim: her soru yazılır yazılmaz onQuestion çağrılır (ör. sete eklenir, öğrenci hemen görür).
export type OnQuestion = (q: QuizItem) => Promise<void>;

// Akışla gelen ham soruları doğrulayıp (prepare null dönerse atlanır) en fazla `limit` tanesini sırayla
// onQuestion'a verir. Geri çağrılar sırayla çalışır (kayıt sırası = soru sırası). finish() hepsini bekler ve
// akışta kabul edilen soruları döndürür (kaydedilenlerle aynı liste); onQuestion yoksa fallback'i döndürür.
const questionFeed = (onQuestion: OnQuestion | undefined, limit: number, prepare: (raw: unknown) => QuizItem | null) => {
  let chain: Promise<void> = Promise.resolve();
  const accepted: QuizItem[] = [];
  return {
    stream: onQuestion && {
      key: 'questions',
      onItem: (raw: unknown) => {
        if (accepted.length >= limit) return;
        const q = prepare(raw);
        if (!q) return;
        accepted.push(q);
        chain = chain.then(() => onQuestion(q));
        // Hata finish()'te fırlatılır; o ana kadar "işlenmemiş hata" sayılmasın.
        chain.catch(() => undefined);
      },
    },
    finish: async (fallback: QuizItem[]) => {
      await chain;
      return onQuestion ? accepted : fallback;
    },
  };
};

const noteQuestion = (raw: unknown) => {
  const q = raw as QuizItem;
  return isValidQuestion(q) ? fixQuestionLatex({ ...q, page: Number.isInteger(q.page) ? q.page : null }) : null;
};

// Deneme modunda akış: hazır sorular kısa aralıklarla tek tek verilir (arayüzde kademeli yükleme denenebilsin).
const mockFeed = async (questions: QuizItem[], onQuestion?: OnQuestion) => {
  if (!onQuestion) return;
  for (const q of questions) {
    await new Promise((r) => setTimeout(r, 700));
    await onQuestion(q);
  }
};

// "New questions": yapay zekânın notun konuları ve yöntemleriyle yazdığı yeni sorular (origin 'concept'). Notta
// olmayan yöntem / alt konu sorulmaz (notta kısmi integrasyon varsa basit kesirlere ayırma gelmez); farklı sayılar,
// fonksiyonlar ve senaryolarla aynı becerileri çalıştırır. page, sorunun çalıştırdığı konunun anlatıldığı sayfadır.
// Notun dışına çıkmak isteyen için "More new questions" (konu pratiği) vardır.
const QUIZ_SIZE = 10;
const generateQuiz = async (noteTitle: string, noteText: string, onQuestion?: OnQuestion) => {
  if (MOCK) {
    const mock = mockQuiz(noteText);
    await mockFeed(mock.questions, onQuestion);
    return mock;
  }
  const feed = questionFeed(onQuestion, QUIZ_SIZE, noteQuestion);
  const { topics, questions } = await createJson<{ topics: TopicInfo[]; questions: QuizItem[] }>({
    stream: feed.stream,
    system: STUDY_SYSTEM,
    content: [
      { type: 'text', text: `Note title: ${noteTitle}\n\n${noteText}` },
      {
        type: 'text',
        text:
          TOPICS_INSTRUCTION +
          `Then write ${QUIZ_SIZE} new multiple-choice questions, with "origin" set to "concept", that practise ` +
          'exactly the concepts, methods and techniques this note covers. Stay within the note’s scope: do not ask ' +
          'about any method, technique, rule or subtopic that the note does not explain or use, even if it belongs to ' +
          'the same course or chapter (e.g. if the note covers integration by parts but not partial fractions, ask no ' +
          'partial-fraction questions). Within that scope every question is your own, written from scratch: apply ' +
          'the methods to new cases, ask why a step works, compare cases, or spot a mistake. Take nothing from the ' +
          'note’s questions, exercises, quick checks, code listings or worked examples: no copied or reworded ' +
          'questions, and none of their numbers, sizes, values, variable or class names, data or scenarios (if an ' +
          'example in the note uses certain names or numbers, do not use those names or numbers). Invent your own ' +
          'names, numbers and situations. ' +
          'Spread the questions across the topics and the whole note, not only its first pages. ' +
          'Every question must make sense on its own, without seeing the note: include every value, definition and ' +
          'condition it needs, keep it consistent with itself, and make sure exactly one option is clearly correct. ' +
          'Set "page" to the page of the note where the method or concept the question practises is explained. ' +
          QUESTION_RULES,
      },
    ],
    schema: quizSchema(['concept']),
    maxTokens: 16000,
    // Kısmen nota dayanmadığı için doğruluk daha önemli: biraz daha fazla düşünür (konu pratiği gibi).
    effort: 'medium',
  });
  return { topics, questions: await feed.finish(validQuestions(questions).slice(0, QUIZ_SIZE)) };
};

// "Questions from the note": önce notta hazır olan sorular (çıkmış soru, alıştırma, örnek) birebir alınır
// (aynı metin ve sayılar; benzer soru yazılmaz). Yetmezse 2. aşama: notun tanımladığı terim / kelimeler, tanım,
// teorem ve formüllerden sorular (hesap sorusu ve uydurma sayı yok). O da yetmezse 3. aşama: yapay zekâ notun
// anlattığı yöntemlerle kendi sorularını yazar (kendi sayılarıyla, ama notun kapsamı dışına çıkmadan).
// Sorular notun sayfa sırasıyla gelir.
// "More questions from the note" turları: previous = öğrencinin daha önce gördüğü sorular (tekrarlanmaz),
// topicNames = ilk turun konu adları (bilgi haritasında aynı konular kullanılsın diye aynen yazılır).
const NOTE_QUIZ_SIZE = 10;
const generateNoteQuiz = async (
  noteTitle: string,
  noteText: string,
  more?: { previous: string[]; topicNames: string[] },
  onQuestion?: OnQuestion
) => {
  if (MOCK) {
    const mock = mockQuiz(noteText);
    const questions = mock.questions.map((q) => ({ ...q, origin: 'note' as const, question: more ? `[More] ${q.question}` : q.question }));
    await mockFeed(questions, onQuestion);
    return { topics: mock.topics, questions };
  }
  const feed = questionFeed(onQuestion, NOTE_QUIZ_SIZE, noteQuestion);
  const moreInstruction = more
    ? 'The student has already answered the questions listed below. Write different questions: first the note’s ' +
      'own questions that are not in that list (exactly as the note asks them), then terms and definitions of the ' +
      'note those questions did not reach, and only then your own questions on its methods (Steps 1-3 below). ' +
      'Do not repeat or rephrase them. ' +
      (more.topicNames.length
        ? `Use these topic names wherever they fit, spelled exactly like this: ${more.topicNames.join(', ')}. `
        : '') +
      `\n\nAlready answered:\n${more.previous.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n`
    : '';
  const { topics, questions } = await createJson<{ topics: TopicInfo[]; questions: QuizItem[] }>({
    system: STUDY_SYSTEM,
    content: [
      { type: 'text', text: `Note title: ${noteTitle}\n\n${noteText}` },
      {
        type: 'text',
        text:
          moreInstruction +
          TOPICS_INSTRUCTION +
          `Then write ${NOTE_QUIZ_SIZE} multiple-choice questions from this note, with "origin" set to "note". ` +
          'Step 1, the note’s own questions come first: find every question already written in the note (past exam ' +
          'questions, exercises, homework, review or quick-check questions, and solved examples such as "Soru 1", ' +
          '"Örnek", "Example 3", "Exercise 2.4", numbered problems) and take as many of them as fit, exactly as the ' +
          'note asks them: same wording, same functions, numbers, limits and conditions; never change a value, never ' +
          'write a "similar" version and never combine two of them. You may only fix obvious text-extraction errors ' +
          'and rewrite formulas in LaTeX. If such a question already has options, use them; otherwise keep its text ' +
          'unchanged and add 4 options. Use the note’s answer or solution if it shows one; otherwise work it out. ' +
          'Step 2, only if Step 1 gave fewer questions than needed: add questions on the terms and words the note ' +
          'defines or introduces and what they mean, then its definitions, theorems, formulas and rules (e.g. "What ' +
          'does X mean?", "Which statement about X is true?", "What does theorem X say?"). These are not ' +
          'calculations: never invent an integral, function, number or example for them. Their answers must be in ' +
          'the note. ' +
          'Step 3, only if Steps 1 and 2 together still gave fewer questions than needed (the note has few questions ' +
          'and few terms to ask about): write your own questions for the rest, practising the methods and concepts ' +
          'the note explains; here you may use your own functions, numbers and examples. Stay within the note’s ' +
          'scope: never ask about a method, rule or subtopic the note does not explain. ' +
          'Do not move to the next step while the current one still has unused material. ' +
          'Never mention the note in a question or option (no "according to the note", "in the note", "the note ' +
          'says"): ask directly, e.g. "What does it mean that T(n) is Ω(g(n))?". ' +
          'Spread the questions across the whole note, not only its first pages, and write them in the order of ' +
          'the note’s pages (earlier pages first). ' +
          'Every question must make sense on its own, without seeing the note: include every value, definition and ' +
          'condition it needs, keep it consistent with itself and with the note, and make sure exactly one option is ' +
          'correct. Set "page" to the page the answer comes from; for a question taken from the note, the page where ' +
          'that question is written; for a Step 3 question, the page where its method is explained. ' +
          QUESTION_RULES,
      },
    ],
    schema: quizSchema(['note']),
    maxTokens: 16000,
    stream: feed.stream,
  });
  const valid = validQuestions(questions).slice(0, NOTE_QUIZ_SIZE);
  // Notun sırasıyla (sayfası olmayanlar sona). Akışta sorular kaydedildikleri sırada kalır (cevap kayıtları soru
  // sırasına bağlı); model zaten sayfa sırasıyla yazar.
  valid.sort((a, b) => (a.page ?? Infinity) - (b.page ?? Infinity));
  return { topics, questions: await feed.finish(valid) };
};

// Konu pratiği: notun quiz'inden çıkan konular üzerine, notla sınırlı olmayan yeni sorular.
// Sorular notta yazmak zorunda değildir ama her biri listedeki bir konuya bağlıdır (şemada enum);
// bilgi haritası bu yüzden aynı konuları kullanmaya devam eder. Sayfa yoktur (page: null).
const TOPIC_QUIZ_SYSTEM =
  'You write exam-preparation questions for university students. Questions test standard, well-established ' +
  'course material on the given topics at the level of a university exam; each has exactly one clearly correct answer. ' +
  'Write in the same language as the example questions.' +
  MATH_RULE;

const generateTopicQuiz = async (params: {
  noteTitle: string;
  course?: string;
  topics: string[];
  noteQuestions: QuizItem[];
  onQuestion?: OnQuestion;
}): Promise<QuizItem[]> => {
  const { noteTitle, course, topics, noteQuestions, onQuestion } = params;
  if (MOCK) {
    // Deneme: notun quiz soruları ters sırayla, işaretlenerek.
    const questions = [...noteQuestions].reverse().map((q) => ({ ...q, question: `[Demo topic] ${q.question}`, page: null }));
    await mockFeed(questions, onQuestion);
    return questions;
  }
  const prepare = (raw: unknown): QuizItem | null => {
    const q = raw as QuizItem;
    return isValidQuestion(q) && topics.includes(q.topic) ? { ...fixQuestionLatex(q), page: null } : null;
  };
  const feed = questionFeed(onQuestion, 10, prepare);
  const schema = {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          // Sıra önemli: önce çözüm, sonra şıklar (bkz. quizSchema).
          properties: {
            question: { type: 'string' },
            solution: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
            answerIndex: { type: 'integer' },
            explanation: { type: 'string' },
            topic: { type: 'string', enum: topics },
          },
          required: ['question', 'solution', 'options', 'answerIndex', 'explanation', 'topic'],
          additionalProperties: false,
        },
      },
    },
    required: ['questions'],
    additionalProperties: false,
  };
  const { questions } = await createJson<{ questions: Omit<QuizItem, 'page'>[] }>({
    system: TOPIC_QUIZ_SYSTEM,
    content: [
      {
        type: 'text',
        text:
          `${course ? `Course: ${course}\n` : ''}Note: ${noteTitle}\n` +
          `Topics: ${topics.join(', ')}\n\n` +
          `Questions the student has already answered (do not repeat or rephrase them):\n` +
          noteQuestions.map((q, i) => `${i + 1}. ${q.question}`).join('\n'),
      },
      {
        type: 'text',
        text:
          'Write 10 new multiple-choice questions on these topics. They may go beyond the note: ask about definitions, ' +
          'how things work, comparisons, complexity, short code or worked examples — whatever a typical exam on these ' +
          'topics would ask. Spread the questions across the topics. ' +
          SOLUTION_RULE +
          'Then write exactly 4 options with one correct answer that matches your solution (answerIndex is 0-3), ' +
          'plausible wrong options, a one or two sentence explanation of why the answer is correct, ' +
          'and "topic" set to the topic it tests. Vary the position of the correct answer. Options are shown in random order, so never refer to them by letter or position (no "option B", "all of the above").',
      },
    ],
    schema,
    maxTokens: 16000,
    // Nota dayanmadığı için doğruluk daha önemli: biraz daha fazla düşünür.
    effort: 'medium',
    stream: feed.stream,
  });
  return feed.finish(questions.map(prepare).filter((q): q is QuizItem => q !== null));
};

const generateFlashcards = async (noteTitle: string, noteText: string) => {
  if (MOCK) return mockFlashcards(noteText);
  const { cards } = await createJson<{ cards: FlashcardItem[] }>({
    system: STUDY_SYSTEM,
    content: [
      { type: 'text', text: `Note title: ${noteTitle}\n\n${noteText}` },
      {
        type: 'text',
        text:
          'Write 15 flashcards. The front is a short question or term; the back is a concise answer ' +
          '(at most 2 sentences or a formula).',
      },
    ],
    schema: FLASHCARD_SCHEMA,
    maxTokens: 12000,
  });
  return cards
    .filter((c) => c.front.trim() && c.back.trim())
    .map((c) => ({ ...c, front: fixLatex(c.front), back: fixLatex(c.back) }));
};

// ---------- Deneme modu (AI_MOCK) içerikleri ----------
// Notun kendi satırlarından hazırlanır; yapay zekâ çıktısı değildir.

function firstSentence(text: string) {
  const sentence = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/)[0] ?? '';
  return sentence.length > 220 ? `${sentence.slice(0, 220)}…` : sentence;
}

// Notun bilgi satırları: "[Page 2]" işaretlerinden sayfa takip edilir; "4. AVL Trees: rotations" gibi satırlar
// konu ("AVL Trees") ve içerik ("rotations") olarak ayrılır.
const noteFacts = (noteText: string) => {
  const facts: { topic: string; detail: string; line: string; page: number | null }[] = [];
  let page: number | null = null;
  // Sayfa metinleri tek satıra birleşmiş olabilir: numaralı maddelerden ("3. ") de bölünür.
  const lines = noteText.replace(/\s(\d{1,2}\.\s)/g, '\n$1').split(/\n+/);
  for (const raw of lines) {
    const marker = raw.trim().match(/^\[Page (\d+)\]$/);
    if (marker) {
      page = Number(marker[1]);
      continue;
    }
    const line = raw.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim();
    // Başlık / künye satırları ("CENG213 - Data Structures | Prof. ...") soru olmaz.
    if (line.length < 12 || line.length > 220 || line.includes('|')) continue;
    const [head, ...rest] = line.split(':');
    const topic =
      rest.length && head.split(/\s+/).length <= 4
        ? head.trim()
        : line
            .split(/\s+/)
            .slice(0, 3)
            .join(' ')
            .replace(/\s+(and|ve|&|of|the|ile)$/i, '');
    facts.push({ topic, detail: rest.join(':').trim() || line, line, page });
  }
  return facts.slice(0, 10);
};

const mockQuiz = (noteText: string) => {
  const facts = noteFacts(noteText);
  const topics: TopicInfo[] = [...new Set(facts.map((f) => f.topic))].map((name, i, all) => ({
    name,
    // Deneme: her konu bir öncekine bağlı sayılır (grafiği göstermek için).
    prerequisites: i ? [all[i - 1]] : [],
  }));
  const questions: QuizItem[] = facts.map((fact, i) => {
    const others = facts.filter((f) => f !== fact).map((f) => f.detail);
    const wrong = [...others, 'This is not covered in the note', 'None of the above'].slice(0, 3);
    const answerIndex = i % 4;
    const options = [...wrong];
    options.splice(answerIndex, 0, fact.detail);
    return {
      question: `[Demo] Which of these does the note say about “${fact.topic}”?`,
      options,
      answerIndex,
      solution: `1. Find the part of the note about “${fact.topic}”.\n2. It says: ${fact.line}\n3. So the answer is: ${fact.detail}`,
      explanation: `The note says: ${fact.line}`,
      page: fact.page,
      topic: fact.topic,
    };
  });
  return { topics, questions };
};

const mockFlashcards = (noteText: string): FlashcardItem[] =>
  noteFacts(noteText).map((f) => ({ front: `[Demo] ${f.topic}`, back: f.detail, page: f.page }));

export {
  AI_MODEL,
  isAiEnabled,
  isMock,
  canOcr,
  consumeQuota,
  refundQuota,
  transcribeFile,
  answerFromSources,
  generateQuiz,
  generateNoteQuiz,
  generateTopicQuiz,
  generateFlashcards,
  OCR_MAX_PAGES,
};
