import mongoose, { type PipelineStage } from 'mongoose';
import { Group, GroupMessage, Note, Notification, User } from '../models/index.ts';
import { emitToUsers } from './realtime.service.ts';
import { removeFile } from './storage.service.ts';
import type { GroupDocument } from '../models/group.model.ts';
import { isMuteActive } from '../models/user.model.ts';
import ApiError from '../utils/apiError.ts';
import { buildPagination, type PaginationParams } from '../utils/pagination.util.ts';
import type { IdLike, MatchFilter, SortSpec } from '../types/common.ts';

const GROUP_SORT_OPTIONS: Record<string, SortSpec> = {
  newest: { createdAt: -1 },
  popular: { membersCount: -1, createdAt: -1 },
  notes: { notesCount: -1, membersCount: -1, createdAt: -1 },
};

// Kullanıcının favori grupları (alan yoksa boş).
const favoriteGroupIds = async (userId: string | undefined) => {
  if (!userId) return [];
  // Sadece bu alan okunur ('+favoriteGroups' tüm kaydı, takipçi listeleriyle birlikte getirirdi).
  const user = await User.findById(userId).select('favoriteGroups').lean();
  return user?.favoriteGroups ?? [];
};

// Kullanıcının şu an sessizde olan grupları: grup id → bitiş zamanı (null = süresiz). Süresi dolanlar sayılmaz.
const mutedGroupsOf = async (userId: string | undefined) => {
  const muted = new Map<string, Date | null>();
  if (!userId) return muted;
  const user = await User.findById(userId).select('mutedGroups').lean();
  for (const m of user?.mutedGroups ?? []) {
    if (isMuteActive(m)) muted.set(String(m.group), m.until ?? null);
  }
  return muted;
};

// Grup detayı ve Gruplar listesinde izleyicinin sessize alma durumu
const muteFields = (muted: Map<string, Date | null>, groupId: IdLike) => {
  const id = String(groupId);
  return { isMuted: muted.has(id), mutedUntil: muted.get(id) ?? null };
};

// Grubun not sayısı ve en son paylaşılan not (kartlarda "Latest: ..." satırı).
const notesLookup: PipelineStage.Lookup = {
  $lookup: {
    from: 'notes',
    localField: '_id',
    foreignField: 'group',
    pipeline: [
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          title: { $first: '$title' },
          fileType: { $first: '$fileType' },
          createdAt: { $first: '$createdAt' },
        },
      },
    ],
    as: 'notes',
  },
};

// Grup listelerinde (keşfet, gruplarım) ortak kullanılan kart görünümü.
// Üye dizisinin tamamı yerine sayı + "üye miyim" bilgisi döndürülür.
// Eski kayıtlarda bazı dizi alanları (örn. joinRequests) olmayabilir; $ifNull ile boş dizi sayılır.
const cardProjection = (viewerId: string | undefined, favorites: unknown[]) => {
  const isMember = viewerId
    ? { $in: [new mongoose.Types.ObjectId(viewerId), { $ifNull: ['$members', []] }] }
    : { $literal: false };
  const latest = { $arrayElemAt: ['$notes', 0] };
  return {
    name: 1,
    description: 1,
    isPrivate: 1,
    createdAt: 1,
    courseCode: 1,
    university: 1,
    // Son hareket zamanı (içerik değil): kartlarda 'Active 2 h ago'
    lastActivityAt: 1,
    color: { $ifNull: ['$color', 'navy'] },
    avatarUrl: { $ifNull: ['$avatarUrl', ''] },
    membersCount: 1,
    notesCount: { $ifNull: [{ $arrayElemAt: ['$notes.count', 0] }, 0] },
    // Grubun son notu (adı dahil) sadece üyelere görünür; grup herkese açık olsa da
    lastNote: {
      $cond: [
        { $and: [{ $gt: [{ $size: '$notes' }, 0] }, isMember] },
        { $let: { vars: { n: latest }, in: { title: '$$n.title', fileType: '$$n.fileType', createdAt: '$$n.createdAt' } } },
        null,
      ],
    },
    isMember,
    isPending: viewerId ? { $in: [new mongoose.Types.ObjectId(viewerId), { $ifNull: ['$joinRequests', []] }] } : { $literal: false },
    isFavorite: { $in: ['$_id', favorites] },
    owner: {
      _id: '$owner._id',
      fullName: '$owner.fullName',
      avatarUrl: '$owner.avatarUrl',
    },
  };
};

// Filtre + sıralama + sayfalama ile grup kartlarını ve toplam sayıyı döndürür.
interface ListGroupsOptions extends PaginationParams {
  match?: MatchFilter;
  sort?: unknown;
  viewerId?: string;
}

const listGroups = async ({ match = {}, sort = 'newest', page, limit, skip, viewerId }: ListGroupsOptions) => {
  const favorites = await favoriteGroupIds(viewerId);
  // "En çok not" sıralamasında not sayısı sıralamadan önce gerekir; diğerlerinde sadece sayfadaki gruplar için bakılır
  const byNotes = sort === 'notes';
  const [result] = await Group.aggregate([
    { $match: match },
    { $addFields: { membersCount: { $size: { $ifNull: ['$members', []] } } } },
    ...(byNotes ? [notesLookup, { $addFields: { notesCount: { $ifNull: [{ $arrayElemAt: ['$notes.count', 0] }, 0] } } }] : []),
    { $sort: GROUP_SORT_OPTIONS[String(sort)] || GROUP_SORT_OPTIONS.newest },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: limit },
          { $lookup: { from: 'users', localField: 'owner', foreignField: '_id', as: 'owner' } },
          { $unwind: '$owner' },
          ...(byNotes ? [] : [notesLookup]),
          { $project: cardProjection(viewerId, favorites) },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  const total = result.total[0]?.count || 0;
  return { items: result.items, pagination: buildPagination(page, limit, total) };
};

// Bir gruba not paylaşabilmek için kullanıcının o grubun üyesi olması gerekir.
const assertMember = async (groupId: IdLike, userId: IdLike) => {
  const isMember = await Group.exists({ _id: groupId, members: userId });
  if (!isMember) throw new ApiError(403, 'You must be a member of the group to share notes in it.');
};

// Grupta yeni mesaj / not: grubun son aktivite zamanı ilerler, yapan kişi için grup okunmuş sayılır
// ve üyelerin "Gruplarım" listesi yenilensin diye hepsine haber verilir.
const recordGroupActivity = async (groupId: IdLike, actorId: IdLike, at: Date) => {
  const group = await Group.findByIdAndUpdate(
    groupId,
    { $max: { lastActivityAt: at, [`lastReadAt.${actorId}`]: at } },
    { projection: { members: 1 } }
  ).lean();
  if (group) emitToUsers(group.members, 'group:activity', { groupId: String(groupId) });
};

// Kullanıcı grup sohbetini açtı: o ana kadarki mesajlar okunmuş sayılır.
const markGroupRead = (groupId: IdLike, userId: IdLike) =>
  Group.updateOne({ _id: groupId }, { $set: { [`lastReadAt.${userId}`]: new Date() } });

const UNREAD_CAP = 99;

// "Gruplarım" sohbet listesi gibi: her grubun son hareketi (mesaj ya da paylaşılan not), okunmamış mesaj
// sayısı; en son hareket eden grup en üstte. Sohbeti hiç açılmamış (eski) gruplar okunmamış gösterilmez.
const listMyGroupActivity = async (userId: string) => {
  const me = new mongoose.Types.ObjectId(userId);
  const groups = await Group.find({ members: me })
    .select('name isPrivate owner founders admins members lastReadAt lastActivityAt createdAt color courseCode avatarUrl')
    .lean();
  if (!groups.length) return [];
  const [favoriteIds, muted] = await Promise.all([favoriteGroupIds(userId), mutedGroupsOf(userId)]);
  const favorites = new Set(favoriteIds.map(String));
  const ids = groups.map((g) => g._id);
  const readAtOf = (g: (typeof groups)[number]) => {
    const map = g.lastReadAt as unknown as Record<string, Date> | Map<string, Date> | undefined;
    return (map instanceof Map ? map.get(userId) : map?.[userId]) ?? null;
  };
  const unreadClauses = groups
    .map((g) => ({ group: g._id, readAt: readAtOf(g) }))
    .filter((x): x is { group: typeof x.group; readAt: Date } => Boolean(x.readAt))
    .map((x) => ({ group: x.group, createdAt: { $gt: x.readAt } }));

  const [lastMessages, lastNotes, unread] = await Promise.all([
    GroupMessage.aggregate([
      { $match: { group: { $in: ids } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$group', text: { $first: '$text' }, user: { $first: '$user' }, createdAt: { $first: '$createdAt' } } },
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user', pipeline: [{ $project: { fullName: 1 } }] } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    ]),
    Note.aggregate([
      { $match: { group: { $in: ids } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$group', title: { $first: '$title' }, user: { $first: '$author' }, createdAt: { $first: '$createdAt' }, count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user', pipeline: [{ $project: { fullName: 1 } }] } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    ]),
    unreadClauses.length
      ? GroupMessage.aggregate([
          { $match: { user: { $ne: me }, $or: unreadClauses } },
          { $group: { _id: '$group', count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
  ]);

  const byGroup = <T extends { _id: unknown }>(rows: T[]) => new Map(rows.map((r) => [String(r._id), r]));
  const messageMap = byGroup(lastMessages);
  const noteMap = byGroup(lastNotes);
  const unreadMap = byGroup(unread as { _id: unknown; count: number }[]);

  const items = groups.map((g) => {
    const id = String(g._id);
    const message = messageMap.get(id);
    const note = noteMap.get(id);
    // Not mesajdan yeniyse son hareket "X bir not paylaştı" olur
    const useNote = note && (!message || note.createdAt > message.createdAt);
    const latest = useNote ? note : message;
    const lastActivity = latest
      ? {
          type: useNote ? 'note' : 'message',
          text: useNote ? note.title : message.text,
          userName: latest.user?.fullName ?? null,
          isMine: latest.user ? String(latest.user._id) === userId : false,
          createdAt: latest.createdAt,
        }
      : null;
    return {
      _id: g._id,
      name: g.name,
      isPrivate: g.isPrivate,
      color: g.color ?? 'navy',
      courseCode: g.courseCode,
      avatarUrl: g.avatarUrl ?? '',
      isFavorite: favorites.has(id),
      ...muteFields(muted, id),
      isOwner: String(g.owner) === userId || (g.founders ?? []).some((id) => String(id) === userId),
      isAdmin: (g.admins ?? []).some((id) => String(id) === userId),
      membersCount: g.members?.length ?? 0,
      notesCount: note?.count ?? 0,
      lastActivity,
      unreadCount: Math.min(unreadMap.get(id)?.count ?? 0, UNREAD_CAP),
      activityAt: lastActivity?.createdAt ?? g.createdAt,
    };
  });

  return items.sort((a, b) => new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime());
};

// Kullanıcının takip ettiği ve verilen gruplara üye olan kişiler (en fazla 3'ü) + toplam sayıları.
const followedMembersFor = async (viewerId: string | undefined, groupIds: unknown[]) => {
  const result = new Map<string, { users: { _id: unknown; fullName: string; avatarUrl?: string }[]; count: number }>();
  if (!viewerId || !groupIds.length) return result;
  const viewer = await User.findById(viewerId).select('following').lean();
  const following = viewer?.following ?? [];
  if (!following.length) return result;
  const rows = await Group.aggregate([
    { $match: { _id: { $in: groupIds } } },
    { $project: { followed: { $setIntersection: [{ $ifNull: ['$members', []] }, following] } } },
    { $match: { 'followed.0': { $exists: true } } },
    { $project: { count: { $size: '$followed' }, preview: { $slice: ['$followed', 3] } } },
    { $lookup: { from: 'users', localField: 'preview', foreignField: '_id', as: 'users', pipeline: [{ $project: { fullName: 1, avatarUrl: 1 } }] } },
  ]);
  rows.forEach((r) => result.set(String(r._id), { users: r.users, count: r.count }));
  return result;
};

const REQUEST_USER_FIELDS = 'fullName avatarUrl university department';

type RequestInfo = { message?: string; createdAt?: Date };

const requestInfoOf = (g: { requestInfo?: unknown }, userId: string) => {
  const map = g.requestInfo as Record<string, RequestInfo> | Map<string, RequestInfo> | undefined;
  const info = map instanceof Map ? map.get(userId) : map?.[userId];
  return { message: info?.message ?? '', createdAt: info?.createdAt ?? null };
};

const groupSummary = (g: {
  _id: unknown;
  name: string;
  color?: string;
  courseCode?: string;
  avatarUrl?: string;
  isPrivate: boolean;
}) => ({
  _id: g._id,
  name: g.name,
  color: g.color ?? 'navy',
  courseCode: g.courseCode,
  avatarUrl: g.avatarUrl ?? '',
  isPrivate: g.isPrivate,
});

const newestFirst = (a: { createdAt: Date | null }, b: { createdAt: Date | null }) =>
  (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0);

// Kurucusu veya yöneticisi olduğum gruplara gelen bekleyen katılma istekleri, en yenisi üstte.
const listIncomingRequests = async (userId: string) => {
  const groups = await Group.find({ $or: [{ owner: userId }, { founders: userId }, { admins: userId }], 'joinRequests.0': { $exists: true } })
    .select('name color courseCode avatarUrl isPrivate joinRequests requestInfo')
    .populate<{ joinRequests: { _id: unknown; fullName: string }[] }>('joinRequests', REQUEST_USER_FIELDS)
    .lean();
  return groups
    .flatMap((g) => g.joinRequests.map((user) => ({ group: groupSummary(g), user, ...requestInfoOf(g, String(user._id)) })))
    .sort(newestFirst);
};

// Benim gönderdiğim, hâlâ bekleyen katılma istekleri.
const listSentRequests = async (userId: string) => {
  const groups = await Group.find({ joinRequests: new mongoose.Types.ObjectId(userId) })
    .select('name color courseCode avatarUrl isPrivate members requestInfo')
    .lean();
  return groups
    .map((g) => ({ group: { ...groupSummary(g), membersCount: g.members?.length ?? 0 }, ...requestInfoOf(g, userId) }))
    .sort(newestFirst);
};

// Grubu içeriğiyle birlikte siler: gruba paylaşılan notlar (dosyalarıyla) ve sohbet mesajları da gider.
// Notlar gruptan ayrılıp bırakılmaz; aksi halde grup notları (görünürlüğü 'public') herkese açık hale gelirdi.
const deleteGroupWithContent = async (group: GroupDocument) => {
  const notes = await Note.find({ group: group._id }).select('+fileUrl').lean();
  const noteIds = notes.map((n) => n._id);

  await group.deleteOne();
  await Promise.all([
    Note.deleteMany({ _id: { $in: noteIds } }),
    GroupMessage.deleteMany({ group: group._id }),
    User.updateMany(
      { $or: [{ favoriteGroups: group._id }, { 'mutedGroups.group': group._id }, { savedNotes: { $in: noteIds } }] },
      { $pull: { favoriteGroups: group._id, mutedGroups: { group: group._id }, savedNotes: { $in: noteIds } } }
    ),
    Notification.deleteMany({ note: { $in: noteIds } }),
  ]);

  // Dosya silme hataları grubun silinmesini engellemez (removeFile sadece loglar)
  await Promise.all([removeFile(group.avatarUrl), ...notes.map((n) => removeFile(n.fileUrl))]);
};

export {
  deleteGroupWithContent,
  favoriteGroupIds,
  mutedGroupsOf,
  muteFields,
  listIncomingRequests,
  listSentRequests,
  listGroups,
  assertMember,
  recordGroupActivity,
  markGroupRead,
  listMyGroupActivity,
  followedMembersFor,
  GROUP_SORT_OPTIONS,
};
