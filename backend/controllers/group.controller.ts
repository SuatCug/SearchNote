import mongoose from 'mongoose';
import asyncHandler, { type AuthedRequest } from '../utils/asyncHandler.ts';
import ApiError from '../utils/apiError.ts';
import { Group, GroupMessage, Note, User } from '../models/index.ts';
import {
  deleteGroupWithContent,
  favoriteGroupIds,
  followedMembersFor,
  listIncomingRequests,
  listSentRequests,
  listGroups,
  listMyGroupActivity,
  markGroupRead,
  recordGroupActivity,
} from '../services/group.service.ts';
import { assertNoteVisible, listNotes } from '../services/note.service.ts';
import { notify } from '../services/notification.service.ts';
import { emitToGroup } from '../services/realtime.service.ts';
import { pushGroupMessage } from '../services/push.service.ts';
import { buildPagination, parsePagination } from '../utils/pagination.util.ts';
import { exactRegex, toTurkishInsensitive, wordSearchMatch } from '../utils/regex.util.ts';
import type { GroupDocument } from '../models/group.model.ts';
import type { UserDocument } from '../models/user.model.ts';
import type { IdLike } from '../types/common.ts';

const USER_CARD_FIELDS = 'fullName avatarUrl university department';

const findGroupOrFail = async (id: string) => {
  const group = await Group.findById(id);
  if (!group) throw new ApiError(404, 'Group not found.');
  return group;
};

const assertOwner = (group: GroupDocument, userId: string) => {
  if (!group.owner.equals(userId)) {
    throw new ApiError(403, 'Only the group founder can do this.');
  }
};

// Özel grubun üye listesi sadece üyelere açıktır.
const assertCanView = (group: GroupDocument, userId: string | undefined) => {
  if (group.isPrivate && !group.hasMember(userId)) {
    throw new ApiError(403, 'This group is private. Join the group to see its content.');
  }
};

// Grup detay görünümü: üye / istek dizileri yerine sayılar + izleyiciye göre durum bilgisi.
const toGroupDetail = async (group: GroupDocument, viewerId: IdLike | undefined) => {
  await group.populate('owner', USER_CARD_FIELDS);
  const viewer = viewerId ? String(viewerId) : undefined;
  const [notesCount, followed, favorites] = await Promise.all([
    Note.countDocuments({ group: group._id }),
    followedMembersFor(viewer, [group._id]),
    favoriteGroupIds(viewer),
  ]);
  // lastReadAt üyelerin okuma zamanları, requestInfo istek mesajlarıdır; kimseye gösterilmez.
  const { members, joinRequests, lastReadAt: _lastReadAt, requestInfo: _requestInfo, __v, ...rest } = group.toObject();
  const isOwner = viewerId ? group.owner._id.equals(viewerId) : false;
  const mine = followed.get(String(group._id));
  return {
    ...rest,
    color: rest.color ?? 'navy',
    isFavorite: favorites.some((id) => id.equals(group._id)),
    membersCount: members.length,
    notesCount,
    // İzleyicinin takip ettiği üyeler ("Ayşe ve Mert üye")
    followedMembers: mine?.users ?? [],
    followedMembersCount: mine?.count ?? 0,
    isMember: group.hasMember(viewerId),
    isPending: group.hasPendingRequest(viewerId),
    isOwner,
    // Bekleyen istek sayısını sadece kurucu görür.
    ...(isOwner && { pendingCount: joinRequests.length }),
  };
};

// Keşfet: tüm gruplar, isim/açıklamada arama.
// Mobil için ek (isteğe bağlı) parametreler:
// - scope=university: benim üniversitemin grupları (grubun üniversitesi; yoksa kurucunun okulu)
// - exclude=mine: zaten üyesi olduğum gruplar listelenmez
// - privacy=public|private: herkese açık / onay gerekli gruplar
// - course=CENG: ders kodu (yoksa grup adı) bu harflerle başlayan gruplar
// - sort=notes: en çok not paylaşılan gruplar önce
// Giriş yapmış kullanıcıya her kartta takip ettiği üyeler de döner (followedMembers).
const searchGroups = asyncHandler(async (req, res) => {
  const viewerId = req.user?.id;
  const clauses: Record<string, unknown>[] = [];
  const search = wordSearchMatch(req.query.q, ['name', 'description', 'courseCode']);
  if (search) clauses.push(search);
  if (typeof req.query.course === 'string' && req.query.course.trim()) {
    const prefix = new RegExp(`^${toTurkishInsensitive(req.query.course.slice(0, 12))}`, 'i');
    clauses.push({ $or: [{ courseCode: prefix }, { courseCode: { $in: [null, ''] }, name: prefix }] });
  }
  const match: Record<string, unknown> = clauses.length ? { $and: clauses } : {};
  if (req.query.privacy === 'public' || req.query.privacy === 'private') {
    match.isPrivate = req.query.privacy === 'private' ? true : { $ne: true };
  }

  if (viewerId && req.query.exclude === 'mine') {
    match.members = { $ne: new mongoose.Types.ObjectId(viewerId) };
  }
  if (viewerId && req.query.scope === 'university') {
    const viewer = await User.findById(viewerId).select('university').lean();
    if (!viewer?.university) {
      return res.json({ success: true, data: { items: [], pagination: buildPagination(1, 1, 0) } });
    }
    // Grubun üniversitesi seçilmişse ona, seçilmemiş (eski) gruplarda kurucunun okuluna bakılır
    const owners = await User.find({ university: exactRegex(viewer.university) }).distinct('_id');
    clauses.push({
      $or: [
        { university: exactRegex(viewer.university) },
        { university: { $exists: false }, owner: { $in: owners } },
      ],
    });
    match.$and = clauses;
  }

  const data = await listGroups({
    match,
    sort: req.query.sort,
    ...parsePagination(req.query),
    viewerId,
  });
  const followed = await followedMembersFor(
    viewerId,
    data.items.map((g: { _id: unknown }) => g._id)
  );
  const items = data.items.map((g: { _id: unknown }) => {
    const f = followed.get(String(g._id));
    return { ...g, followedMembers: f?.users ?? [], followedMembersCount: f?.count ?? 0 };
  });

  res.json({ success: true, data: { ...data, items } });
});

// "Gruplarım" sohbet listesi: son hareket + okunmamış sayısı, en son hareket eden en üstte.
const getMyGroupActivity = asyncHandler<AuthedRequest>(async (req, res) => {
  res.json({ success: true, data: { groups: await listMyGroupActivity(req.user.id) } });
});

// Giriş yapan kullanıcının üyesi olduğu gruplar (kurduğu gruplar dahil).
const getMyGroups = asyncHandler<AuthedRequest>(async (req, res) => {
  const data = await listGroups({
    match: { members: new mongoose.Types.ObjectId(req.user.id) },
    sort: 'newest',
    ...parsePagination(req.query),
    viewerId: req.user.id,
  });

  res.json({ success: true, data });
});

const getGroup = asyncHandler(async (req, res) => {
  const group = await findGroupOrFail(req.params.id);
  res.json({ success: true, data: { group: await toGroupDetail(group, req.user?.id) } });
});

// Grubu kuran kişi otomatik olarak kurucu ve ilk üye olur.
// university gönderilmezse (ör. web) kurucunun üniversitesi yazılır; boş metin ('') = hiçbir okula bağlı değil
// (alanı hiç olmayan eski gruplardan ayrılsın diye boş metin olarak saklanır).
const createGroup = asyncHandler<AuthedRequest>(async (req, res) => {
  const university =
    typeof req.body.university === 'string'
      ? req.body.university.trim()
      : (await User.findById(req.user.id).select('university').lean())?.university || undefined;
  const group = await Group.create({
    university,
    name: req.body.name,
    description: req.body.description,
    isPrivate: req.body.isPrivate,
    color: req.body.color,
    courseCode: req.body.courseCode || undefined,
    owner: req.user.id,
    members: [req.user.id],
  });

  res.status(201).json({
    success: true,
    message: 'Group created.',
    data: { group: await toGroupDetail(group, req.user.id) },
  });
});

const updateGroup = asyncHandler<AuthedRequest>(async (req, res) => {
  const group = await findGroupOrFail(req.params.id);
  assertOwner(group, req.user.id);

  ['name', 'description', 'isPrivate', 'color', 'courseCode', 'university'].forEach((field) => {
    if (req.body[field] === undefined) return;
    group.set(field, req.body[field] === '' && field !== 'university' ? undefined : req.body[field]);
  });
  // Grup herkese açık hale getirilirse bekleyen istekler otomatik onaylanır.
  if (!group.isPrivate && group.joinRequests.length) {
    group.members.addToSet(...group.joinRequests);
    group.set('joinRequests', []);
    group.set('requestInfo', {});
  }
  await group.save();

  res.json({ success: true, message: 'Group updated.', data: { group: await toGroupDetail(group, req.user.id) } });
});

// Grup silinince gruba paylaşılan notlar (dosyalarıyla) ve sohbet mesajları da silinir.
const deleteGroup = asyncHandler<AuthedRequest>(async (req, res) => {
  const group = await findGroupOrFail(req.params.id);
  assertOwner(group, req.user.id);

  await deleteGroupWithContent(group);

  res.json({ success: true, message: 'Group deleted.' });
});

// Herkese açık gruba doğrudan katılınır; özel gruba katılma isteği gönderilir.
// İsteğe bağlı body.message: özel gruba istekle birlikte kurucuya kısa not (mobil).
const joinGroup = asyncHandler<AuthedRequest>(async (req, res) => {
  const group = await findGroupOrFail(req.params.id);
  const userId = req.user.id;

  if (!group.hasMember(userId)) {
    if (group.isPrivate) {
      if (!group.hasPendingRequest(userId)) {
        const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 300) : '';
        group.requestInfo.set(userId, { message, createdAt: new Date() });
      }
      group.joinRequests.addToSet(userId);
    } else group.members.addToSet(userId);
    await group.save();
    // Kurucuya: açık grupta yeni üye, özel grupta onay bekleyen istek bildirimi.
    await notify({
      recipient: group.owner,
      actor: userId,
      type: group.isPrivate ? 'group_request' : 'group_join',
      group: group._id,
    });
  }

  const isMember = group.hasMember(userId);
  res.json({
    success: true,
    message: isMember ? 'Joined the group.' : 'Join request sent. The founder will review it.',
    data: { isMember, isPending: group.hasPendingRequest(userId), membersCount: group.members.length },
  });
});

// Üye gruptan ayrılır; onay bekleyen kullanıcı ise isteğini geri çeker.
// Kurucu gruptan ayrılamaz: önce kuruculuğu devretmeli ya da grubu silmelidir.
const leaveGroup = asyncHandler<AuthedRequest>(async (req, res) => {
  const group = await findGroupOrFail(req.params.id);
  const userId = req.user.id;

  if (group.hasPendingRequest(userId)) {
    group.joinRequests.pull(userId);
    group.requestInfo.delete(userId);
    await group.save();
    return res.json({
      success: true,
      message: 'Join request cancelled.',
      data: { isMember: false, isPending: false, membersCount: group.members.length },
    });
  }

  if (group.owner.equals(userId)) {
    throw new ApiError(400, 'The founder cannot leave the group. Transfer ownership or delete the group instead.');
  }

  group.members.pull(userId);
  await group.save();

  res.json({
    success: true,
    message: 'Left the group.',
    data: { isMember: false, isPending: false, membersCount: group.members.length },
  });
});

// Kurucu en üstte, diğer üyeler katılım sırasına göre.
const getMembers = asyncHandler(async (req, res) => {
  const group = await findGroupOrFail(req.params.id);
  assertCanView(group, req.user?.id);
  const populated = await group.populate<{ members: UserDocument[] }>('members', USER_CARD_FIELDS);

  const users = populated.members
    .map((u) => ({ ...u.toObject(), isOwner: u._id.equals(group.owner) }))
    .sort((a, b) => Number(b.isOwner) - Number(a.isOwner));

  res.json({ success: true, data: { users } });
});

// Grup sayfasındaki "Ayşe, Mert and 3 more you follow" satırına dokununca (mobil): takip ettiğim üyelerin hepsi.
// Grup detayı bu kişilerin ilk 3'ünü özel gruplarda da gösterdiği için üye olmayana da açıktır.
const getFollowedMembers = asyncHandler<AuthedRequest>(async (req, res) => {
  const [group, viewer] = await Promise.all([
    Group.findById(req.params.id).select('owner members').lean(),
    User.findById(req.user.id).select('following').lean(),
  ]);
  if (!group) throw new ApiError(404, 'Group not found.');
  const following = new Set((viewer?.following ?? []).map(String));
  // Son katılan önce
  const ids = [...group.members].reverse().filter((id) => following.has(String(id)));
  const cards = await User.find({ _id: { $in: ids } }).select(USER_CARD_FIELDS).lean();
  const byId = new Map(cards.map((u) => [String(u._id), u]));
  const users = ids.flatMap((id) => {
    const card = byId.get(String(id));
    return card ? [{ ...card, isFollowing: true, isOwner: group.owner.equals(id) }] : [];
  });

  res.json({ success: true, data: { users } });
});

const removeMember = asyncHandler<AuthedRequest>(async (req, res) => {
  const group = await findGroupOrFail(req.params.id);
  assertOwner(group, req.user.id);
  if (group.owner.equals(req.params.userId)) throw new ApiError(400, 'The founder cannot be removed.');
  if (!group.hasMember(req.params.userId)) throw new ApiError(404, 'User is not a member.');

  group.members.pull(req.params.userId);
  await group.save();

  res.json({ success: true, message: 'Member removed.', data: { membersCount: group.members.length } });
});

// Kuruculuk sadece mevcut bir üyeye devredilebilir.
const transferOwnership = asyncHandler<AuthedRequest>(async (req, res) => {
  const group = await findGroupOrFail(req.params.id);
  assertOwner(group, req.user.id);
  if (!group.hasMember(req.params.userId)) {
    throw new ApiError(400, 'Ownership can only be transferred to a group member.');
  }

  group.owner = new mongoose.Types.ObjectId(req.params.userId);
  await group.save();

  res.json({ success: true, message: 'Ownership transferred.', data: { group: await toGroupDetail(group, req.user.id) } });
});

// Özel grubun bekleyen katılma istekleri (sadece kurucu).
const getJoinRequests = asyncHandler<AuthedRequest>(async (req, res) => {
  const group = await findGroupOrFail(req.params.id);
  assertOwner(group, req.user.id);
  await group.populate('joinRequests', USER_CARD_FIELDS);

  res.json({ success: true, data: { users: group.joinRequests } });
});

const approveJoinRequest = asyncHandler<AuthedRequest>(async (req, res) => {
  const group = await findGroupOrFail(req.params.id);
  assertOwner(group, req.user.id);
  if (!group.hasPendingRequest(req.params.userId)) throw new ApiError(404, 'Join request not found.');

  group.joinRequests.pull(req.params.userId);
  group.requestInfo.delete(req.params.userId);
  group.members.addToSet(req.params.userId);
  await group.save();
  await notify({ recipient: req.params.userId, actor: req.user.id, type: 'group_approved', group: group._id });

  res.json({ success: true, message: 'Join request approved.', data: { membersCount: group.members.length } });
});

const rejectJoinRequest = asyncHandler<AuthedRequest>(async (req, res) => {
  const group = await findGroupOrFail(req.params.id);
  assertOwner(group, req.user.id);
  if (!group.hasPendingRequest(req.params.userId)) throw new ApiError(404, 'Join request not found.');

  group.joinRequests.pull(req.params.userId);
  group.requestInfo.delete(req.params.userId);
  await group.save();

  res.json({ success: true, message: 'Join request rejected.' });
});

// Grup notları (herkese açık grupta da) sadece üyelere görünür.
const getGroupNotes = asyncHandler(async (req, res) => {
  const group = await findGroupOrFail(req.params.id);
  if (!group.hasMember(req.user?.id)) throw new ApiError(403, 'Only group members can see the notes shared in this group.');

  // İsteğe bağlı dosya türü filtresi (mobil "PDF / Docs / Images" çipleri)
  const fileType = ['pdf', 'docx', 'image', 'archive'].includes(String(req.query.fileType)) ? String(req.query.fileType) : undefined;
  const data = await listNotes({
    match: { group: group._id, ...(fileType && { fileType }) },
    sort: req.query.sort,
    ...parsePagination(req.query),
    viewerId: req.user?.id,
    includeGroupNotes: true,
  });

  res.json({ success: true, data });
});

const MESSAGE_LIMIT = 100;

// Grup sohbeti: sadece üyeler. Son 100 mesaj eskiden yeniye sıralı döner (istemci periyodik olarak yeniler).
const getMessages = asyncHandler<AuthedRequest>(async (req, res) => {
  const group = await findGroupOrFail(req.params.id);
  if (!group.hasMember(req.user.id)) throw new ApiError(403, 'Only group members can see the chat.');

  const messages = await GroupMessage.find({ group: group._id })
    .sort({ createdAt: -1 })
    .limit(MESSAGE_LIMIT)
    .populate('user', 'fullName avatarUrl')
    .populate('note', MESSAGE_NOTE_FIELDS);
  await markGroupRead(group._id, req.user.id);

  res.json({ success: true, data: { messages: messages.reverse() } });
});

const MESSAGE_NOTE_FIELDS = 'title courseCode courseName fileType';

// İsteğe bağlı: noteId (sohbete not ekleme) ve replyTo (bir mesajı yanıtlama), mobil için.
// Eklenen not grubun bütün üyelerine görünür olmalı: herkese açık bir not ya da bu grupta paylaşılmış not.
const sendMessage = asyncHandler<AuthedRequest>(async (req, res) => {
  const group = await findGroupOrFail(req.params.id);
  if (!group.hasMember(req.user.id)) throw new ApiError(403, 'Only group members can write in the chat.');

  const { noteId, replyTo } = req.body as { noteId?: string; replyTo?: string };
  const [note, original] = await Promise.all([
    noteId ? Note.findById(noteId).select('group author visibility') : null,
    replyTo ? GroupMessage.findOne({ _id: replyTo, group: group._id }).select('user text').lean() : null,
  ]);
  if (noteId) {
    if (!note) throw new ApiError(404, 'Note not found.');
    await assertNoteVisible(note, req.user.id);
    const visibleToGroup = note.group ? note.group.equals(group._id) : note.visibility !== 'followers';
    if (!visibleToGroup) {
      throw new ApiError(403, "Group members can't see this note (it's shared with another group or only with followers).");
    }
  }
  if (replyTo && !original) throw new ApiError(404, 'The message you are replying to no longer exists.');

  const message = await GroupMessage.create({
    group: group._id,
    user: req.user.id,
    text: req.body.text,
    note: note?._id,
    ...(original && { reply: { message: original._id, user: original.user, text: original.text } }),
  });
  await message.populate([
    { path: 'user', select: 'fullName avatarUrl' },
    { path: 'note', select: MESSAGE_NOTE_FIELDS },
  ]);
  emitToGroup(group._id, 'group:message', { groupId: String(group._id) });
  await recordGroupActivity(group._id, req.user.id, message.createdAt);
  // Uygulaması kapalı üyelere telefon bildirimi (beklenmez)
  pushGroupMessage(group, req.user.id, message.text).catch((e) => console.error('Push error:', (e as Error).message));

  res.status(201).json({ success: true, data: { message } });
});

// Mesajı yazan kişi veya grubun kurucusu silebilir.
const deleteMessage = asyncHandler<AuthedRequest>(async (req, res) => {
  const group = await findGroupOrFail(req.params.id);
  const message = await GroupMessage.findOne({ _id: req.params.messageId, group: group._id });
  if (!message) throw new ApiError(404, 'Message not found.');

  if (!message.user.equals(req.user.id) && !group.owner.equals(req.user.id)) {
    throw new ApiError(403, 'You are not allowed to delete this message.');
  }

  await message.deleteOne();
  emitToGroup(group._id, 'group:message', { groupId: String(group._id) });
  res.json({ success: true, message: 'Message deleted.' });
});

// Mesajı sadece yazan kişi düzenleyebilir (mobil).
const editMessage = asyncHandler<AuthedRequest>(async (req, res) => {
  const group = await findGroupOrFail(req.params.id);
  const message = await GroupMessage.findOne({ _id: req.params.messageId, group: group._id });
  if (!message) throw new ApiError(404, 'Message not found.');
  if (!message.user.equals(req.user.id)) throw new ApiError(403, 'You can only edit your own messages.');
  if (!group.hasMember(req.user.id)) throw new ApiError(403, 'Only group members can write in the chat.');

  message.text = req.body.text;
  message.editedAt = new Date();
  await message.save();
  await message.populate([
    { path: 'user', select: 'fullName avatarUrl' },
    { path: 'note', select: MESSAGE_NOTE_FIELDS },
  ]);
  emitToGroup(group._id, 'group:message', { groupId: String(group._id) });
  res.json({ success: true, data: { message } });
});

// Favori gruplar (mobil): en son eklenen önce değil, grup kartı sırası (yeni grup önce).
const getFavoriteGroups = asyncHandler<AuthedRequest>(async (req, res) => {
  const favorites = await favoriteGroupIds(req.user.id);
  const data = await listGroups({
    match: { _id: { $in: favorites } },
    sort: req.query.sort,
    ...parsePagination(req.query),
    viewerId: req.user.id,
  });
  res.json({ success: true, data });
});

const addFavorite = asyncHandler<AuthedRequest>(async (req, res) => {
  await findGroupOrFail(req.params.id);
  await User.updateOne({ _id: req.user.id }, { $addToSet: { favoriteGroups: req.params.id } });
  res.json({ success: true, data: { isFavorite: true } });
});

const removeFavorite = asyncHandler<AuthedRequest>(async (req, res) => {
  await User.updateOne({ _id: req.user.id }, { $pull: { favoriteGroups: req.params.id } });
  res.json({ success: true, data: { isFavorite: false } });
});

// Tüm gruplarıma gelen bekleyen istekler (kurucusu olduğum gruplar).
const getIncomingRequests = asyncHandler<AuthedRequest>(async (req, res) => {
  res.json({ success: true, data: { requests: await listIncomingRequests(req.user.id) } });
});

// Benim gönderdiğim bekleyen istekler.
const getSentRequests = asyncHandler<AuthedRequest>(async (req, res) => {
  res.json({ success: true, data: { requests: await listSentRequests(req.user.id) } });
});

export {
  getFavoriteGroups,
  addFavorite,
  removeFavorite,
  getIncomingRequests,
  getSentRequests,
  searchGroups,
  getMyGroups,
  getMyGroupActivity,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  joinGroup,
  leaveGroup,
  getMembers,
  getFollowedMembers,
  removeMember,
  transferOwnership,
  getJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  getGroupNotes,
  getMessages,
  sendMessage,
  deleteMessage,
  editMessage,
};
