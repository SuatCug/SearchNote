import mongoose from 'mongoose';
import asyncHandler, { type AuthedRequest } from '../utils/asyncHandler.ts';
import ApiError from '../utils/apiError.ts';
import { Note, User } from '../models/index.ts';
import { listNotes, assertNoteVisible, PUBLIC_NOTES_MATCH } from '../services/note.service.ts';
import { assertMember, recordGroupActivity } from '../services/group.service.ts';
import { notify, removeNotification } from '../services/notification.service.ts';
import { pushGroupNote } from '../services/push.service.ts';
import { saveNoteFile, readNoteFile, removeFile } from '../services/storage.service.ts';
import { parsePagination, buildPagination } from '../utils/pagination.util.ts';
import { containsRegex, exactRegex, splitSearchWords, toTurkishInsensitive, wordSearchMatch } from '../utils/regex.util.ts';
import { NOTE_FILE_TYPES, getExtension, matchesSignature } from '../utils/fileTypes.util.ts';
import { createCache } from '../utils/memoryCache.util.ts';
import type { NoteDocument } from '../models/note.model.ts';

// Filtre seçenekleri ve popüler dersler her istekte tüm genel notları tarar ama nadiren değişir:
// sonuç birkaç dakika bellekte tutulur (yeni bir okul / ders en geç bu süre sonunda listelerde görünür).
const SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000;
const filterOptionsCache = createCache<object>({ ttlMs: SUMMARY_CACHE_TTL_MS });
const trendingCoursesCache = createCache<object[]>({ ttlMs: SUMMARY_CACHE_TTL_MS, maxEntries: 1 });

const USER_CARD_FIELDS = 'fullName avatarUrl university department';
const EDITABLE_FIELDS = [
  'title',
  'description',
  'university',
  'department',
  'courseCode',
  'courseName',
  'instructorName',
  'semester',
  'visibility',
];

const NOTE_SEARCH_FIELDS = [
  'title',
  'courseName',
  'courseCode',
  'instructorName',
  'description',
  'university',
  'department',
  'semester',
];

// Query parametrelerinden MongoDB filtre objesi üretir.
// q: kelime bazlı arama — her kelime not alanlarından birinde ya da yazarın adında geçmelidir.
const buildSearchMatch = async (query: Record<string, unknown>) => {
  const match: Record<string, unknown> = {};
  const str = (key: string) => {
    const value = query[key];
    return typeof value === 'string' && value.trim() ? value : null;
  };

  const university = str('university');
  const department = str('department');
  const courseCode = str('courseCode');
  const courseName = str('courseName');
  const instructorName = str('instructorName');
  const semester = str('semester');
  const fileType = str('fileType');
  if (university) match.university = exactRegex(university);
  if (department) match.department = exactRegex(department);
  if (courseCode) match.courseCode = containsRegex(courseCode.replace(/\s+/g, ''));
  if (courseName) match.courseName = containsRegex(courseName);
  if (instructorName) match.instructorName = containsRegex(instructorName);
  if (semester) match.semester = containsRegex(semester);
  if (fileType) match.fileType = fileType;

  const words = splitSearchWords(query.q);
  if (!words.length) return match;

  // Her kelime için adı eşleşen yazarlar (örn. "elif" -> Elif'in notları).
  const authorIdsPerWord = await Promise.all(
    words.map((word) => User.find({ fullName: containsRegex(word) }).distinct('_id'))
  );
  const qMatch = wordSearchMatch(query.q, NOTE_SEARCH_FIELDS, (_word, i) =>
    authorIdsPerWord[i].length ? [{ author: { $in: authorIdsPerWord[i] } }] : []
  );

  return { $and: [match, qMatch] };
};

// Not detay görünümü: beğeni dizisi yerine sayı + "ben beğendim mi" bilgisi döndürülür.
const toNoteDetail = (note: NoteDocument, viewerId: string | undefined) => {
  // fileUrl depolama konumudur, istemciye gönderilmez.
  const { likes, fileUrl, __v, ...rest } = note.toObject();
  return {
    ...rest,
    likesCount: likes.length,
    commentsCount: rest.comments.length,
    isLiked: viewerId ? likes.some((id) => id.equals(viewerId)) : false,
    isOwner: viewerId ? Boolean(note.author?._id.equals(viewerId)) : false,
  };
};

const findNoteOrFail = async (id: string, select?: string) => {
  const query = Note.findById(id);
  if (select) query.select(select);
  const note = await query;
  if (!note) throw new ApiError(404, 'Note not found.');
  return note;
};

const assertOwner = (note: NoteDocument, userId: string) => {
  if (!note.author.equals(userId)) {
    throw new ApiError(403, 'You are not allowed to perform this action.');
  }
};

const searchNotes = asyncHandler(async (req, res) => {
  const data = await listNotes({
    match: await buildSearchMatch(req.query),
    sort: req.query.sort,
    ...parsePagination(req.query),
    viewerId: req.user?.id,
  });

  res.json({ success: true, data });
});

// Takip edilen kullanıcıların notlarından oluşan akış.
const getFeed = asyncHandler<AuthedRequest>(async (req, res) => {
  const me = await User.findById(req.user.id).select('following');
  if (!me) throw new ApiError(404, 'User not found.');

  const data = await listNotes({
    match: { author: { $in: me.following } },
    sort: 'newest',
    ...parsePagination(req.query),
    viewerId: req.user.id,
  });

  res.json({ success: true, data });
});

// Arama sayfasındaki filtre açılır listeleri için mevcut değerler.
const getFilterOptions = asyncHandler(async (req, res) => {
  const university = req.query.university ? String(req.query.university) : '';
  // Bölüm listesi seçilen okula göre değişir; aynı okulun farklı yazımları (büyük/küçük harf, İ/i, ı/I) aynı anahtara düşer.
  const data = await filterOptionsCache(toTurkishInsensitive(university.toLocaleLowerCase('tr')), async () => {
    // Filtre seçenekleri sadece genel (grupsuz) notlardan üretilir.
    const departmentFilter = {
      ...PUBLIC_NOTES_MATCH,
      ...(university && { university: exactRegex(university) }),
    };

    const [universities, departments, semesters] = await Promise.all([
      Note.distinct('university', PUBLIC_NOTES_MATCH),
      Note.distinct('department', departmentFilter),
      Note.distinct('semester', PUBLIC_NOTES_MATCH),
    ]);

    const sortTr = (arr: (string | null | undefined)[]) =>
      arr.filter((v): v is string => Boolean(v)).sort((a, b) => a.localeCompare(b, 'tr'));

    return {
      universities: sortTr(universities),
      departments: sortTr(departments),
      semesters: sortTr(semesters).reverse(),
      fileTypes: ['pdf', 'docx', 'image', 'archive'],
    };
  });

  res.json({ success: true, data });
});

const getNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id)
    .populate('author', USER_CARD_FIELDS)
    .populate('comments.user', USER_CARD_FIELDS)
    .populate('group', 'name isPrivate');
  if (!note) throw new ApiError(404, 'Note not found.');
  await assertNoteVisible(note, req.user?.id);

  const viewer = req.user && (await User.findById(req.user.id).select('savedNotes').lean());
  const isSaved = Boolean(viewer?.savedNotes?.some((id) => id.equals(note._id)));

  res.json({ success: true, data: { note: { ...toNoteDetail(note, req.user?.id), isSaved } } });
});

const createNote = asyncHandler<AuthedRequest>(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'A file is required (form field: file).');

  const ext = getExtension(req.file.originalname);
  if (!matchesSignature(req.file.buffer, ext)) {
    throw new ApiError(415, 'The file content does not match its extension.');
  }

  // Üniversite / bölüm gönderilmezse kullanıcının profilindeki değerler kullanılır.
  const author = await User.findById(req.user.id).select('university department');
  if (!author) throw new ApiError(404, 'User not found.');
  const fields = Object.fromEntries(EDITABLE_FIELDS.filter((f) => req.body[f] !== undefined).map((f) => [f, req.body[f]]));
  // Gruba paylaşım sadece o grubun üyelerine açık.
  if (req.body.group) await assertMember(req.body.group, req.user.id);

  const fileUrl = await saveNoteFile(req.file.buffer, ext);

  let note;
  try {
    note = await Note.create({
      university: author.university,
      department: author.department,
      ...fields,
      author: req.user.id,
      group: req.body.group || undefined,
      // Gruba paylaşılan notun görünürlüğünü grup belirler.
      ...(req.body.group && { visibility: 'public' }),
      fileUrl,
      originalName: req.file.originalname,
      fileType: NOTE_FILE_TYPES[ext],
      fileSize: req.file.size,
    });
  } catch (error) {
    // Kayıt başarısız olursa diske yazılan dosya sahipsiz kalmasın.
    await removeFile(fileUrl);
    throw error;
  }

  await note.populate([
    { path: 'author', select: USER_CARD_FIELDS },
    { path: 'group', select: 'name isPrivate' },
  ]);
  // Gruba paylaşılan not, üyelerin "Gruplarım" listesinde son hareket olarak görünür.
  if (req.body.group) {
    await recordGroupActivity(req.body.group, req.user.id, note.createdAt);
    // Uygulaması kapalı üyelere telefon bildirimi (beklenmez)
    pushGroupNote(req.body.group, req.user.id, note.title).catch((e) =>
      console.error('Push error:', (e as Error).message)
    );
  }

  res.status(201).json({
    success: true,
    message: 'Note uploaded.',
    data: { note: toNoteDetail(note, req.user.id) },
  });
});

const updateNote = asyncHandler<AuthedRequest>(async (req, res) => {
  const note = await findNoteOrFail(req.params.id);
  assertOwner(note, req.user.id);

  EDITABLE_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) note.set(field, req.body[field]);
  });
  await note.save();

  await note.populate([
    { path: 'author', select: USER_CARD_FIELDS },
    { path: 'comments.user', select: USER_CARD_FIELDS },
    { path: 'group', select: 'name isPrivate' },
  ]);

  res.json({ success: true, message: 'Note updated.', data: { note: toNoteDetail(note, req.user.id) } });
});

const deleteNote = asyncHandler<AuthedRequest>(async (req, res) => {
  const note = await findNoteOrFail(req.params.id, '+fileUrl');
  assertOwner(note, req.user.id);

  await note.deleteOne();
  await removeFile(note.fileUrl);

  res.json({ success: true, message: 'Note deleted.' });
});

const readExistingFile = async (note: { fileUrl: string }) => {
  const buffer = await readNoteFile(note.fileUrl);
  if (!buffer) throw new ApiError(404, 'File not found.');
  return buffer;
};

// Sayfa içi önizleme (sadece PDF ve görseller). İndirme sayacını artırmaz.
const PREVIEW_CONTENT_TYPES: Record<string, string> = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

const previewNote = asyncHandler<AuthedRequest>(async (req, res) => {
  const note = await findNoteOrFail(req.params.id, '+fileUrl');
  await assertNoteVisible(note, req.user.id);
  const contentType = PREVIEW_CONTENT_TYPES[getExtension(note.fileUrl)];
  if (!contentType) throw new ApiError(415, 'Preview is not supported for this file type.');

  const buffer = await readExistingFile(note);
  res.set('Content-Type', contentType);
  res.set('Cache-Control', 'private, max-age=300');
  res.send(buffer);
});

// Kredi/puan sistemi yok: doğrulanmış her kullanıcı sınırsız indirebilir.
const downloadNote = asyncHandler<AuthedRequest>(async (req, res) => {
  const note = await findNoteOrFail(req.params.id, '+fileUrl');
  await assertNoteVisible(note, req.user.id);
  const buffer = await readExistingFile(note);

  await Note.updateOne({ _id: note._id }, { $inc: { downloadsCount: 1 } });

  // Frontend'in Content-Disposition'daki dosya adını okuyabilmesi için.
  res.set('Access-Control-Expose-Headers', 'Content-Disposition');
  res.attachment(note.originalName);
  res.send(buffer);
});

const likeNote = asyncHandler<AuthedRequest>(async (req, res) => {
  const target = await findNoteOrFail(req.params.id, 'group author visibility');
  await assertNoteVisible(target, req.user.id);
  const note = await Note.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { likes: new mongoose.Types.ObjectId(req.user.id) } },
    { returnDocument: 'after' }
  ).select('likes');
  if (!note) throw new ApiError(404, 'Note not found.');
  await notify({ recipient: target.author, actor: req.user.id, type: 'like', note: target._id });

  res.json({ success: true, data: { isLiked: true, likesCount: note.likes.length } });
});

const unlikeNote = asyncHandler<AuthedRequest>(async (req, res) => {
  const note = await Note.findByIdAndUpdate(
    req.params.id,
    { $pull: { likes: new mongoose.Types.ObjectId(req.user.id) } },
    { returnDocument: 'after' }
  ).select('likes author');
  if (!note) throw new ApiError(404, 'Note not found.');
  await removeNotification({ recipient: note.author, actor: req.user.id, type: 'like', note: note._id });

  res.json({ success: true, data: { isLiked: false, likesCount: note.likes.length } });
});

// Notu beğenenler (en yeni beğeni önce). Notu görebilen herkes listeyi görebilir;
// izleyiciyle arasında engelleme olan kullanıcılar listede çıkmaz.
const getNoteLikes = asyncHandler<AuthedRequest>(async (req, res) => {
  const note = await findNoteOrFail(req.params.id, 'group author visibility likes');
  await assertNoteVisible(note, req.user.id);
  const { page, limit, skip } = parsePagination(req.query);

  const [me, blockedMe] = await Promise.all([
    User.findById(req.user.id).select('blockedUsers following').lean(),
    User.find({ _id: { $in: note.likes }, blockedUsers: req.user.id }).select('_id').lean(),
  ]);
  const hidden = new Set([...(me?.blockedUsers ?? []), ...blockedMe.map((u) => u._id)].map(String));
  const likerIds = [...note.likes].reverse().filter((id) => !hidden.has(String(id)));
  const pageIds = likerIds.slice(skip, skip + limit);

  const users = await User.find({ _id: { $in: pageIds } }).select(USER_CARD_FIELDS).lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const following = new Set((me?.following ?? []).map(String));
  const items = pageIds
    .map((id) => byId.get(String(id)))
    .filter((u) => u !== undefined)
    .map((u) => ({ ...u, isFollowing: following.has(String(u._id)), isMe: String(u._id) === req.user.id }));

  res.json({ success: true, data: { items, pagination: buildPagination(page, limit, likerIds.length) } });
});

// Yer imi: kaydedilen notlar sadece kullanıcının kendisine görünür.
const saveNote = asyncHandler<AuthedRequest>(async (req, res) => {
  await assertNoteVisible(await findNoteOrFail(req.params.id, 'group author visibility'), req.user.id);
  await User.updateOne({ _id: req.user.id }, { $addToSet: { savedNotes: req.params.id } });
  res.json({ success: true, data: { isSaved: true } });
});

const unsaveNote = asyncHandler<AuthedRequest>(async (req, res) => {
  await User.updateOne({ _id: req.user.id }, { $pull: { savedNotes: req.params.id } });
  res.json({ success: true, data: { isSaved: false } });
});

const getSavedNotes = asyncHandler<AuthedRequest>(async (req, res) => {
  const me = await User.findById(req.user.id).select('savedNotes');
  if (!me) throw new ApiError(404, 'User not found.');

  const data = await listNotes({
    match: { _id: { $in: me.savedNotes } },
    sort: 'newest',
    ...parsePagination(req.query),
    viewerId: req.user.id,
  });

  res.json({ success: true, data });
});

// Akıştaki "Popular courses" etiketleri: ders kodu (yoksa ders adı) bazında not sayısı + beğeniye göre sıralanır.
const getTrendingCourses = asyncHandler(async (_req, res) => {
  const courses = await trendingCoursesCache('all', () =>
    Note.aggregate([
      { $match: PUBLIC_NOTES_MATCH },
      {
        $group: {
          _id: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$courseCode', ''] } }, 0] }, '$courseCode', '$courseName'] },
          courseCode: { $first: '$courseCode' },
          courseName: { $first: '$courseName' },
          notesCount: { $sum: 1 },
          likesCount: { $sum: { $size: '$likes' } },
        },
      },
      { $addFields: { score: { $add: [{ $multiply: ['$notesCount', 3] }, '$likesCount'] } } },
      { $sort: { score: -1, _id: 1 } },
      { $limit: 10 },
      { $project: { _id: 0, courseCode: 1, courseName: 1, notesCount: 1 } },
    ])
  );

  res.json({ success: true, data: { courses } });
});

export {
  searchNotes,
  getFeed,
  getSavedNotes,
  getTrendingCourses,
  saveNote,
  unsaveNote,
  getFilterOptions,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  previewNote,
  downloadNote,
  likeNote,
  unlikeNote,
  getNoteLikes,
};
