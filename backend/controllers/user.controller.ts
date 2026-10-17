import bcrypt from 'bcryptjs';
import mongoose, { type Types } from 'mongoose';
import asyncHandler, { type AuthedRequest } from '../utils/asyncHandler.ts';
import ApiError from '../utils/apiError.ts';
import { User, Note, Report } from '../models/index.ts';
import { deleteAccount as deleteAccountData } from '../services/account.service.ts';
import { sendAccountDeletionCode, sendAccountDeletedEmail } from '../services/mail.service.ts';
import { createOneTimeCode, hashOneTimeCode } from '../utils/token.util.ts';
import { listNotes, listUserCourses, PUBLIC_NOTES_MATCH } from '../services/note.service.ts';
import { saveAvatar, removeFile } from '../services/storage.service.ts';
import { parsePagination, buildPagination } from '../utils/pagination.util.ts';
import { exactRegex, wordSearchMatch } from '../utils/regex.util.ts';
import { getExtension, matchesSignature } from '../utils/fileTypes.util.ts';
import { isBlockedBetween } from '../services/block.service.ts';
import { notify, removeNotification } from '../services/notification.service.ts';
import { getOnlineUserIds } from '../services/realtime.service.ts';

const USER_CARD_FIELDS = 'fullName avatarUrl university department';

// Kişi arama: ad, üniversite veya bölümde (Türkçe karakter duyarsız) eşleşen kullanıcılar,
// en çok takipçisi olandan başlayarak sıralanır.
const searchUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  // Kelime bazlı: "elif odtü" -> adında "elif", üniversitesinde "ODTÜ" geçen kişi.
  const qMatch = wordSearchMatch(req.query.q, ['fullName', 'university', 'department']);
  if (!qMatch) {
    return res.json({ success: true, data: { users: [], pagination: buildPagination(page, limit, 0) } });
  }
  // Arayanı engellemiş kullanıcılar sonuçlarda çıkmaz.
  const match = req.user
    ? { $and: [qMatch, { blockedUsers: { $ne: new mongoose.Types.ObjectId(req.user.id) } }] }
    : qMatch;

  const [users, total] = await Promise.all([
    User.aggregate([
      { $match: match },
      { $addFields: { followersCount: { $size: '$followers' } } },
      { $sort: { followersCount: -1, fullName: 1 } },
      { $skip: skip },
      { $limit: limit },
      { $project: { fullName: 1, avatarUrl: 1, university: 1, department: 1, followersCount: 1 } },
    ]),
    User.countDocuments(match),
  ]);

  res.json({ success: true, data: { users, pagination: buildPagination(page, limit, total) } });
});

// Profil sayfası: kullanıcı bilgisi + not sayısı + toplam beğeni/indirme + (giriş yapılmışsa) takip durumu.
const getProfile = asyncHandler(async (req, res) => {
  const viewerId = req.user?.id;
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');

  // Profil istatistikleri grupsuz notlardan hesaplanır; "sadece takipçiler" notları kişinin kendisine ve
  // takipçilerine sayılır (profilde listelenen notlarla tutarlı olsun diye).
  const canSeeFollowersNotes =
    viewerId && (viewerId === user._id.toString() || user.followers.some((id) => id.equals(viewerId)));
  const [stats] = await Note.aggregate([
    { $match: { author: user._id, ...(canSeeFollowersNotes ? { group: null } : PUBLIC_NOTES_MATCH) } },
    {
      $group: {
        _id: null,
        notesCount: { $sum: 1 },
        totalLikes: { $sum: { $size: '$likes' } },
        totalDownloads: { $sum: '$downloadsCount' },
      },
    },
  ]);

  const isFollowing = viewerId ? user.followers.some((id) => id.equals(viewerId)) : false;
  const isBlocked = viewerId
    ? Boolean(await User.exists({ _id: viewerId, blockedUsers: user._id }))
    : false;

  res.json({
    success: true,
    data: {
      user: user.toPublicJSON(),
      stats: {
        notesCount: stats?.notesCount || 0,
        totalLikes: stats?.totalLikes || 0,
        totalDownloads: stats?.totalDownloads || 0,
      },
      isFollowing,
      // Giriş yapan kullanıcı bu kişiyi engellediyse true.
      isBlocked,
      isMe: viewerId === user._id.toString(),
    },
  });
});

const getUserNotes = asyncHandler(async (req, res) => {
  const exists = await User.exists({ _id: req.params.id });
  if (!exists) throw new ApiError(404, 'User not found.');

  // q: kullanıcının notları içinde başlık / ders adı / ders kodu / hoca adında arama.
  const author = { author: new mongoose.Types.ObjectId(req.params.id) };
  const qMatch = wordSearchMatch(req.query.q, ['title', 'courseName', 'courseCode', 'instructorName']);
  const match = qMatch ? { $and: [author, qMatch] } : author;

  const data = await listNotes({
    match,
    sort: req.query.sort,
    ...parsePagination(req.query),
    viewerId: req.user?.id,
  });

  res.json({ success: true, data });
});

// Kendisi, engelledikleri ve onu engelleyenler hariç tutulur (akış yan paneli listeleri için).
const excludeSelfAndBlocked = (me: { _id: Types.ObjectId; blockedUsers: Types.ObjectId[] }) => ({
  _id: { $nin: [me._id, ...me.blockedUsers] },
  blockedUsers: { $ne: me._id },
});

// "Active now": karşılıklı takipleşilen kişilerden şu an Socket.io ile bağlı (uygulamayı açık tutan) olanlar.
const getActiveUsers = asyncHandler<AuthedRequest>(async (req, res) => {
  const me = await User.findById(req.user.id).select('following blockedUsers');
  if (!me) throw new ApiError(404, 'User not found.');
  const base = excludeSelfAndBlocked(me);
  const online = getOnlineUserIds().map((id) => new mongoose.Types.ObjectId(id));
  const match = {
    blockedUsers: base.blockedUsers,
    // kendim/engellediklerim hariç, takip ettiğim ve şu an çevrimiçi olanlar...
    $and: [{ _id: base._id }, { _id: { $in: me.following } }, { _id: { $in: online } }],
    following: me._id, // ...ve beni takip edenler
  };

  const [users, total] = await Promise.all([
    User.aggregate([
      { $match: match },
      { $sort: { lastActiveAt: -1 } },
      { $limit: 8 },
      { $project: { fullName: 1, avatarUrl: 1, university: 1, department: 1 } },
    ]),
    User.countDocuments(match),
  ]);

  res.json({ success: true, data: { users, total } });
});

// "Who to follow": henüz takip edilmeyenler; aynı okul + aynı bölüm > aynı okul > aynı bölüm > diğerleri,
// eşitlerde en çok takipçisi olan önde. Okul/bölüm karşılaştırması Türkçe karakter ve büyük/küçük harf duyarsız
// ("ege universitesi" = "Ege Üniversitesi").
//   ?limit=5 (en fazla 50)   ?scope=university → sadece aynı okuldakiler (kayıt sonrası "sınıf arkadaşlarını takip et")
// Her kişide sameUniversity / sameDepartment döner (arayüz "aynı okul" etiketini gösterebilsin).
const getSuggestions = asyncHandler<AuthedRequest>(async (req, res) => {
  const me = await User.findById(req.user.id).select('following blockedUsers university department');
  if (!me) throw new ApiError(404, 'User not found.');
  const base = excludeSelfAndBlocked(me);
  const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 50);
  const onlyUniversity = req.query.scope === 'university';
  const university = me.university?.trim() ?? '';
  const department = me.department?.trim() ?? '';
  if (onlyUniversity && !university) return res.json({ success: true, data: { users: [] } });

  const sameAs = (field: string, value: string) =>
    value ? { $regexMatch: { input: { $ifNull: [field, ''] }, regex: exactRegex(value) } } : false;

  const users = await User.aggregate([
    {
      $match: {
        ...base,
        _id: { $nin: [...base._id.$nin, ...me.following] },
        ...(onlyUniversity ? { university: exactRegex(university) } : {}),
      },
    },
    {
      $addFields: {
        followersCount: { $size: '$followers' },
        sameUniversity: sameAs('$university', university),
        sameDepartment: sameAs('$department', department),
      },
    },
    {
      $addFields: {
        affinity: { $add: [{ $cond: ['$sameUniversity', 2, 0] }, { $cond: ['$sameDepartment', 1, 0] }] },
      },
    },
    { $sort: { affinity: -1, followersCount: -1, _id: 1 } },
    { $limit: limit },
    {
      $project: {
        fullName: 1,
        avatarUrl: 1,
        university: 1,
        department: 1,
        followersCount: 1,
        sameUniversity: 1,
        sameDepartment: 1,
      },
    },
  ]);

  res.json({ success: true, data: { users } });
});

// Takipçi / takip edilen listesi.
//  - ?limit yoksa (web): listenin tamamı, eskisi gibi.
//  - ?limit varsa (mobil): sayfalı, en yeni takip önce; ?q ile ad/okul/bölümde arama; giriş yapılmışsa
//    her kişide isFollowing (izleyici bu kişiyi takip ediyor mu).
const listConnections = (field: 'followers' | 'following') =>
  asyncHandler(async (req, res) => {
    if (req.query.limit === undefined) {
      const user = await User.findById(req.params.id).populate(field, USER_CARD_FIELDS);
      if (!user) throw new ApiError(404, 'User not found.');
      return res.json({ success: true, data: { users: user[field] } });
    }

    const user = await User.findById(req.params.id).select(field).lean();
    if (!user) throw new ApiError(404, 'User not found.');
    const { page, limit, skip } = parsePagination(req.query);

    // Diziye en son eklenen en yeni takiptir
    let ids = [...user[field]].reverse();
    const qMatch = wordSearchMatch(req.query.q, ['fullName', 'university', 'department']);
    if (qMatch) {
      const found = await User.find({ $and: [{ _id: { $in: ids } }, qMatch] }).select('_id').lean();
      const matched = new Set(found.map((u) => String(u._id)));
      ids = ids.filter((id) => matched.has(String(id)));
    }

    const pageIds = ids.slice(skip, skip + limit);
    const [cards, viewer] = await Promise.all([
      User.find({ _id: { $in: pageIds } }).select(USER_CARD_FIELDS).lean(),
      req.user ? User.findById(req.user.id).select('following').lean() : null,
    ]);
    const byId = new Map(cards.map((u) => [String(u._id), u]));
    const viewerFollowing = new Set((viewer?.following ?? []).map(String));
    const users = pageIds.flatMap((id) => {
      const card = byId.get(String(id));
      return card ? [{ ...card, isFollowing: viewerFollowing.has(String(id)) }] : [];
    });

    res.json({ success: true, data: { users, pagination: buildPagination(page, limit, ids.length) } });
  });

const getFollowers = listConnections('followers');
const getFollowing = listConnections('following');

// "Followed by …" satırı: bu kişiyi takip edenlerden izleyicinin de takip ettikleri (en yeni 3 kişi + toplam).
const getMutualFollowers = asyncHandler<AuthedRequest>(async (req, res) => {
  const [target, me] = await Promise.all([
    User.findById(req.params.id).select('followers').lean(),
    User.findById(req.user.id).select('following').lean(),
  ]);
  if (!target || !me) throw new ApiError(404, 'User not found.');

  const myFollowing = new Set(me.following.map(String));
  const mutual = [...target.followers].reverse().filter((id) => myFollowing.has(String(id)));
  const top = mutual.slice(0, 3);
  const cards = await User.find({ _id: { $in: top } }).select(USER_CARD_FIELDS).lean();
  const byId = new Map(cards.map((u) => [String(u._id), u]));
  const users = top.flatMap((id) => byId.get(String(id)) ?? []);

  res.json({ success: true, data: { users, total: mutual.length } });
});

// Kişinin not paylaştığı dersler ve not sayıları (izleyicinin görebildiği notlardan).
const getUserCourses = asyncHandler(async (req, res) => {
  if (!(await User.exists({ _id: req.params.id }))) throw new ApiError(404, 'User not found.');
  const courses = await listUserCourses(req.params.id, req.user?.id);
  res.json({ success: true, data: { courses } });
});

const follow = asyncHandler<AuthedRequest>(async (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.user.id) throw new ApiError(400, 'You cannot follow yourself.');
  if (await isBlockedBetween(req.user.id, targetId)) throw new ApiError(403, 'You cannot follow this user.');

  const target = await User.findByIdAndUpdate(targetId, { $addToSet: { followers: req.user.id } }, { returnDocument: 'after' });
  if (!target) throw new ApiError(404, 'User not found.');
  await User.updateOne({ _id: req.user.id }, { $addToSet: { following: targetId } });
  await notify({ recipient: target._id, actor: req.user.id, type: 'follow' });

  res.json({
    success: true,
    message: 'User followed.',
    data: { isFollowing: true, followersCount: target.followers.length },
  });
});

const unfollow = asyncHandler<AuthedRequest>(async (req, res) => {
  const targetId = req.params.id;

  const target = await User.findByIdAndUpdate(targetId, { $pull: { followers: req.user.id } }, { returnDocument: 'after' });
  if (!target) throw new ApiError(404, 'User not found.');
  await User.updateOne({ _id: req.user.id }, { $pull: { following: targetId } });
  await removeNotification({ recipient: target._id, actor: req.user.id, type: 'follow' });

  res.json({
    success: true,
    message: 'User unfollowed.',
    data: { isFollowing: false, followersCount: target.followers.length },
  });
});

// Engelleme: iki taraf da birbirine mesaj atamaz ve takip edemez; varsa karşılıklı takip kaldırılır.
const block = asyncHandler<AuthedRequest>(async (req, res) => {
  const me = req.user.id;
  const targetId = req.params.id;
  if (targetId === me) throw new ApiError(400, 'You cannot block yourself.');
  if (!(await User.exists({ _id: targetId }))) throw new ApiError(404, 'User not found.');

  await Promise.all([
    User.updateOne({ _id: me }, { $addToSet: { blockedUsers: targetId }, $pull: { following: targetId, followers: targetId } }),
    User.updateOne({ _id: targetId }, { $pull: { following: me, followers: me } }),
  ]);

  res.json({ success: true, message: 'User blocked.', data: { isBlocked: true } });
});

const unblock = asyncHandler<AuthedRequest>(async (req, res) => {
  await User.updateOne({ _id: req.user.id }, { $pull: { blockedUsers: req.params.id } });
  res.json({ success: true, message: 'User unblocked.', data: { isBlocked: false } });
});

const updateProfile = asyncHandler<AuthedRequest>(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, 'User not found.');
  ['fullName', 'university', 'department', 'bio'].forEach((field) => {
    if (req.body[field] !== undefined) user.set(field, req.body[field]);
  });
  await user.save();

  res.json({ success: true, message: 'Profile updated.', data: { user: user.toSafeJSON() } });
});

const updateAvatar = asyncHandler<AuthedRequest>(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'A profile photo (avatar) is required.');

  const ext = getExtension(req.file.originalname);
  if (!matchesSignature(req.file.buffer, ext)) {
    throw new ApiError(415, 'The file content does not match its extension.');
  }

  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, 'User not found.');
  const oldAvatar = user.avatarUrl;
  user.avatarUrl = await saveAvatar(req.file.buffer, ext);
  await user.save();
  await removeFile(oldAvatar);

  res.json({ success: true, message: 'Profile photo updated.', data: { user: user.toSafeJSON() } });
});

// Profil fotoğrafını kaldırır (baş harfler gösterilir).
const removeAvatar = asyncHandler<AuthedRequest>(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, 'User not found.');
  const oldAvatar = user.avatarUrl;
  user.avatarUrl = '';
  await user.save();
  // Google'dan gelen fotoğraf bizim depomuzda değil; sadece kendi dosyalarımız silinir.
  if (oldAvatar.startsWith('/uploads/') || oldAvatar.startsWith('https://res.cloudinary.com/')) {
    await removeFile(oldAvatar);
  }

  res.json({ success: true, message: 'Profile photo removed.', data: { user: user.toSafeJSON() } });
});

// Şifre değiştirme. Google ile açılmış ve henüz şifresi olmayan hesapta (hasPassword=false)
// mevcut şifre istenmez: kullanıcı ilk şifresini belirler.
const changePassword = asyncHandler<AuthedRequest>(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!user) throw new ApiError(404, 'User not found.');
  if (user.hasPassword !== false) {
    if (!currentPassword) throw new ApiError(400, 'Current password is required.');
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) throw new ApiError(401, 'Current password is incorrect.');
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.hasPassword = true;
  await user.save();

  res.json({ success: true, message: 'Password updated.', data: { user: user.toSafeJSON() } });
});

// Engellediğim kişiler (Ayarlar > Blocked accounts), en son engellenen önce.
const getBlockedUsers = asyncHandler<AuthedRequest>(async (req, res) => {
  const me = await User.findById(req.user.id).populate('blockedUsers', USER_CARD_FIELDS);
  if (!me) throw new ApiError(404, 'User not found.');
  res.json({ success: true, data: { users: [...me.blockedUsers].reverse() } });
});

// Beni takip eden birini takipçilerimden çıkarır (Instagram'daki "Remove"). Karşı tarafa bildirim gitmez.
const removeFollower = asyncHandler<AuthedRequest>(async (req, res) => {
  const followerId = req.params.id;
  const me = await User.findByIdAndUpdate(req.user.id, { $pull: { followers: followerId } }, { returnDocument: 'after' });
  if (!me) throw new ApiError(404, 'User not found.');
  await User.updateOne({ _id: followerId }, { $pull: { following: req.user.id } });
  await removeNotification({ recipient: me._id, actor: followerId, type: 'follow' });

  res.json({ success: true, message: 'Follower removed.', data: { followersCount: me.followers.length } });
});

// Kullanıcıyı şikâyet et. Aynı kişiyi tekrar şikâyet etmek önceki kaydı günceller.
const reportUser = asyncHandler<AuthedRequest>(async (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.user.id) throw new ApiError(400, 'You cannot report yourself.');
  if (!(await User.exists({ _id: targetId }))) throw new ApiError(404, 'User not found.');

  await Report.findOneAndUpdate(
    { reporter: req.user.id, targetType: 'user', target: targetId },
    { reason: req.body.reason, details: req.body.details ?? '', status: 'new' },
    { upsert: true }
  );

  res.status(201).json({ success: true, message: 'Thanks for letting us know.' });
});

// Hesap silme onay kodu (şifre sıfırlama koduyla aynı kurallar: 10 dk geçerli, dakikada bir, 5 deneme).
const DELETE_CODE_TTL_MINUTES = 10;
const DELETE_CODE_RESEND_SECONDS = 60;
const DELETE_CODE_MAX_ATTEMPTS = 5;

// Hesap silme onay kodunu e-postaya gönderir (her hesap türünde).
const sendDeleteCode = asyncHandler<AuthedRequest>(async (req, res) => {
  const user = await User.findById(req.user.id).select('+deleteCodeSentAt');
  if (!user) throw new ApiError(404, 'User not found.');

  const sinceLast = user.deleteCodeSentAt ? (Date.now() - user.deleteCodeSentAt.getTime()) / 1000 : Infinity;
  if (sinceLast < DELETE_CODE_RESEND_SECONDS) {
    const wait = Math.ceil(DELETE_CODE_RESEND_SECONDS - sinceLast);
    throw new ApiError(429, `Please wait ${wait} seconds before requesting a new code.`);
  }

  const code = createOneTimeCode();
  user.deleteCodeHash = hashOneTimeCode(`delete:${user._id}`, code);
  user.deleteCodeExpires = new Date(Date.now() + DELETE_CODE_TTL_MINUTES * 60 * 1000);
  user.deleteCodeAttempts = 0;
  user.deleteCodeSentAt = new Date();
  await user.save();

  try {
    await sendAccountDeletionCode(user, code, DELETE_CODE_TTL_MINUTES);
  } catch (error) {
    console.error('Account deletion code email error:', (error as Error).message);
    user.deleteCodeSentAt = undefined;
    await user.save();
    throw new ApiError(502, 'We could not send the code. Please try again in a few minutes.');
  }

  res.json({
    success: true,
    message: 'We sent a code to your email.',
    data: { email: user.email, resendIn: DELETE_CODE_RESEND_SECONDS },
  });
});

// Hesabı kalıcı olarak siler. Her hesapta e-postaya gelen kod istenir: telefonu ele geçiren biri
// e-postaya erişemiyorsa hesabı silemez. Silindikten sonra bilgilendirme e-postası gönderilir.
const deleteAccount = asyncHandler<AuthedRequest>(async (req, res) => {
  const user = await User.findById(req.user.id).select('+deleteCodeHash +deleteCodeExpires +deleteCodeAttempts');
  if (!user) throw new ApiError(404, 'User not found.');

  if (!user.deleteCodeHash || !user.deleteCodeExpires || user.deleteCodeExpires < new Date()) {
    throw new ApiError(400, 'This code has expired. Please request a new one.');
  }
  if ((user.deleteCodeAttempts ?? 0) >= DELETE_CODE_MAX_ATTEMPTS) {
    throw new ApiError(429, 'Too many incorrect attempts. Please request a new code.');
  }
  if (hashOneTimeCode(`delete:${user._id}`, String(req.body.code ?? '')) !== user.deleteCodeHash) {
    user.deleteCodeAttempts = (user.deleteCodeAttempts ?? 0) + 1;
    await user.save();
    const left = DELETE_CODE_MAX_ATTEMPTS - user.deleteCodeAttempts;
    throw new ApiError(
      400,
      left > 0
        ? `The code is incorrect. ${left} attempt${left === 1 ? '' : 's'} left.`
        : 'Too many incorrect attempts. Please request a new code.'
    );
  }

  const contact = { email: user.email, fullName: user.fullName };
  await deleteAccountData(req.user.id);
  // E-posta gönderilemezse silme yine de tamamlanmış sayılır
  sendAccountDeletedEmail(contact).catch((error) =>
    console.error('Account deleted email error:', (error as Error).message)
  );
  res.json({ success: true, message: 'Your account has been deleted.' });
});

export {
  searchUsers,
  getActiveUsers,
  getSuggestions,
  getProfile,
  getUserNotes,
  getFollowers,
  getFollowing,
  getMutualFollowers,
  getUserCourses,
  follow,
  unfollow,
  block,
  unblock,
  updateProfile,
  updateAvatar,
  removeAvatar,
  changePassword,
  getBlockedUsers,
  removeFollower,
  reportUser,
  sendDeleteCode,
  deleteAccount,
};
