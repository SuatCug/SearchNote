import asyncHandler, { type AuthedRequest } from '../utils/asyncHandler.ts';
import ApiError from '../utils/apiError.ts';
import { Note, StudySet } from '../models/index.ts';
import { assertNoteVisible } from '../services/note.service.ts';
import { isVectorEnabled, loadNoteText, searchNotesContent, type ContentHit } from '../services/noteIndex.service.ts';
import {
  AI_MODEL,
  answerFromSources,
  consumeQuota,
  generateFlashcards,
  generateQuiz,
  isAiEnabled,
  isMock,
  refundQuota,
} from '../services/ai.service.ts';
import { buildKnowledgeMap, recordQuizAnswer, saveQuizTopics } from '../services/knowledge.service.ts';

// Yapay zekâ ile çalışma araçları: notların içinde arama + soru cevaplama, quiz ve flashcard.

const STUDY_KINDS = ['quiz', 'flashcards'] as const;
type StudyKind = (typeof STUDY_KINDS)[number];

const MIN_STUDY_TEXT_CHARS = 200;
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
    answer: Awaited<ReturnType<typeof answerFromSources>> | null;
    answerError?: string;
    aiEnabled: boolean;
  } = { sources: hits.map(toSource), answer: null, aiEnabled: isAiEnabled() };

  if (hits.length && isAiEnabled() && req.body.answer !== false) {
    try {
      await consumeQuota(req.user.id, 'ask');
      try {
        data.answer = await answerFromSources(
          question,
          hits.slice(0, ANSWER_SOURCES).map((h) => ({ title: sourceTitle(h), text: h.text }))
        );
      } catch (error) {
        await refundQuota(req.user.id, 'ask');
        throw error;
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

const generateSet = async (noteId: string, title: string, course: string | undefined, kind: StudyKind, userId: string) => {
  const text = await loadNoteText(noteId);
  if (text.length < MIN_STUDY_TEXT_CHARS) {
    throw new ApiError(422, 'This note doesn’t have enough readable text to create study material.');
  }
  await consumeQuota(userId, 'study');
  try {
    let items: unknown[];
    let topics: unknown[] | undefined;
    if (kind === 'quiz') {
      const quiz = await generateQuiz(title, text);
      items = quiz.questions;
      topics = quiz.topics;
      // Bilgi haritasının konu grafiği (konular ve ön koşulları).
      if (items.length) await saveQuizTopics(quiz.topics, quiz.questions, course, isMock());
    } else {
      items = await generateFlashcards(title, text);
    }
    if (!items.length) throw new ApiError(502, 'The AI could not create study material. Please try again.');
    return await StudySet.findOneAndUpdate(
      { note: noteId, kind },
      { $setOnInsert: { items, topics, model: AI_MODEL } },
      { upsert: true, returnDocument: 'after' }
    ).lean();
  } catch (error) {
    await refundQuota(userId, 'study');
    throw error;
  }
};

// Quiz / flashcard: daha önce üretildiyse kayıtlı set döner (hak harcanmaz), yoksa üretilir.
const getStudySet = asyncHandler<AuthedRequest>(async (req, res) => {
  const kind = req.params.kind as StudyKind;
  if (!STUDY_KINDS.includes(kind)) throw new ApiError(404, 'Unknown study tool.');
  const note = await loadVisibleNote(req.params.id, req.user.id);

  let set = await StudySet.findOne({ note: note._id, kind }).lean();
  // Yerel deneme modunda (AI_MOCK) üretilmiş örnek set gerçek modda kullanılmaz: silinip gerçeği üretilir.
  if (set?.model === 'mock' && !isMock()) {
    await StudySet.deleteOne({ _id: set._id });
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
  });
  res.json({ success: true, data });
});

// Kişisel bilgi haritası.
const getKnowledgeMap = asyncHandler<AuthedRequest>(async (req, res) => {
  res.json({ success: true, data: await buildKnowledgeMap(req.user.id) });
});

export { getStatus, ask, getStudySet, answerQuiz, getKnowledgeMap };
