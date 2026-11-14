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
import type { QuizItem, TopicInfo } from '../services/ai.service.ts';
import {
  buildKnowledgeMap,
  recordQuizAnswer,
  saveQuizTopics,
  TOPIC_QUIZ_INDEX_OFFSET,
} from '../services/knowledge.service.ts';
import { buildPracticeList, searchPracticeNotes } from '../services/practice.service.ts';

// Yapay zekâ ile çalışma araçları: notların içinde arama + soru cevaplama, quiz ve flashcard.

const STUDY_KINDS = ['quiz', 'note-quiz', 'flashcards', 'topic-quiz'] as const;
type StudyKind = (typeof STUDY_KINDS)[number];

const MIN_STUDY_TEXT_CHARS = 200;
// "New questions" üretim yönteminin sürümü. 3: hepsi yapay zekânın kendi sorusu (notun soruları ayrı modda,
// note-quiz). Daha eski sürümle üretilmiş setler açılınca yeniden üretilir.
const QUIZ_VERSION = 3;
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

const sourceTitle = (hit: ContentHit) =>
  `${hit.note.courseCode ? `${hit.note.courseCode} – ` : ''}${hit.note.title}${hit.page ? ` (page ${hit.page})` : ''}`;

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

// Aynı not için aynı anda gelen üretim istekleri (çift tıklama, iki öğrenci) tek API çağrısını paylaşır.
const pendingSets = new Map<string, Promise<unknown>>();

// ---------- Konu pratiği (turlar) ----------
// Notun quiz'indeki konulardan, notla sınırlı olmayan sorular. Sorular not başına tek kayıtta turlar halinde
// birikir: öğrenciye bitirmediği ilk tur verilir; hepsini bitirdiyse yeni tur üretilip sona eklenir (bir hak düşer).
// Önce notun quiz'i üretilmiş olmalı (arayüzde buton quiz bitince çıkar).

const MAX_TOPIC_ROUNDS = 20;
// Önceki sorulardan bu kadarı "tekrarlama" diye modele verilir.
const TOPIC_AVOID_LIMIT = 60;

type Round = { start: number; count: number };
type TopicSetDoc = { _id: unknown; items: unknown[]; rounds?: Round[]; model?: string; createdAt?: Date };

// Eski kayıtlarda rounds yok: tüm sorular tek tur sayılır.
const roundsOf = (set: TopicSetDoc | null): Round[] =>
  !set ? [] : set.rounds?.length ? set.rounds : set.items.length ? [{ start: 0, count: set.items.length }] : [];

// Aynı not için turlar sırayla işlenir (iki istek aynı anda tur eklerse başlangıç sıraları karışmasın).
const topicLocks = new Map<string, Promise<unknown>>();
const withTopicLock = <T>(noteId: string, task: () => Promise<T>): Promise<T> => {
  const previous = topicLocks.get(noteId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(task);
  const tail = run.catch(() => undefined);
  topicLocks.set(noteId, tail);
  void tail.then(() => topicLocks.get(noteId) === tail && topicLocks.delete(noteId));
  return run;
};

const nextTopicRound = (noteId: string, title: string, course: string | undefined, userId: string) =>
  withTopicLock(noteId, async () => {
    let set = (await StudySet.findOne({ note: noteId, kind: 'topic-quiz' }).lean()) as TopicSetDoc | null;
    if (set?.model === 'mock' && !isMock()) {
      await StudySet.deleteOne({ _id: set._id });
      set = null;
    }
    const rounds = roundsOf(set);

    if (set && rounds.length) {
      const answered = new Set(
        (
          await QuizAttempt.distinct('questionIndex', {
            user: userId,
            note: noteId,
            questionIndex: { $gte: TOPIC_QUIZ_INDEX_OFFSET },
            mock: set.model === 'mock',
          })
        ).map((i: number) => i - TOPIC_QUIZ_INDEX_OFFSET)
      );
      const answeredIn = (r: Round) => {
        let n = 0;
        for (let i = r.start; i < r.start + r.count; i++) if (answered.has(i)) n++;
        return n / r.count;
      };
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
    try {
      const previous = ((set?.items ?? []) as QuizItem[]).slice(-TOPIC_AVOID_LIMIT);
      const items = await generateTopicQuiz({ noteTitle: title, course, topics, noteQuestions: [...noteQuestions, ...previous] });
      if (!items.length) throw new ApiError(502, 'The AI could not create questions. Please try again.');
      const round = { start: set?.items.length ?? 0, count: items.length };
      const updated = (await StudySet.findOneAndUpdate(
        { note: noteId, kind: 'topic-quiz' },
        { $push: { items: { $each: items } }, $set: { rounds: [...rounds, round], model: AI_MODEL } },
        { upsert: true, returnDocument: 'after' }
      ).lean()) as TopicSetDoc;
      return { set: updated, round };
    } catch (error) {
      await refundQuota(userId, 'study');
      throw error;
    }
  });

const generateSet = async (noteId: string, title: string, course: string | undefined, kind: StudyKind, userId: string) => {
  const text = await loadNoteText(noteId);
  if (text.length < MIN_STUDY_TEXT_CHARS) {
    throw new ApiError(422, 'This note doesn’t have enough readable text to create study material.');
  }
  await consumeQuota(userId, 'study');
  try {
    let items: unknown[];
    let topics: unknown[] | undefined;
    if (kind === 'quiz' || kind === 'note-quiz') {
      const quiz = kind === 'quiz' ? await generateQuiz(title, text) : await generateNoteQuiz(title, text);
      items = quiz.questions;
      topics = quiz.topics;
      // Bilgi haritasının konu grafiği (konular ve ön koşulları).
      if (items.length) await saveQuizTopics(quiz.topics, quiz.questions, course, isMock());
    } else {
      items = await generateFlashcards(title, text);
    }
    if (!items.length) {
      // Notta hiç soru yok: boş set saklanır (her açılışta tekrar aranmasın), hak iade edilir.
      if (kind === 'note-quiz') {
        await refundQuota(userId, 'study');
        return await StudySet.findOneAndUpdate(
          { note: noteId, kind },
          { $setOnInsert: { items: [], topics, model: AI_MODEL, version: 1 } },
          { upsert: true, returnDocument: 'after' }
        ).lean();
      }
      throw new ApiError(502, 'The AI could not create study material. Please try again.');
    }
    return await StudySet.findOneAndUpdate(
      { note: noteId, kind },
      { $setOnInsert: { items, topics, model: AI_MODEL, version: kind === 'quiz' ? QUIZ_VERSION : 1 } },
      { upsert: true, returnDocument: 'after' }
    ).lean();
  } catch (error) {
    await refundQuota(userId, 'study');
    throw error;
  }
};

// Quiz / flashcard: daha önce üretildiyse kayıtlı set döner (hak harcanmaz), yoksa üretilir.
// Konu pratiği: öğrencinin bitirmediği tur (yoksa yeni tur); start = turun ilk sorusunun sırası.
const getStudySet = asyncHandler<AuthedRequest>(async (req, res) => {
  const kind = req.params.kind as StudyKind;
  if (!STUDY_KINDS.includes(kind)) throw new ApiError(404, 'Unknown study tool.');
  const note = await loadVisibleNote(req.params.id, req.user.id);

  if (kind === 'topic-quiz') {
    const course = note.courseCode || note.courseName || undefined;
    const { set, round } = await nextTopicRound(String(note._id), note.title, course, req.user.id);
    res.json({
      success: true,
      data: {
        set: {
          kind,
          items: set.items.slice(round.start, round.start + round.count),
          start: round.start,
          createdAt: set.createdAt,
          mock: set.model === 'mock',
        },
      },
    });
    return;
  }

  let set = await StudySet.findOne({ note: note._id, kind }).lean();
  // Yerel deneme modunda (AI_MOCK) üretilmiş örnek set gerçek modda kullanılmaz: silinip gerçeği üretilir.
  if (set?.model === 'mock' && !isMock()) {
    await StudySet.deleteOne({ _id: set._id });
    set = null;
  }
  // "New questions" eski yöntemle (v1 / v2: notun soruları da karışıktı) üretildiyse yeniden üretilir.
  // O sete ait cevaplar da silinir: soru sırasına bağlı oldukları için yeni sorularla yanlış eşleşirlerdi.
  if (kind === 'quiz' && set && ((set as { version?: number }).version ?? 1) < QUIZ_VERSION) {
    await Promise.all([
      StudySet.deleteOne({ _id: set._id }),
      QuizAttempt.deleteMany({ note: note._id, questionIndex: { $lt: TOPIC_QUIZ_INDEX_OFFSET } }),
    ]);
    set = null;
  }
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
    const key = `${note._id}:${kind}`;
    let pending = pendingSets.get(key);
    if (!pending) {
      const course = note.courseCode || note.courseName || undefined;
      pending = generateSet(String(note._id), note.title, course, kind, req.user.id).finally(() => pendingSets.delete(key));
      pendingSets.set(key, pending);
    }
    set = (await pending) as typeof set;
  }

  res.json({
    success: true,
    data: { set: { kind, items: set?.items ?? [], createdAt: set?.createdAt, mock: set?.model === 'mock' } },
  });
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
