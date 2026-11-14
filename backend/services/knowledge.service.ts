import mongoose from 'mongoose';
import { Note, QuizAttempt, StudySet, Topic } from '../models/index.ts';
import ApiError from '../utils/apiError.ts';
import { isMock, type QuizItem, type TopicInfo } from './ai.service.ts';

// Kişisel bilgi haritası: öğrencinin quiz cevaplarından konu başına doğru / toplam hesaplanır, konular arasındaki
// ön koşul bağları (quiz üretilirken çıkarılır) grafik olarak döner. Zorlanılan konular için temel eksik varsa
// ("Türev'de zorlanıyorsun çünkü Fonksiyonlar zayıf") söylenir ve o konuyu anlatan notlar önerilir.
// Teşhis kural tabanlıdır (yapay zekâ çağrısı yok), not önerisi içerik aramasını kullanır (ücretsiz).

const normalizeTopic = (name: string) => name.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();

// Deneme modunda gerçek ve deneme verisi birlikte görünür; gerçek modda deneme verisi hiç görünmez.
const mockFilter = () => (isMock() ? {} : { mock: false });

// Quiz üretildikten sonra notun konuları ve ön koşulları grafiğe eklenir.
const saveQuizTopics = async (topics: TopicInfo[], questions: QuizItem[], course: string | undefined, mock: boolean) => {
  const names = new Map<string, string>();
  const prereqs = new Map<string, Set<string>>();
  const add = (name: string) => {
    const key = normalizeTopic(name);
    if (!key) return '';
    if (!names.has(key)) names.set(key, name.trim());
    if (!prereqs.has(key)) prereqs.set(key, new Set());
    return key;
  };
  for (const t of topics) {
    const key = add(t.name);
    for (const p of t.prerequisites) {
      const pk = add(p);
      if (key && pk && pk !== key) prereqs.get(key)!.add(pk);
    }
  }
  questions.forEach((q) => add(q.topic));

  const courseUpdate = course ? { $addToSet: { courses: course } } : {};
  await Promise.all(
    [...names].map(([key, name]) =>
      Topic.updateOne(
        { key, mock },
        {
          $setOnInsert: { name },
          ...courseUpdate,
          ...(prereqs.get(key)!.size && {
            $addToSet: { ...(course && { courses: course }), prerequisites: { $each: [...prereqs.get(key)!] } },
          }),
        },
        { upsert: true }
      )
    )
  );
};

// Konu pratiği sorularının cevapları aynı koleksiyonda, soru sırası bu kadar kaydırılarak tutulur
// (notun quiz'iyle çakışmasın diye; notun quiz'i ~10 soru, konu pratiği turlarla en fazla ~200 soru).
const TOPIC_QUIZ_INDEX_OFFSET = 100;
// "Questions from the note" cevapları: quiz (0–99) ve konu pratiği (100+) sıralarıyla çakışmasın diye.
const NOTE_QUIZ_INDEX_OFFSET = 10_000;

// Quiz cevabı kaydedilir; doğruluk sunucuda, kayıtlı setten hesaplanır.
const recordQuizAnswer = async ({
  userId,
  noteId,
  index,
  choice,
  kind = 'quiz',
}: {
  userId: string;
  noteId: string;
  index: number;
  choice: number;
  kind?: 'quiz' | 'note-quiz' | 'topic-quiz';
}) => {
  const set = await StudySet.findOne({ note: noteId, kind }).lean();
  const question = set?.items?.[index] as QuizItem | undefined;
  if (!set || !question) throw new ApiError(404, 'Question not found.');
  const correct = choice === question.answerIndex;
  const topic = question.topic?.trim() || 'General';
  await QuizAttempt.updateOne(
    {
      user: userId,
      note: noteId,
      questionIndex:
        kind === 'topic-quiz' ? TOPIC_QUIZ_INDEX_OFFSET + index : kind === 'note-quiz' ? NOTE_QUIZ_INDEX_OFFSET + index : index,
      mock: set.model === 'mock',
    },
    { $set: { topicKey: normalizeTopic(topic), topic, correct } },
    { upsert: true }
  );
  return { correct, answerIndex: question.answerIndex };
};

type Status = 'strong' | 'learning' | 'weak' | 'untested';

const statusOf = (correct: number, total: number): Status => {
  if (!total) return 'untested';
  const ratio = correct / total;
  if (ratio < 0.5) return 'weak';
  if (ratio >= 0.75 && total >= 2) return 'strong';
  return 'learning';
};

const MAX_NODES = 40;
const MAX_FOCUS = 4;

const buildKnowledgeMap = async (userId: string) => {
  const stats: { _id: string; topic: string; correct: number; total: number; notes: mongoose.Types.ObjectId[] }[] =
    await QuizAttempt.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), ...mockFilter() } },
      { $sort: { updatedAt: -1 } },
      {
        $group: {
          _id: '$topicKey',
          topic: { $first: '$topic' },
          correct: { $sum: { $cond: ['$correct', 1, 0] } },
          total: { $sum: 1 },
          notes: { $addToSet: '$note' },
        },
      },
    ]);

  if (!stats.length) return { nodes: [], edges: [], focus: [], totals: { answered: 0, topics: 0 } };

  // Çalışılan konular + ön koşulları (iki adım geriye kadar: Türev -> Fonksiyonlar -> Kümeler).
  const keys = new Set(stats.map((s) => s._id));
  const topicDocs = new Map<string, { name: string; prerequisites: string[] }>();
  let frontier = [...keys];
  for (let depth = 0; depth < 3 && frontier.length; depth++) {
    const docs = await Topic.find({ key: { $in: frontier }, ...mockFilter() }).select('key name prerequisites').lean();
    const next: string[] = [];
    for (const doc of docs) {
      const existing = topicDocs.get(doc.key);
      // Deneme modunda aynı konu hem gerçek hem deneme kaydında olabilir: ön koşullar birleştirilir.
      topicDocs.set(doc.key, {
        name: existing?.name ?? doc.name,
        prerequisites: [...new Set([...(existing?.prerequisites ?? []), ...doc.prerequisites])],
      });
      if (depth < 2) {
        for (const p of doc.prerequisites) {
          if (!keys.has(p) && keys.size < MAX_NODES) {
            keys.add(p);
            next.push(p);
          }
        }
      }
    }
    frontier = next;
  }

  const statsByKey = new Map(stats.map((s) => [s._id, s]));
  // Konunun hangi dersten geldiği (sorularının çıktığı notların ders kodu ve adı); kartlarda konu adının altında yazar.
  const practicedNoteIds = [...new Set(stats.flatMap((s) => s.notes.map(String)))];
  const courseByNote = new Map(
    (await Note.find({ _id: { $in: practicedNoteIds } }).select('courseCode courseName').lean()).map((n) => {
      const code = n.courseCode?.trim();
      const name = n.courseName?.trim();
      const label = code && name && name !== code ? `${code} – ${name}` : code || name || '';
      return [String(n._id), label];
    })
  );
  const coursesOf = (key: string) => [
    ...new Set(
      (statsByKey.get(key)?.notes ?? []).map((id) => courseByNote.get(String(id)) ?? '').filter(Boolean)
    ),
  ];
  const nodes = [...keys].map((key) => {
    const s = statsByKey.get(key);
    return {
      key,
      name: s?.topic ?? topicDocs.get(key)?.name ?? key,
      correct: s?.correct ?? 0,
      total: s?.total ?? 0,
      status: statusOf(s?.correct ?? 0, s?.total ?? 0),
      // Hiç çalışılmamış ön koşul konularda boş.
      courses: coursesOf(key),
    };
  });
  const nodesByKey = new Map(nodes.map((n) => [n.key, n]));
  const edges = [...keys].flatMap((key) =>
    (topicDocs.get(key)?.prerequisites ?? []).filter((p) => keys.has(p) && p !== key).map((p) => ({ from: p, to: key }))
  );

  // Odak: zorlanılan konular ve henüz oturmamış olanlar (%75 altı); oranı en düşük, eşitse daha çok çözülmüş önce.
  const weakest = nodes
    .filter((n) => n.status === 'weak' || (n.status === 'learning' && n.correct / n.total < 0.75))
    .sort((a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total)
    .slice(0, MAX_FOCUS);

  const focus = await Promise.all(
    weakest.map(async (node) => {
      const prereqNodes = (topicDocs.get(node.key)?.prerequisites ?? [])
        .map((p) => nodesByKey.get(p))
        .filter((p) => p !== undefined);
      const weakPrereq = prereqNodes.find((p) => p.status === 'weak');
      const untestedPrereq = prereqNodes.find((p) => p.status === 'untested');
      const foundation = weakPrereq ?? untestedPrereq ?? null;
      const score = `${node.correct}/${node.total} correct`;
      const lead = node.status === 'weak' ? `You’re struggling with ${node.name}` : `You’re getting there with ${node.name}`;
      const message = weakPrereq
        ? `${lead} because your ${weakPrereq.name} foundation is weak (${weakPrereq.correct}/${weakPrereq.total} correct). Start there.`
        : untestedPrereq
          ? `${lead} (${score}). It builds on ${untestedPrereq.name}, which you haven’t practiced yet — review it first.`
          : node.status === 'weak'
            ? `${lead} (${score}). Go over these notes again.`
            : `${lead} (${score}). One more pass should do it.`;

      // Önce eksik temeli, sonra konunun kendisini anlatan notlar (izleyicinin görebildikleri).
      return {
        topic: node.key,
        name: node.name,
        status: node.status,
        message,
        foundation: foundation ? { key: foundation.key, name: foundation.name } : null,
        recommendedFor: (foundation ?? node).name,
        courses: coursesOf(node.key),
      };
    })
  );

  return {
    nodes,
    edges,
    focus,
    totals: { answered: stats.reduce((sum, s) => sum + s.total, 0), topics: stats.length },
  };
};

export { normalizeTopic, saveQuizTopics, recordQuizAnswer, buildKnowledgeMap, TOPIC_QUIZ_INDEX_OFFSET, NOTE_QUIZ_INDEX_OFFSET };
