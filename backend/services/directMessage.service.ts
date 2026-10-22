import ApiError from '../utils/apiError.ts';
import { User, Note, Conversation, DirectMessage } from '../models/index.ts';
import { assertNoteVisible } from './note.service.ts';
import { isBlockedBetween } from './block.service.ts';
import { emitToUsers, toPlainJSON } from './realtime.service.ts';
import { pushDirectMessage } from './push.service.ts';
import { createLimiter } from '../middlewares/rateLimit.middleware.ts';
import type { Types } from 'mongoose';
import type { ConversationDocument } from '../models/conversation.model.ts';

const NOTE_CARD_FIELDS = 'title courseCode courseName fileType';
// Yanıt alıntısında saklanan metnin en fazla uzunluğu.
const REPLY_SNIPPET_LENGTH = 200;
const MESSAGE_MAX_LENGTH = 2000;

// Spam'e karşı: kullanıcı başına dakikada en fazla 20 mesaj. HTTP ve socket aynı sayacı paylaşır.
const MESSAGE_RATE_ERROR = 'You are sending messages too fast. Please wait a moment.';
const allowMessage = createLimiter({ windowMs: 60 * 1000, max: 20 });

// Sadece katılımcıların görebildiği konuşma; değilse konuşma yokmuş gibi 404 döner.
const findConversationOrFail = async (id: string, userId: string) => {
  const conversation = await Conversation.findById(id);
  if (!conversation || !conversation.hasParticipant(userId)) throw new ApiError(404, 'Conversation not found.');
  return conversation;
};

// Konuşmanın diğer katılımcısı (her konuşmada iki katılımcı vardır).
const otherParticipantOf = (conversation: ConversationDocument, userId: string) => {
  const other = conversation.otherParticipant(userId);
  if (!other) throw new ApiError(404, 'Conversation not found.');
  return other;
};

interface MessageLike {
  _id: Types.ObjectId;
  sender: Types.ObjectId;
  text: string;
  note?: unknown;
  reply?: { message: Types.ObjectId; sender: Types.ObjectId; text: string } | null;
  editedAt?: Date | null;
  clientId?: string | null;
  createdAt: Date;
}

const toMessageJSON = (m: MessageLike) => ({
  _id: m._id,
  sender: m.sender,
  text: m.text,
  note: m.note ?? null,
  reply: m.reply?.message ? { message: m.reply.message, sender: m.reply.sender, text: m.reply.text } : null,
  editedAt: m.editedAt ?? null,
  // Gönderenin ekranındaki "gönderiliyor" balonu, kaydedilen mesajla bu kimlikle eşleşir.
  ...(m.clientId && { clientId: m.clientId }),
  createdAt: m.createdAt,
});

interface SendInput {
  text: string;
  noteId?: string | null;
  replyTo?: string | null;
  // İstemcinin mesaja verdiği kimlik: aynı mesaj iki kez gelirse (socket + HTTP yedeği) tek kayıt oluşur.
  clientId?: string | null;
}

// Kullanıcı başına sıra: istemci mesajları birbirini beklemeden gönderebilir, sunucu yine de
// geliş sırasıyla kaydeder (aksi halde notlu mesajın kontrolü uzun sürüp sonraki mesajın önüne geçebilirdi).
const senderQueues = new Map<string, Promise<unknown>>();

const inSenderOrder = <T>(senderId: string, task: () => Promise<T>) => {
  const run = (senderQueues.get(senderId) ?? Promise.resolve()).then(task);
  const tail = run.then(
    () => {},
    () => {}
  );
  senderQueues.set(senderId, tail);
  // Sıra boşalınca kayıt silinir (bellek büyümesin).
  tail.then(() => {
    if (senderQueues.get(senderId) === tail) senderQueues.delete(senderId);
  });
  return run;
};

// Birebir mesaj gönderme (REST endpoint'i ve socket "dm:send" olayı bunu kullanır).
const sendDirectMessage = (me: string, conversationId: string, input: SendInput) =>
  inSenderOrder(me, () => saveDirectMessage(me, conversationId, input));

// Birbirinden bağımsız kontroller paralel çalışır; böylece veritabanına sırayla 5-6 kez gidilmez.
const saveDirectMessage = async (me: string, conversationId: string, { text, noteId, replyTo, clientId }: SendInput) => {
  const conversation = await findConversationOrFail(conversationId, me);
  const otherId = otherParticipantOf(conversation, me);

  const [existing, otherExists, blocked, note, original] = await Promise.all([
    clientId
      ? DirectMessage.findOne({ conversation: conversation._id, sender: me, clientId }).populate('note', NOTE_CARD_FIELDS).lean()
      : null,
    User.exists({ _id: otherId }),
    isBlockedBetween(me, otherId),
    noteId ? Note.findById(noteId).select('group author visibility') : null,
    // Yanıtlanan mesaj aynı konuşmada olmalı.
    replyTo ? DirectMessage.findOne({ _id: replyTo, conversation: conversation._id }).select('sender text').lean() : null,
  ]);

  // Bu mesaj daha önce kaydedildi (tekrar gönderim): aynısı döner, ikinci kez eklenmez.
  if (existing) return toMessageJSON(existing);

  if (!allowMessage(me)) throw new ApiError(429, MESSAGE_RATE_ERROR);
  if (!otherExists) throw new ApiError(404, 'This user no longer exists.');
  if (blocked) throw new ApiError(403, 'You cannot message this user.');

  // Eklenen not hem gönderene hem alıcıya görünür olmalı (grup notları sadece grup üyelerine görünür).
  if (noteId) {
    if (!note) throw new ApiError(404, 'Note not found.');
    const [forMe, forOther] = await Promise.allSettled([
      assertNoteVisible(note, me),
      assertNoteVisible(note, otherId.toString()),
    ]);
    if (forMe.status === 'rejected') throw forMe.reason;
    if (forOther.status === 'rejected') {
      throw new ApiError(403, "The recipient can't see this note (it's shared with a group or only with the author's followers).");
    }
  }

  if (replyTo && !original) throw new ApiError(404, 'The message you are replying to no longer exists.');
  const reply = original
    ? { message: original._id, sender: original.sender, text: original.text.slice(0, REPLY_SNIPPET_LENGTH) }
    : undefined;

  let message;
  try {
    message = await DirectMessage.create({
      conversation: conversation._id,
      sender: me,
      text,
      note: note?._id,
      reply,
      clientId: clientId || undefined,
    });
  } catch (err) {
    // Aynı clientId ile eş zamanlı iki istek: ikincisi benzersiz index'e takılır, ilk kayıt döner.
    if (clientId && (err as { code?: number }).code === 11000) {
      const saved = await DirectMessage.findOne({ conversation: conversation._id, sender: me, clientId })
        .populate('note', NOTE_CARD_FIELDS)
        .lean();
      if (saved) return toMessageJSON(saved);
    }
    throw err;
  }

  await Promise.all([
    Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessage: { text: message.text, sender: me, hasNote: Boolean(note), createdAt: message.createdAt },
          lastMessageAt: message.createdAt,
          // Mesaj atan, konuşmadaki önceki mesajları da görmüş sayılır.
          [`lastReadAt.${me}`]: message.createdAt,
        },
        $inc: { [`unreadCounts.${otherId}`]: 1 },
      }
    ),
    note ? message.populate('note', NOTE_CARD_FIELDS) : null,
  ]);

  const json = toMessageJSON(message);
  // İki tarafın da açık sekmeleri konuşmayı ve okunmamış sayısını anında yeniler.
  // senderId: alıcı tarafta "yazıyor..." göstergesi hemen kalksın.
  // message: istemci mesajı yeniden çekmeden doğrudan ekrana ekler (bu alanı tanımayan istemciler yok sayar).
  emitToUsers([me, otherId], 'message:changed', {
    conversationId: String(conversation._id),
    senderId: me,
    message: toPlainJSON(json),
  });
  // Uygulaması kapalıysa telefonuna bildirim (beklenmez; hata gönderimi bozmaz)
  pushDirectMessage(otherId, me, conversation._id, message.text, Boolean(note)).catch((e) =>
    console.error('Push error:', (e as Error).message)
  );
  return json;
};

export {
  NOTE_CARD_FIELDS,
  MESSAGE_MAX_LENGTH,
  MESSAGE_RATE_ERROR,
  allowMessage,
  findConversationOrFail,
  otherParticipantOf,
  toMessageJSON,
  sendDirectMessage,
};
