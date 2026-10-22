import asyncHandler, { type AuthedRequest } from '../utils/asyncHandler.ts';
import ApiError from '../utils/apiError.ts';
import { User, Conversation, DirectMessage } from '../models/index.ts';
import { isBlockedBetween } from '../services/block.service.ts';
import { emitToUsers, isOnline, toPlainJSON } from '../services/realtime.service.ts';
import {
  NOTE_CARD_FIELDS,
  findConversationOrFail,
  otherParticipantOf,
  toMessageJSON,
  sendDirectMessage,
} from '../services/directMessage.service.ts';
import type { Types } from 'mongoose';

const USER_CARD_FIELDS = 'fullName avatarUrl university department';
const MESSAGE_LIMIT = 100;
const CONVERSATION_LIMIT = 100;

// Map alanları dokümanda Map, .lean() sonucunda düz obje olarak gelir.
type UserIdMap<T> = Map<string, T> | Record<string, T> | null | undefined;

const mapValue = <T>(map: UserIdMap<T>, userId: string) => (map instanceof Map ? map.get(userId) : map?.[userId]);

// Kullanıcı konuşmayı kendi tarafında sildiyse, o andan önceki mesajlar ona gösterilmez.
const clearedAtFor = (conversation: { clearedAt?: UserIdMap<Date> }, userId: string) =>
  mapValue(conversation.clearedAt, userId) || null;

const unreadFor = (conversation: { unreadCounts?: UserIdMap<number> }, userId: string) =>
  mapValue(conversation.unreadCounts, userId) || 0;

const lastReadAtFor = (conversation: { lastReadAt?: UserIdMap<Date> }, userId: string) =>
  mapValue(conversation.lastReadAt, userId) || null;

const hasId = (ids: Types.ObjectId[] | undefined, id: Types.ObjectId | string) => Boolean(ids?.some((x) => x.equals(id)));

interface PopulatedParticipant {
  _id: Types.ObjectId;
  fullName: string;
  avatarUrl?: string;
  university: string;
  department: string;
  blockedUsers?: Types.ObjectId[];
}

// Mesajlar sayfasındaki konuşma listesi (en son mesajı olan en üstte).
const getConversations = asyncHandler<AuthedRequest>(async (req, res) => {
  const me = req.user.id;
  const [conversations, meDoc] = await Promise.all([
    Conversation.find({ participants: me, lastMessageAt: { $ne: null } })
      .sort({ lastMessageAt: -1 })
      .limit(CONVERSATION_LIMIT)
      .populate<{ participants: (PopulatedParticipant | null)[] }>('participants', `${USER_CARD_FIELDS} blockedUsers`)
      .lean(),
    User.findById(me).select('blockedUsers').lean(),
  ]);

  const items = conversations
    .filter((c) => {
      const cleared = clearedAtFor(c, me);
      return !cleared || (c.lastMessageAt != null && c.lastMessageAt > cleared);
    })
    .map((c) => {
      // Hesabı silinmiş kullanıcı populate sonucunda düşer; bu durumda otherUser null olur.
      const other = c.participants.find((p) => p && p._id.toString() !== me) ?? null;
      const blocked = !other || hasId(meDoc?.blockedUsers, other._id) || hasId(other.blockedUsers, me);
      const otherReadAt = other ? lastReadAtFor(c, other._id.toString()) : null;
      const lastAt = c.lastMessage?.createdAt ?? c.lastMessageAt;
      return {
        _id: c._id,
        otherUser: other
          ? {
              _id: other._id,
              fullName: other.fullName,
              avatarUrl: other.avatarUrl,
              university: other.university,
              department: other.department,
            }
          : null,
        // Engelleme varsa çevrimiçi durumu gösterilmez.
        isOnline: Boolean(other && !blocked && isOnline(other._id)),
        lastMessage: {
          text: c.lastMessage?.text ?? '',
          hasNote: Boolean(c.lastMessage?.hasNote),
          isMine: c.lastMessage?.sender?.toString() === me,
          isRead: Boolean(otherReadAt && lastAt && otherReadAt >= lastAt),
          createdAt: lastAt,
        },
        unreadCount: unreadFor(c, me),
      };
    });

  res.json({ success: true, data: { conversations: items } });
});

// Navbar'daki rozet için toplam okunmamış mesaj sayısı.
const getUnreadCount = asyncHandler<AuthedRequest>(async (req, res) => {
  const me = req.user.id;
  const conversations = await Conversation.find({ participants: me, [`unreadCounts.${me}`]: { $gt: 0 } })
    .select('unreadCounts')
    .lean();

  const count = conversations.reduce((sum, c) => sum + unreadFor(c, me), 0);
  res.json({ success: true, data: { count } });
});

// Bir kullanıcıyla konuşmayı açar (yoksa oluşturur) ve id'sini döndürür.
// Mesaj atılana kadar konuşma listede görünmez.
const startConversation = asyncHandler<AuthedRequest>(async (req, res) => {
  const me = req.user.id;
  const { userId } = req.body;
  if (userId === me) throw new ApiError(400, 'You cannot message yourself.');

  const exists = await User.exists({ _id: userId });
  if (!exists) throw new ApiError(404, 'User not found.');
  if (await isBlockedBetween(me, userId)) throw new ApiError(403, 'You cannot message this user.');

  const conversation = await Conversation.findOneAndUpdate(
    { participantsKey: Conversation.keyFor(me, userId) },
    { $setOnInsert: { participants: [me, userId] } },
    { upsert: true, returnDocument: 'after' }
  );

  res.json({ success: true, data: { conversationId: conversation._id } });
});

// Konuşma detayı + son mesajlar. Açılan konuşma okunmuş sayılır.
const getConversation = asyncHandler<AuthedRequest>(async (req, res) => {
  const me = req.user.id;
  const conversation = await findConversationOrFail(req.params.id, me);
  const otherId = otherParticipantOf(conversation, me);

  const cleared = clearedAtFor(conversation, me);
  const [messages, otherUser, meDoc, blockedMe] = await Promise.all([
    DirectMessage.find({ conversation: conversation._id, ...(cleared && { createdAt: { $gt: cleared } }) })
      .sort({ createdAt: -1 })
      .limit(MESSAGE_LIMIT)
      .populate('note', NOTE_CARD_FIELDS)
      .lean(),
    User.findById(otherId).select(`${USER_CARD_FIELDS} lastActiveAt`).lean(),
    User.findById(me).select('blockedUsers').lean(),
    User.exists({ _id: otherId, blockedUsers: me }),
  ]);

  const markedRead = unreadFor(conversation, me) > 0;
  if (markedRead) {
    const readAt = new Date();
    await Conversation.updateOne(
      { _id: conversation._id },
      { $set: { [`unreadCounts.${me}`]: 0, [`lastReadAt.${me}`]: readAt } }
    );
    // Kullanıcının diğer sekmelerindeki rozet düşsün, karşı taraf da "görüldü" işaretini görsün
    // (readBy/readAt ile konuşmayı yeniden çekmeden).
    emitToUsers([me, otherId], 'message:changed', { conversationId: String(conversation._id), readBy: me, readAt });
  }

  const blockedByMe = hasId(meDoc?.blockedUsers, otherId);
  const showPresence = Boolean(otherUser && !blockedByMe && !blockedMe);
  const { lastActiveAt, ...otherCard } = otherUser ?? {};

  res.json({
    success: true,
    data: {
      conversation: {
        _id: conversation._id,
        otherUser: otherUser ? otherCard : null,
        blockedByMe,
        blockedMe: Boolean(blockedMe),
        // Engelleme varsa karşı tarafın çevrimiçi durumu gizlenir.
        otherOnline: showPresence && isOnline(otherId),
        otherLastActiveAt: showPresence ? (lastActiveAt ?? null) : null,
        // Karşı tarafın konuşmayı en son okuduğu an: bu andan önceki mesajlarım "görüldü" sayılır.
        otherLastReadAt: lastReadAtFor(conversation, String(otherId)),
      },
      messages: messages.reverse().map(toMessageJSON),
      // Daha eski mesaj olabilir: istemci yukarı kaydırınca GET .../messages?before= ile ister.
      hasMore: messages.length === MESSAGE_LIMIT,
      // İstemci bu durumda okunmamış rozetini ve konuşma listesini yeniler.
      markedRead,
    },
  });
});

const OLDER_LIMIT = 50;

// Daha eski mesajlar (sohbette yukarı kaydırınca): ?before=<ISO tarih> anından önceki en fazla 50 mesaj,
// eskiden yeniye. Konuşmayı silen kullanıcı, sildiği andan önceki mesajları yine göremez.
const getOlderMessages = asyncHandler<AuthedRequest>(async (req, res) => {
  const me = req.user.id;
  const conversation = await findConversationOrFail(req.params.id, me);
  const before = new Date(String(req.query.before ?? ''));
  if (Number.isNaN(before.getTime())) throw new ApiError(400, 'A valid "before" date is required.');

  const cleared = clearedAtFor(conversation, me);
  const messages = await DirectMessage.find({
    conversation: conversation._id,
    createdAt: { $lt: before, ...(cleared && { $gt: cleared }) },
  })
    .sort({ createdAt: -1 })
    .limit(OLDER_LIMIT)
    .populate('note', NOTE_CARD_FIELDS)
    .lean();

  res.json({
    success: true,
    data: { messages: messages.reverse().map(toMessageJSON), hasMore: messages.length === OLDER_LIMIT },
  });
});

const sendMessage = asyncHandler<AuthedRequest>(async (req, res) => {
  // Asıl iş serviste: aynı kod socket "dm:send" olayında da kullanılır.
  const message = await sendDirectMessage(req.user.id, req.params.id, {
    text: req.body.text,
    noteId: req.body.noteId,
    replyTo: req.body.replyTo,
    clientId: req.body.clientId,
  });
  res.status(201).json({ success: true, data: { message } });
});

// Mesajı düzenleme: sadece gönderen düzenleyebilir.
const editMessage = asyncHandler<AuthedRequest>(async (req, res) => {
  const me = req.user.id;
  const conversation = await findConversationOrFail(req.params.id, me);
  const otherId = otherParticipantOf(conversation, me);

  const message = await DirectMessage.findOne({ _id: req.params.messageId, conversation: conversation._id });
  if (!message) throw new ApiError(404, 'Message not found.');
  if (!message.sender.equals(me)) throw new ApiError(403, 'You can only edit your own messages.');
  if (await isBlockedBetween(me, otherId)) throw new ApiError(403, 'You cannot message this user.');

  if (message.text !== req.body.text) {
    message.text = req.body.text;
    message.editedAt = new Date();
    await message.save();

    // Düzenlenen mesaj listedeki son mesajsa özet de güncellenir.
    await Conversation.updateOne(
      { _id: conversation._id, 'lastMessage.createdAt': message.createdAt, 'lastMessage.sender': message.sender },
      { $set: { 'lastMessage.text': message.text } }
    );
  }

  await message.populate('note', NOTE_CARD_FIELDS);
  const json = toMessageJSON(message);
  emitToUsers([me, otherId], 'message:changed', { conversationId: String(conversation._id), message: toPlainJSON(json) });
  res.json({ success: true, data: { message: json } });
});

// Mesajı geri alma: sadece gönderen silebilir, iki taraftan da kalkar.
const deleteMessage = asyncHandler<AuthedRequest>(async (req, res) => {
  const me = req.user.id;
  const conversation = await findConversationOrFail(req.params.id, me);

  const message = await DirectMessage.findOne({ _id: req.params.messageId, conversation: conversation._id });
  if (!message) throw new ApiError(404, 'Message not found.');
  if (!message.sender.equals(me)) throw new ApiError(403, 'You can only delete your own messages.');
  await message.deleteOne();

  // Liste özetini kalan son mesaja göre güncelle; alıcı henüz okumadıysa okunmamış sayısını düşür.
  const otherId = otherParticipantOf(conversation, me).toString();
  const latest = await DirectMessage.findOne({ conversation: conversation._id }).sort({ createdAt: -1 }).lean();
  const update: { $set?: Record<string, unknown>; $unset?: Record<string, 1> } = latest
    ? {
        $set: {
          lastMessage: {
            text: latest.text,
            sender: latest.sender,
            hasNote: Boolean(latest.note),
            createdAt: latest.createdAt,
          },
          lastMessageAt: latest.createdAt,
        },
      }
    : { $unset: { lastMessage: 1, lastMessageAt: 1 } };
  const otherUnread = unreadFor(conversation, otherId);
  if (otherUnread > 0) update.$set = { ...update.$set, [`unreadCounts.${otherId}`]: otherUnread - 1 };
  await Conversation.updateOne({ _id: conversation._id }, update);
  emitToUsers([me, otherId], 'message:changed', { conversationId: String(conversation._id), deletedId: String(message._id) });

  res.json({ success: true, message: 'Message deleted.' });
});

// Konuşmayı sadece kendi tarafında siler (karşı taraf görmeye devam eder).
const deleteConversation = asyncHandler<AuthedRequest>(async (req, res) => {
  const me = req.user.id;
  const conversation = await findConversationOrFail(req.params.id, me);

  await Conversation.updateOne(
    { _id: conversation._id },
    { $set: { [`clearedAt.${me}`]: new Date(), [`unreadCounts.${me}`]: 0 } }
  );

  res.json({ success: true, message: 'Conversation deleted.' });
});

export {
  getConversations,
  getUnreadCount,
  startConversation,
  getConversation,
  getOlderMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  deleteConversation,
};
