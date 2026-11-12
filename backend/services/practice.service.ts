import mongoose from 'mongoose';
import { Note, QuizAttempt, StudySet, User } from '../models/index.ts';
import { assertNoteVisible, visibleNotesMatch } from './note.service.ts';
import { isMock } from './ai.service.ts';
import { wordSearchMatch } from '../utils/regex.util.ts';

// "Quizzes & flashcards" sayfası: öğrencinin quiz / flashcard çalışabileceği notlar.
// - Liste (q yok): daha önce quiz çözdüğü notlar (skoruyla), kaydettiği notlar ve kendi notları.
// - Arama (q var): görebildiği tüm notlar arasında ders kodu / ders adı / başlık araması; Explore'a gitmeden
//   doğrudan quiz açılabilsin diye sadece metni okunmuş notlar döner.

const PRACTICED_LIMIT = 30;
const SAVED_LIMIT = 40;
const OWN_LIMIT = 30;
const SEARCH_LIMIT = 20;
const PRACTICE_STATUSES: ('ready' | 'pending' | 'processing')[] = ['ready', 'pending', 'processing'];
const SEARCH_FIELDS = ['title', 'courseCode', 'courseName', 'instructorName', 'description'];
const NOTE_FIELDS = 'title courseCode courseName fileType author group visibility ai.status ai.pages';
const AUTHOR_FIELDS = 'fullName avatarUrl';

type Source = 'practiced' | 'saved' | 'mine' | 'search';
type Stats = { _id: mongoose.Types.ObjectId; answered: number; correct: number; lastAt: Date };

const mockMatch = () => (isMock() ? {} : { mock: false });

// Not başına cevaplanan soru, doğru sayısı ve son çalışma zamanı (noteIds verilirse sadece onlar).
const practiceStats = (userId: string, noteIds?: mongoose.Types.ObjectId[]) =>
  QuizAttempt.aggregate<Stats>([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        ...(noteIds ? { note: { $in: noteIds } } : {}),
        ...mockMatch(),
      },
    },
    {
      $group: {
        _id: '$note',
        answered: { $sum: 1 },
        correct: { $sum: { $cond: ['$correct', 1, 0] } },
        lastAt: { $max: '$updatedAt' },
      },
    },
    { $sort: { lastAt: -1 } },
    { $limit: PRACTICED_LIMIT },
  ]);

// Sıralı not kimliklerini kart verisine çevirir: görünürlük kontrolü, skor ve hazır setler.
const describeNotes = async (userId: string, order: string[], sources: Map<string, Set<Source>>, stats: Stats[]) => {
  if (!order.length) return [];
  const orderIds = order.map((id) => new mongoose.Types.ObjectId(id));

  const [notes, sets] = await Promise.all([
    Note.find({ _id: { $in: orderIds }, 'ai.status': { $in: PRACTICE_STATUSES } })
      .select(NOTE_FIELDS)
      .populate('author', AUTHOR_FIELDS)
      .lean(),
    // Daha önce üretilmiş setler anında açılır (bekleme ve hak harcama yok).
    StudySet.find({ note: { $in: orderIds }, ...(isMock() ? {} : { model: { $ne: 'mock' } }) })
      .select('note kind')
      .lean(),
  ]);

  // Silinmiş, görünürlüğü değişmiş (grup / sadece takipçiler) notlar listelenmez.
  const visible = await Promise.all(
    notes.map((note) =>
      assertNoteVisible(note as Parameters<typeof assertNoteVisible>[0], userId).then(
        () => note,
        () => null
      )
    )
  );
  const notesById = new Map(visible.filter((n) => n !== null).map((n) => [String(n._id), n]));
  const statsById = new Map(stats.map((p) => [String(p._id), p]));
  const setKinds = new Map<string, Set<string>>();
  for (const set of sets) {
    const key = String(set.note);
    setKinds.set(key, (setKinds.get(key) ?? new Set()).add(set.kind));
  }

  return order
    .filter((id) => notesById.has(id))
    .map((id) => {
      const note = notesById.get(id)!;
      const stat = statsById.get(id);
      const author = note.author as unknown as { _id: mongoose.Types.ObjectId; fullName: string; avatarUrl?: string } | null;
      return {
        _id: id,
        title: note.title,
        courseCode: note.courseCode,
        courseName: note.courseName,
        fileType: note.fileType,
        author: author ? { _id: author._id, fullName: author.fullName, avatarUrl: author.avatarUrl } : null,
        status: note.ai?.status ?? 'pending',
        pages: note.ai?.pages ?? null,
        sources: [...sources.get(id)!],
        practice: stat ? { answered: stat.answered, correct: stat.correct, lastAt: stat.lastAt } : null,
        ready: { quiz: setKinds.get(id)?.has('quiz') ?? false, flashcards: setKinds.get(id)?.has('flashcards') ?? false },
      };
    });
};

const buildPracticeList = async (userId: string) => {
  const [practiced, me, ownNotes] = await Promise.all([
    practiceStats(userId),
    User.findById(userId).select('savedNotes').lean(),
    Note.find({ author: new mongoose.Types.ObjectId(userId), 'ai.status': { $in: PRACTICE_STATUSES } })
      .sort({ createdAt: -1 })
      .limit(OWN_LIMIT)
      .select('_id')
      .lean(),
  ]);

  // Son kaydedilenler önce (dizinin sonuna ekleniyor).
  const savedIds = [...(me?.savedNotes ?? [])].reverse().slice(0, SAVED_LIMIT);

  // Her not ilk geldiği kaynakta listelenir; diğer kaynaklar etiket olarak eklenir.
  const order: string[] = [];
  const sources = new Map<string, Set<Source>>();
  const add = (id: mongoose.Types.ObjectId, source: Source) => {
    const key = String(id);
    if (!sources.has(key)) {
      sources.set(key, new Set());
      order.push(key);
    }
    sources.get(key)!.add(source);
  };
  practiced.forEach((p) => add(p._id, 'practiced'));
  savedIds.forEach((id) => add(id, 'saved'));
  ownNotes.forEach((n) => add(n._id, 'mine'));

  return { notes: await describeNotes(userId, order, sources, practiced) };
};

// Ders kodu / ders adı / başlık araması; her kelime bu alanlardan birinde geçmelidir.
const searchPracticeNotes = async (userId: string, q: string) => {
  const words = wordSearchMatch(q, SEARCH_FIELDS);
  if (!words) return { notes: [] };
  const me = await User.findById(userId).select('following').lean();
  const found = await Note.aggregate<{ _id: mongoose.Types.ObjectId }>([
    { $match: { $and: [words, visibleNotesMatch(userId, me?.following ?? []), { 'ai.status': 'ready' }] } },
    { $sort: { createdAt: -1 } },
    { $limit: SEARCH_LIMIT },
    { $project: { _id: 1 } },
  ]);

  const ids = found.map((n) => n._id);
  const order = ids.map(String);
  const sources = new Map(order.map((id) => [id, new Set<Source>(['search'])]));
  const stats = ids.length ? await practiceStats(userId, ids) : [];
  return { notes: await describeNotes(userId, order, sources, stats) };
};

export { buildPracticeList, searchPracticeNotes };
