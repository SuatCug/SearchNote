import asyncHandler, { type AuthedRequest } from '../utils/asyncHandler.ts';
import ApiError from '../utils/apiError.ts';
import { Note, QuizAttempt, StudySet } from '../models/index.ts';
import { assertNoteVisible } from '../services/note.service.ts';
import { isVectorEnabled, loadNoteText, searchNotesContent, type ContentHit } from '../services/noteIndex.service.ts';
import {
  AI_MODEL,
  answerFromSources,
  consumeQuota,
  generateFlashcards,
  generateQuiz,
  generateNoteQuiz,
  generateTopicQuiz,
  isAiEnabled,
  isMock,
  refundQuota,
} from '../services/ai.service.ts';
import type { Response } from 'express';
import type { OnQuestion, QuizItem, TopicInfo } from '../services/ai.service.ts';
import {
  buildKnowledgeMap,
  recordQuizAnswer,
  saveQuizTopics,
  NOTE_QUIZ_INDEX_OFFSET,
  TOPIC_QUIZ_INDEX_OFFSET,
} from '../services/knowledge.service.ts';
import { buildPracticeList, searchPracticeNotes } from '../services/practice.service.ts';

// Yapay zekâ ile çalışma araçları: notların içinde arama + soru cevaplama, quiz ve flashcard.

const STUDY_KINDS = ['quiz', 'note-quiz', 'flashcards', 'topic-quiz'] as const;
type StudyKind = (typeof STUDY_KINDS)[number];

const MIN_STUDY_TEXT_CHARS = 200;
// Üretim yöntemlerinin sürümü; daha eski sürümle üretilmiş setler açılınca yeniden üretilir.
// quiz ("New questions") 5: notun konularında tamamen yapay zekânın yazdığı sorular (notun örnekleri, adları, sayıları kullanılmaz).
// note-quiz ("Questions from the note") 4: notun öğrettiği terim ve kavramlardan sorular; notun kendi soruları da aynen alınabilir.
// note-quiz 5: önce notun kendi soruları birebir; yetmezse kalan kavram soruları (uydurma hesap sorusu yok).
const QUIZ_VERSION = 5;
const NOTE_QUIZ_VERSION = 5;
// Cevap üretirken modele verilen en fazla kaynak parça sayısı.
const ANSWER_SOURCES = 6;

const getStatus = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { enabled: isAiEnabled(), mock: isMock(), semanticSearch: isVectorEnabled() } });
});

const loadVisibleNote = async (id: string, viewerId: string) => {
  const note = await Note.findById(id).select('title courseCode courseName group author visibility ai');
  if (!note) throw new ApiError(404, 'Note not found.');
  await assertNoteVisible(note, viewerId);
  return note;
};

// İstemciye parçanın tam metni değil, kısa alıntısı gönderilir.
const toSource = ({ text: _text, ...hit }: ContentHit) => hit;

// Ders adı da verilir: "calculus 2 ..." gibi sorularda yapay zekâ sayfanın o derse ait olduğunu bilsin.
const sourceTitle = (hit: ContentHit) => {
  const course = [hit.note.courseCode, hit.note.courseName].filter(Boolean).join(' ');
  return `${course ? `${course} – ` : ''}${hit.note.title}${hit.page ? ` (page ${hit.page})` : ''}`;
};

// Soru sor: önce notların içinde arama yapılır (ücretsiz), sonra bulunan sayfalardan yapay zekâ cevap yazar.
// Yapay zekâ kapalıysa / hak bittiyse / hata olursa yine bulunan sayfalar döner.
const ask = asyncHandler<AuthedRequest>(async (req, res) => {
  const question = String(req.body.question).trim();
  const noteId = req.body.noteId ? String(req.body.noteId) : undefined;
  const courseCode = req.body.courseCode ? String(req.body.courseCode) : undefined;

  if (noteId) {
    const note = await loadVisibleNote(noteId, req.user.id);
    if (note.ai?.status !== 'ready') {
      throw new ApiError(409, 'This note isn’t searchable yet. Try again in a minute.');
    }
  }

  const hits = await searchNotesContent({
    query: question,
    viewerId: req.user.id,
    noteId,
    courseCode,
    limit: 8,
    perNote: noteId ? 8 : 2,
  });

  const data: {
    sources: Omit<ContentHit, 'text'>[];
    answer: Awaited<ReturnType<typeof answerFromSources>>;
    answerError?: string;
    // Yapay zekâ bulunan sayfaların soruyu cevaplamadığına karar verdi: sayfalar gösterilmez.
    notCovered?: boolean;
    aiEnabled: boolean;
  } = { sources: hits.map(toSource), answer: null, aiEnabled: isAiEnabled() };

  if (hits.length && isAiEnabled() && req.body.answer !== false) {
    try {
      await consumeQuota(req.user.id, 'ask');
      const given = hits.slice(0, ANSWER_SOURCES);
      let answer;
      try {
        answer = await answerFromSources(
          question,
          given.map((h) => ({ title: sourceTitle(h), text: h.text }))
        );
      } catch (error) {
        await refundQuota(req.user.id, 'ask');
        throw error;
      }
      if (!answer) {
        // Kelime eşleşmesi tesadüfi (ör. "best pizza recipe" -> "best"): cevap da sayfa da gösterilmez, hak geri verilir.
        await refundQuota(req.user.id, 'ask');
        data.sources = [];
        data.notCovered = true;
      } else {
        // Sadece cevabın dayandığı sayfalar listelenir; numaralar yeni listeye göre düzeltilir.
        const cited = [...new Set(answer.flatMap((s) => s.sources))].sort((a, b) => a - b);
        const newIndex = new Map(cited.map((old, i) => [old, i]));
        data.sources = cited.map((i) => toSource(given[i]));
        data.answer = answer.map((s) => ({ ...s, sources: s.sources.map((i) => newIndex.get(i)!) }));
      }
    } catch (error) {
      console.error('AI answer error:', (error as Error).message);
      data.answerError =
        error instanceof ApiError ? error.message : 'The AI could not answer right now. The matching pages are below.';
    }
  }

  res.json({ success: true, data });
});

// Aynı not için aynı anda gelen flashcard üretim istekleri (çift tıklama, iki öğrenci) tek API çağrısını paylaşır.
const pendingSets = new Map<string, Promise<unknown>>();

type Round = { start: number; count: number };
type TopicSetDoc = {
  _id: unknown;
  items: unknown[];
  rounds?: Round[];
  topics?: TopicInfo[];
  model?: string;
  version?: number;
  generating?: boolean;
  createdAt?: Date;
};

// Eski kayıtlarda rounds yok: tüm sorular tek tur sayılır.
const roundsOf = (set: TopicSetDoc | null): Round[] =>
  !set ? [] : set.rounds?.length ? set.rounds : set.items.length ? [{ start: 0, count: set.items.length }] : [];

// Aynı not için turlar sırayla işlenir (iki istek aynı anda tur eklerse başlangıç sıraları karışmasın).
const topicLocks = new Map<string, Promise<unknown>>();
const withTopicLock = <T>(key: string, task: () => Promise<T>): Promise<T> => {
  const previous = topicLocks.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(task);
  const tail = run.catch(() => undefined);
  topicLocks.set(key, tail);
  void tail.then(() => topicLocks.get(key) === tail && topicLocks.delete(key));
  return run;
};

// ---------- Kademeli (akışla) quiz üretimi ----------
// Quiz soruları akışla üretilir: model bir soruyu yazar yazmaz sete eklenir (turlu setlerde son turun sayısı
// artar) ve set üretim boyunca generating: true kalır. ?progressive=1 ile gelen istek ilk soru eklenince cevap
// döner; web arayüzü kalanları ?poll=1 ile birkaç saniyede bir çeker. Parametresiz istek (mobil uygulama)
// eskisi gibi üretimin bitmesini bekler.

type Job = { first: Promise<void>; done: Promise<void> };
const jobs = new Map<string, Job>();
const jobKey = (noteId: string, kind: StudyKind) => `${noteId}:${kind}`;

const reloadSet = async (setId: unknown) => (await StudySet.findById(setId).lean()) as TopicSetDoc | null;

// Hiç soru kaydedilmeden biten üretimin izi silinir: boş set silinir, turlu setin boş son turu çıkarılır.
const dropEmptyRun = async (setId: unknown) => {
  const set = await reloadSet(setId);
  if (!set) return null;
  if (!set.items.length) {
    await StudySet.deleteOne({ _id: setId });
    return null;
  }
  const last = set.rounds?.at(-1);
  await StudySet.updateOne(
    { _id: setId },
    { $unset: { generating: 1 }, ...(last && !last.count && { $pop: { rounds: 1 } }) }
  );
  return reloadSet(setId);
};

// Sunucu üretim sırasında yeniden başladıysa set generating olarak kalır: kaydedilen sorularla tamamlanır.
const settleStale = async (set: TopicSetDoc | null, key: string) =>
  set?.generating && !jobs.has(key) ? dropEmptyRun(set._id) : set;

// Soruları arka planda üretir ve her birini sete ekler. first: ilk soru kaydedilince (ya da üretim hatayla
// bitince) biter; done: üretim bitince. Hiç soru üretilemezse iz silinir, hak geri verilir ve ikisi de hata verir;
// yarıda kesilirse set o ana kadarki sorularla tamamlanır.
const startQuizJob = (params: {
  key: string;
  setId: unknown;
  // Turlu setlerde (konu pratiği, notun sorularının ek turları) soruların eklendiği turun başlangıç sırası.
  roundStart?: number;
  userId: string;
  generate: (onQuestion: OnQuestion) => Promise<{ topics?: TopicInfo[]; questions: QuizItem[] }>;
  // Bilgi haritasının konu grafiği.
  saveTopics?: (topics: TopicInfo[], questions: QuizItem[]) => Promise<unknown>;
  // Konular sete de yazılır (ilk quiz setleri).
  storeTopics?: boolean;
}): Job => {
  const { key, setId, roundStart, userId } = params;
  const inRound = roundStart !== undefined;
  let count = 0;
  let firstSaved!: () => void;
  const firstItem = new Promise<void>((resolve) => (firstSaved = resolve));

  const done = (async () => {
    try {
      const result = await params.generate(async (q) => {
        await StudySet.updateOne(
          { _id: setId },
          { $push: { items: q }, ...(inRound && { $inc: { 'rounds.$[r].count': 1 } }) },
          inRound ? { arrayFilters: [{ 'r.start': roundStart }] } : {}
        );
        count++;
        firstSaved();
      });
      if (!count) throw new ApiError(502, 'The AI could not create questions. Please try again.');
      if (params.saveTopics && result.topics?.length) await params.saveTopics(result.topics, result.questions);
      await StudySet.updateOne(
        { _id: setId },
        { $unset: { generating: 1 }, ...(params.storeTopics && result.topics && { $set: { topics: result.topics } }) }
      );
    } catch (error) {
      if (!count) {
        await dropEmptyRun(setId).catch(() => undefined);
        await refundQuota(userId, 'study');
        throw error;
      }
      console.error('Quiz generation stopped early:', (error as Error).message);
      await StudySet.updateOne({ _id: setId }, { $unset: { generating: 1 } }).catch(() => undefined);
    } finally {
      jobs.delete(key);
    }
  })();

  const job: Job = { first: Promise.race([firstItem, done]), done };
  // Bekleyen istek yoksa hata "işlenmemiş" sayılıp süreci düşürmesin.
  job.first.catch(() => undefined);
  job.done.catch(() => undefined);
  jobs.set(key, job);
  return job;
};

// Üretim sürüyorsa bekler: kademeli istek ilk soruyu, diğerleri üretimin sonunu.
const waitForJob = async (key: string, progressive: boolean) => {
  const job = jobs.get(key);
  if (job) await (progressive ? job.first : job.done);
};

// İstemciye giden set. start verilirse o tur (konu pratiği / ek not turu), yoksa ilk tur (notun sorularına ek
// turlar eklendiyse yalnız ilk 10 soru; ek turlar ?more=1 ile gelir). generating: bu turun soruları hâlâ geliyor.
const sendSet = (res: Response, kind: StudyKind, set: TopicSetDoc, start?: number) => {
  const items = set.items ?? [];
  const rounds = roundsOf(set);
  let slice = items;
  let isLast = rounds.length <= 1;
  if (start !== undefined) {
    const index = rounds.findIndex((r) => r.start === start);
    const round = rounds[index];
    slice = round ? items.slice(round.start, round.start + round.count) : [];
    isLast = index === rounds.length - 1;
  } else if (kind === 'note-quiz' && set.rounds?.[0]) {
    slice = items.slice(0, set.rounds[0].count);
  }
  res.json({
    success: true,
    data: {
      set: {
        kind,
        items: slice,
        ...(start !== undefined && { start }),
        ...(set.generating && isLast && { generating: true }),
        createdAt: set.createdAt,
        mock: set.model === 'mock',
      },
    },
  });
};

// ---------- Konu pratiği (turlar) ----------
// Notun quiz'indeki konulardan, notla sınırlı olmayan sorular. Sorular not başına tek kayıtta turlar halinde
// birikir: öğrenciye bitirmediği ilk tur verilir; hepsini bitirdiyse yeni tur üretilip sona eklenir (bir hak düşer).
// Önce notun quiz'i üretilmiş olmalı (arayüzde buton quiz bitince çıkar).

const MAX_TOPIC_ROUNDS = 20;
// Önceki sorulardan bu kadarı "tekrarlama" diye modele verilir.
const TOPIC_AVOID_LIMIT = 60;

// ---------- Notun soruları: ek turlar ("More questions from the note") ----------
// İlk 10 soru (1. tur) her açılışta gelir; mobil uygulama da sadece onu görür. Quiz bitince "More questions from
// the note" yine yalnız nottan, öncekileri tekrarlamayan bir tur verir: öğrencinin yarıdan azını çözdüğü ek tur
// varsa o, yoksa yeni tur üretilip sona eklenir (bir hak düşer). Cevap sıraları NOTE_QUIZ_INDEX_OFFSET + sıra.

const MAX_NOTE_ROUNDS = 10;
const NOTE_AVOID_LIMIT = 60;

type RoundPick = { set: TopicSetDoc; round: Round };

// Öğrencinin bir turdaki sorulardan cevapladığı oran.
const answeredShare = async (userId: string, noteId: string, offset: number, mock: boolean) => {
  const answered = new Set(
    (
      await QuizAttempt.distinct('questionIndex', { user: userId, note: noteId, questionIndex: { $gte: offset }, mock })
    ).map((i: number) => i - offset)
  );
  return (r: Round) => {
    let n = 0;
    for (let i = r.start; i < r.start + r.count; i++) if (answered.has(i)) n++;
    return r.count ? n / r.count : 0;
  };
};

const nextNoteRound = (noteId: string, title: string, course: string | undefined, userId: string) => {
  const key = jobKey(noteId, 'note-quiz');
  return withTopicLock(key, async (): Promise<RoundPick> => {
    const set = await settleStale(
      (await StudySet.findOne({ note: noteId, kind: 'note-quiz' }).lean()) as TopicSetDoc | null,
      key
    );
    if (!set?.items.length) throw new ApiError(409, 'Take the quiz from this note first.');
    const rounds = roundsOf(set);
    // Üretimi süren tur (başka bir istek başlattı) verilir.
    if (set.generating) return { set, round: rounds.at(-1)! };
    const answeredIn = await answeredShare(userId, noteId, NOTE_QUIZ_INDEX_OFFSET, set.model === 'mock');
    const extra = rounds.slice(1);
    const open = extra.find((r) => answeredIn(r) < 0.5);
    if (open) return { set, round: open };
    if (extra.length && rounds.length >= MAX_NOTE_ROUNDS) {
      return { set, round: [...extra].sort((a, b) => answeredIn(a) - answeredIn(b))[0] };
    }

    if (!isAiEnabled()) throw new ApiError(503, 'AI features are not configured on this server.');
    const text = await loadNoteText(noteId);
    await consumeQuota(userId, 'study');
    const round = { start: set.items.length, count: 0 };
    try {
      await StudySet.updateOne({ _id: set._id }, { $set: { rounds: [...rounds, round], generating: true } });
    } catch (error) {
      await refundQuota(userId, 'study');
      throw error;
    }
    startQuizJob({
      key,
      setId: set._id,
      roundStart: round.start,
      userId,
      generate: (onQuestion) =>
        generateNoteQuiz(
          title,
          text,
          {
            previous: (set.items as QuizItem[]).slice(-NOTE_AVOID_LIMIT).map((q) => q.question),
            topicNames: (set.topics ?? []).map((t) => t.name),
          },
          onQuestion
        ),
      saveTopics: (topics, questions) => saveQuizTopics(topics, questions, course, isMock()),
    });
    return { set, round };
  });
};

const nextTopicRound = (noteId: string, title: string, course: string | undefined, userId: string) => {
  const key = jobKey(noteId, 'topic-quiz');
  return withTopicLock(key, async (): Promise<RoundPick> => {
    let set = (await StudySet.findOne({ note: noteId, kind: 'topic-quiz' }).lean()) as TopicSetDoc | null;
    if (set?.model === 'mock' && !isMock()) {
      await StudySet.deleteOne({ _id: set._id });
      set = null;
    }
    set = await settleStale(set, key);
    const rounds = roundsOf(set);

    if (set && rounds.length) {
      if (set.generating) return { set, round: rounds.at(-1)! };
      const answeredIn = await answeredShare(userId, noteId, TOPIC_QUIZ_INDEX_OFFSET, set.model === 'mock');
      // Yarısından azı cevaplanmış ilk tur (yarıda bırakılan tur da tekrar gelir).
      const open = rounds.find((r) => answeredIn(r) < 0.5);
      if (open) return { set, round: open };
      // Sınıra gelindiyse en az çözülmüş tur tekrar verilir (yeni üretim yok).
      if (rounds.length >= MAX_TOPIC_ROUNDS) {
        return { set, round: [...rounds].sort((a, b) => answeredIn(a) - answeredIn(b))[0] };
      }
    }

    if (!isAiEnabled()) throw new ApiError(503, 'AI features are not configured on this server.');
    // Konular notun iki quiz'inden de (yeni sorular / notun soruları) gelebilir; hangisi çözüldüyse.
    const bases = await StudySet.find({
      note: noteId,
      kind: { $in: ['quiz', 'note-quiz'] },
      ...(isMock() ? {} : { model: { $ne: 'mock' } }),
    }).lean();
    const noteQuestions = bases.flatMap((b) => (b.items ?? []) as QuizItem[]);
    const baseTopics = bases.flatMap((b) => (b.topics ?? []) as TopicInfo[]);
    const topics = [
      ...new Set(
        [...baseTopics.map((t) => t.name), ...noteQuestions.map((q) => q.topic)]
          .map((name) => name?.trim())
          .filter(Boolean)
      ),
    ];
    if (!topics.length) throw new ApiError(409, 'Take the practice quiz for this note first.');

    await consumeQuota(userId, 'study');
    const previous = ((set?.items ?? []) as QuizItem[]).slice(-TOPIC_AVOID_LIMIT);
    const round = { start: set?.items.length ?? 0, count: 0 };
    let created: TopicSetDoc;
    try {
      created = (await StudySet.findOneAndUpdate(
        { note: noteId, kind: 'topic-quiz' },
        { $set: { rounds: [...rounds, round], model: AI_MODEL, generating: true } },
        { upsert: true, returnDocument: 'after' }
      ).lean()) as TopicSetDoc;
    } catch (error) {
      await refundQuota(userId, 'study');
      throw error;
    }
    startQuizJob({
      key,
      setId: created._id,
      roundStart: round.start,
      userId,
      generate: async (onQuestion) => ({
        questions: await generateTopicQuiz({
          noteTitle: title,
          course,
          topics,
          noteQuestions: [...noteQuestions, ...previous],
          onQuestion,
        }),
      }),
    });
    return { set: created, round };
  });
};

const generateFlashcardSet = async (noteId: string, title: string, userId: string) => {
  const text = await loadNoteText(noteId);
  if (text.length < MIN_STUDY_TEXT_CHARS) {
    throw new ApiError(422, 'This note doesn’t have enough readable text to create study material.');
  }
  await consumeQuota(userId, 'study');
  try {
    const items = await generateFlashcards(title, text);
    if (!items.length) throw new ApiError(502, 'The AI could not create study material. Please try again.');
    return await StudySet.findOneAndUpdate(
      { note: noteId, kind: 'flashcards' },
      { $setOnInsert: { items, model: AI_MODEL, version: 1 } },
      { upsert: true, returnDocument: 'after' }
    ).lean();
  } catch (error) {
    await refundQuota(userId, 'study');
    throw error;
  }
};

// İlk quiz setini (yeni sorular / notun soruları) boş ve generating olarak açar, soruları arka planda üretir.
// Aynı anda gelen ikinci istek kilitte bekler, sonra açılmış seti bulur (yeni üretim başlatmaz).
const startQuizSet = (noteId: string, title: string, course: string | undefined, kind: 'quiz' | 'note-quiz', userId: string) => {
  const key = jobKey(noteId, kind);
  return withTopicLock(key, async () => {
    if (await StudySet.exists({ note: noteId, kind })) return;
    const text = await loadNoteText(noteId);
    if (text.length < MIN_STUDY_TEXT_CHARS) {
      throw new ApiError(422, 'This note doesn’t have enough readable text to create study material.');
    }
    await consumeQuota(userId, 'study');
    let set: TopicSetDoc;
    try {
      set = (await StudySet.findOneAndUpdate(
        { note: noteId, kind },
        {
          $setOnInsert: {
            items: [],
            generating: true,
            model: AI_MODEL,
            version: kind === 'quiz' ? QUIZ_VERSION : NOTE_QUIZ_VERSION,
          },
        },
        { upsert: true, returnDocument: 'after' }
      ).lean()) as TopicSetDoc;
    } catch (error) {
      await refundQuota(userId, 'study');
      throw error;
    }
    startQuizJob({
      key,
      setId: set._id,
      userId,
      generate: (onQuestion) =>
        kind === 'quiz' ? generateQuiz(title, text, onQuestion) : generateNoteQuiz(title, text, undefined, onQuestion),
      saveTopics: (topics, questions) => saveQuizTopics(topics, questions, course, isMock()),
      storeTopics: true,
    });
  });
};

// Quiz / flashcard: daha önce üretildiyse kayıtlı set döner (hak harcanmaz), yoksa üretilir.
// Konu pratiği: öğrencinin bitirmediği tur (yoksa yeni tur); start = turun ilk sorusunun sırası.
// ?progressive=1: quiz ilk soru hazır olunca döner (generating: true ise kalanlar ?poll=1 ile çekilir).
// ?poll=1 (&start=N turlu setlerde): üretimi süren setin güncel hali; yeni üretim ya da tur başlatmaz.
const getStudySet = asyncHandler<AuthedRequest>(async (req, res) => {
  const kind = req.params.kind as StudyKind;
  if (!STUDY_KINDS.includes(kind)) throw new ApiError(404, 'Unknown study tool.');
  const note = await loadVisibleNote(req.params.id, req.user.id);
  const noteId = String(note._id);
  const course = note.courseCode || note.courseName || undefined;
  const progressive = req.query.progressive === '1';
  const key = jobKey(noteId, kind);

  if (req.query.poll === '1' && kind !== 'flashcards') {
    const set = await settleStale((await StudySet.findOne({ note: noteId, kind }).lean()) as TopicSetDoc | null, key);
    if (!set) throw new ApiError(409, 'The questions could not be created. Please try again.');
    sendSet(res, kind, set, req.query.start !== undefined ? Number(req.query.start) : undefined);
    return;
  }

  // Konu pratiği ve notun sorularının ek turu ("More questions from the note", ?more=1): tur döner.
  if (kind === 'topic-quiz' || (kind === 'note-quiz' && req.query.more === '1')) {
    const { set, round } = await (kind === 'topic-quiz' ? nextTopicRound : nextNoteRound)(noteId, note.title, course, req.user.id);
    await waitForJob(key, progressive);
    const fresh = await settleStale(await reloadSet(set._id), key);
    if (!fresh) throw new ApiError(502, 'The AI could not create questions. Please try again.');
    sendSet(res, kind, fresh, round.start);
    return;
  }

  let set = (await StudySet.findOne({ note: note._id, kind }).lean()) as TopicSetDoc | null;
  // Yerel deneme modunda (AI_MOCK) üretilmiş örnek set gerçek modda kullanılmaz: silinip gerçeği üretilir.
  if (set?.model === 'mock' && !isMock()) {
    await StudySet.deleteOne({ _id: set._id });
    set = null;
  }
  // Quiz eski yöntemle üretildiyse yeniden üretilir. O sete ait cevaplar da silinir: soru sırasına bağlı
  // oldukları için yeni sorularla yanlış eşleşirlerdi.
  const version = set?.version ?? 1;
  if (set && kind === 'quiz' && version < QUIZ_VERSION) {
    await Promise.all([
      StudySet.deleteOne({ _id: set._id }),
      QuizAttempt.deleteMany({ note: note._id, questionIndex: { $lt: TOPIC_QUIZ_INDEX_OFFSET } }),
    ]);
    set = null;
  }
  if (set && kind === 'note-quiz' && version < NOTE_QUIZ_VERSION) {
    await Promise.all([
      StudySet.deleteOne({ _id: set._id }),
      QuizAttempt.deleteMany({ note: note._id, questionIndex: { $gte: NOTE_QUIZ_INDEX_OFFSET } }),
    ]);
    set = null;
  }
  set = await settleStale(set, key);

  if (!set) {
    if (!isAiEnabled()) throw new ApiError(503, 'AI features are not configured on this server.');
    if (note.ai?.status !== 'ready') {
      throw new ApiError(
        409,
        note.ai?.status === 'pending' || note.ai?.status === 'processing'
          ? 'This note is still being prepared. Try again in a minute.'
          : 'Study tools aren’t available for this note.'
      );
    }
    if (kind === 'flashcards') {
      let pending = pendingSets.get(key);
      if (!pending) {
        pending = generateFlashcardSet(noteId, note.title, req.user.id).finally(() => pendingSets.delete(key));
        pendingSets.set(key, pending);
      }
      set = (await pending) as TopicSetDoc;
    } else {
      await startQuizSet(noteId, note.title, course, kind as 'quiz' | 'note-quiz', req.user.id);
    }
  }

  if (kind !== 'flashcards') {
    await waitForJob(key, progressive);
    set = await settleStale((await StudySet.findOne({ note: noteId, kind }).lean()) as TopicSetDoc | null, key);
    if (!set) throw new ApiError(502, 'The AI could not create questions. Please try again.');
  }
  sendSet(res, kind, set!);
});

// Quiz cevabı: bilgi haritası için kaydedilir (doğruluk sunucuda hesaplanır).
const answerQuiz = asyncHandler<AuthedRequest>(async (req, res) => {
  await loadVisibleNote(req.params.id, req.user.id);
  const data = await recordQuizAnswer({
    userId: req.user.id,
    noteId: req.params.id,
    index: Number(req.body.index),
    choice: Number(req.body.choice),
    kind: req.body.set === 'topic-quiz' || req.body.set === 'note-quiz' ? req.body.set : 'quiz',
  });
  res.json({ success: true, data });
});

// Kişisel bilgi haritası.
const getKnowledgeMap = asyncHandler<AuthedRequest>(async (req, res) => {
  res.json({ success: true, data: await buildKnowledgeMap(req.user.id) });
});

// Pratik listesi: quiz çözülen, kaydedilen ve kendi notlar (skor ve hazır setlerle).
// ?q= verilirse görülebilen tüm notlar arasında ders / başlık araması.
const getPracticeList = asyncHandler<AuthedRequest>(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  res.json({ success: true, data: q ? await searchPracticeNotes(req.user.id, q) : await buildPracticeList(req.user.id) });
});

export { getStatus, ask, getStudySet, answerQuiz, getKnowledgeMap, getPracticeList };
