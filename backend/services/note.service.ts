import mongoose from 'mongoose';
import { Note, Group, User } from '../models/index.ts';
import ApiError from '../utils/apiError.ts';
import { buildPagination, type PaginationParams } from '../utils/pagination.util.ts';
import type { MatchFilter, SortSpec } from '../types/common.ts';

const SORT_OPTIONS: Record<string, SortSpec> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  popular: { likesCount: -1, createdAt: -1 },
  downloads: { downloadsCount: -1, createdAt: -1 },
};

// Not listelerinde (arama, akış, profil) ortak kullanılan kart görünümü.
// Beğeni/yorum dizilerinin tamamı yerine sadece sayıları döndürülür.
const cardProjection = (viewerId: string | undefined, savedIds: mongoose.Types.ObjectId[] = []) => ({
  title: 1,
  description: 1,
  university: 1,
  department: 1,
  courseCode: 1,
  courseName: 1,
  instructorName: 1,
  semester: 1,
  originalName: 1,
  fileType: 1,
  visibility: 1,
  fileSize: 1,
  downloadsCount: 1,
  createdAt: 1,
  likesCount: 1,
  commentsCount: { $size: '$comments' },
  isLiked: viewerId ? { $in: [new mongoose.Types.ObjectId(viewerId), '$likes'] } : { $literal: false },
  isSaved: savedIds.length ? { $in: ['$_id', savedIds] } : { $literal: false },
  author: {
    _id: '$author._id',
    fullName: '$author.fullName',
    avatarUrl: '$author.avatarUrl',
    university: '$author.university',
    department: '$author.department',
  },
});

// Genel paylaşım ile grup paylaşımı ayrıdır: gruba paylaşılan notlar ana sayfa, akış, profil ve
// filtrelerde görünmez; sadece grup sayfasında, o grubun üyelerine listelenir.
// (Grup silinince notun group alanı kaldırılır ve not genel paylaşıma döner.)
// Herkese açık notlar: grupsuz ve "sadece takipçiler" olmayanlar (eski kayıtlarda visibility alanı yok = public).
// Filtre seçenekleri, popüler dersler ve genel sayaçlar sadece bunlardan üretilir.
const PUBLIC_NOTES_MATCH = { group: null, visibility: { $ne: 'followers' as const } };

// İzleyicinin görebileceği grupsuz notlar: herkese açık olanlar + kendi notları + takip ettiklerinin
// "sadece takipçiler" notları.
const visibleNotesMatch = (viewerId: string | undefined, following: mongoose.Types.ObjectId[] = []) => ({
  group: null,
  $or: [
    { visibility: { $ne: 'followers' } },
    ...(viewerId ? [{ author: { $in: [new mongoose.Types.ObjectId(viewerId), ...following] } }] : []),
  ],
});

// Tek bir notun izleyiciye görünür olup olmadığını kontrol eder; görünmüyorsa not yokmuş gibi 404 döner.
// Grup notlarını sadece grup üyeleri, "sadece takipçiler" notlarını sadece yazarı takip edenler görebilir;
// notun yazarı her zaman görür.
// note: group, author ve visibility alanları seçilmiş not dokümanı (group/author populate edilmiş olabilir).
// group / author: ObjectId ya da populate edilmiş doküman; ikisinde de _id vardır (ObjectId'nin _id'si kendisidir).
type RefField = { _id: mongoose.Types.ObjectId } | null | undefined;

const assertNoteVisible = async (
  note: { group?: RefField; author?: RefField; visibility?: string | null },
  viewerId: string | undefined
) => {
  const groupId = note.group?._id;
  const followersOnly = !groupId && note.visibility === 'followers';
  if (!groupId && !followersOnly) return;

  const authorId = note.author?._id;
  if (viewerId && authorId?.equals(viewerId)) return;

  const allowed = groupId
    ? viewerId && (await Group.exists({ _id: groupId, members: viewerId }))
    : viewerId && (await User.exists({ _id: viewerId, following: authorId }));
  if (!allowed) throw new ApiError(404, 'Note not found.');
};

// Filtre + sıralama + sayfalama ile not kartlarını ve toplam sayıyı döndürür.
// includeGroupNotes: grup sayfası için (üyelik kontrolü önceden yapılır); aksi halde izleyicinin görebileceği
// grupsuz notlar listelenir (herkese açık + takip ettiklerinin "sadece takipçiler" notları + kendi notları).
// Kartlardaki yer imi durumu ve takipçi görünürlüğü için izleyicinin kaydettikleri ve takip ettikleri.
const loadNoteViewer = (viewerId: string) => User.findById(viewerId).select('savedNotes following').lean();
type NoteViewer = Awaited<ReturnType<typeof loadNoteViewer>>;

interface ListNotesOptions extends PaginationParams {
  match?: MatchFilter;
  sort?: unknown;
  viewerId?: string;
  // Çağıran izleyiciyi zaten okuduysa (örn. akış, takip listesi için) tekrar okunmaz.
  viewer?: NoteViewer;
  includeGroupNotes?: boolean;
}

const listNotes = async ({ match = {}, sort = 'newest', page, limit, skip, viewerId, viewer: knownViewer, includeGroupNotes = false }: ListNotesOptions) => {
  const viewer = knownViewer !== undefined ? knownViewer : viewerId ? await loadNoteViewer(viewerId) : null;
  const savedIds = viewer?.savedNotes ?? [];
  const fullMatch = includeGroupNotes ? match : { $and: [match, visibleNotesMatch(viewerId, viewer?.following)] };
  const [result] = await Note.aggregate([
    { $match: fullMatch },
    { $addFields: { likesCount: { $size: '$likes' } } },
    { $sort: SORT_OPTIONS[String(sort)] || SORT_OPTIONS.newest },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: limit },
          { $lookup: { from: 'users', localField: 'author', foreignField: '_id', as: 'author' } },
          { $unwind: '$author' },
          { $project: cardProjection(viewerId, savedIds) },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  const total = result.total[0]?.count || 0;
  return { items: result.items, pagination: buildPagination(page, limit, total) };
};

// Kişinin not paylaştığı dersler (profildeki "Courses shared" ve ders filtresi): izleyicinin görebildiği
// grupsuz notlardan, ders kodu (yoksa ders adı) başına not sayısı. En son not paylaşılan ders önce.
const listUserCourses = async (authorId: string, viewerId?: string) => {
  const viewer = viewerId ? await User.findById(viewerId).select('following').lean() : null;
  const courses: { code: string; name: string; count: number }[] = await Note.aggregate([
    {
      $match: {
        $and: [{ author: new mongoose.Types.ObjectId(authorId) }, visibleNotesMatch(viewerId, viewer?.following)],
      },
    },
    {
      $addFields: {
        course: {
          $trim: {
            input: {
              $cond: [
                { $gt: [{ $strLenCP: { $ifNull: ['$courseCode', ''] } }, 0] },
                '$courseCode',
                { $ifNull: ['$courseName', ''] },
              ],
            },
          },
        },
      },
    },
    { $match: { course: { $ne: '' } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$course', name: { $first: '$courseName' }, count: { $sum: 1 }, latest: { $first: '$createdAt' } } },
    { $sort: { latest: -1 } },
    { $project: { _id: 0, code: '$_id', name: { $trim: { input: { $ifNull: ['$name', ''] } } }, count: 1 } },
  ]);
  return courses;
};

export { listNotes, loadNoteViewer, listUserCourses, assertNoteVisible, PUBLIC_NOTES_MATCH, SORT_OPTIONS };
