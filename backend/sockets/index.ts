import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt.util.ts';
import mongoose from 'mongoose';
import { User, Group, Conversation } from '../models/index.ts';
import { isBlockedBetween } from '../services/block.service.ts';
import * as realtime from '../services/realtime.service.ts';
import { sendDirectMessage, MESSAGE_MAX_LENGTH } from '../services/directMessage.service.ts';
import ApiError from '../utils/apiError.ts';

interface DmSendPayload {
  conversationId?: unknown;
  text?: unknown;
  noteId?: unknown;
  replyTo?: unknown;
  clientId?: unknown;
}

type DmSendAck = (
  result: { ok: true; message: unknown } | { ok: false; status: number; message: string }
) => void;

const optionalId = (value: unknown) => {
  if (value == null || value === '') return null;
  if (!mongoose.isValidObjectId(value)) throw new ApiError(400, 'Invalid id.');
  return String(value);
};

// REST'teki sendMessageRules'ın socket karşılığı.
const parseDmSend = (payload: DmSendPayload) => {
  if (!mongoose.isValidObjectId(payload?.conversationId)) throw new ApiError(404, 'Conversation not found.');
  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  if (!text) throw new ApiError(400, 'Message cannot be empty.');
  if (text.length > MESSAGE_MAX_LENGTH) throw new ApiError(400, 'Message can be at most 2000 characters.');
  const clientId = typeof payload.clientId === 'string' && payload.clientId ? payload.clientId.slice(0, 64) : null;
  return {
    conversationId: String(payload.conversationId),
    input: { text, noteId: optionalId(payload.noteId), replyTo: optionalId(payload.replyTo), clientId },
  };
};

// Kullanıcıyı takip edenlere "çevrimiçi durumu değişti" bildirimi: istemciler "Active now" listesini yeniler
// (listede kimin görüneceğine — karşılıklı takip — sunucu karar verir).
const broadcastPresence = async (userId: string) => {
  const user = await User.findById(userId).select('followers').lean();
  if (user?.followers?.length) realtime.emitToUsers(user.followers, 'presence:changed', { userId });

  // Mesajlaştığı kişiler de sohbet başlığındaki "Active now" durumunu yeniler.
  const conversations = await Conversation.find({ participants: userId, lastMessageAt: { $ne: null } })
    .select('participants')
    .lean();
  const partners = conversations.flatMap((c) => c.participants.filter((id) => !id.equals(userId)));
  if (partners.length) realtime.emitToUsers(partners, 'dm:presence', { userId });
};

const touchActivity = (userId: string) =>
  User.updateOne({ _id: userId }, { $set: { lastActiveAt: new Date() } }).catch(() => {});

// Socket.io sunucusunu HTTP sunucusuna bağlar.
// Olaylar çoğunlukla "bir şey değişti" sinyali taşır; istemci ilgili veriyi REST API'den yeniden çeker.
// Böylece yetki kontrolleri tek yerde (REST) kalır. İstisna: mesaj olayları, yetkisi zaten kontrol edilmiş
// mesajın kendisini de taşır (sadece konuşmanın katılımcılarına / grup odasındaki üyelere gider).
const initSocket = (httpServer: HttpServer, allowedOrigins: string[] | undefined) => {
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins?.length ? allowedOrigins : '*' },
  });

  // El sıkışmada JWT doğrulaması: token yoksa ya da geçersizse bağlantı reddedilir.
  io.use(async (socket, next) => {
    try {
      const { id } = verifyToken(socket.handshake.auth?.token);
      const user = await User.findById(id).select('isVerified');
      if (!user) return next(new Error('unauthorized'));
      // E-postasını doğrulamamış oturumlar anlık sisteme bağlanamaz (doğrulama şartı açıksa).
      if (!user.hasVerifiedAccess()) return next(new Error('email_not_verified'));
      socket.data.userId = String(id);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { userId } = socket.data;
    socket.join(realtime.userRoom(userId));
    touchActivity(userId);
    if (realtime.addConnection(userId)) broadcastPresence(userId).catch(() => {});

    // Grup sohbeti odası: sadece grup üyeleri katılabilir.
    socket.on('group:join', async (groupId, ack) => {
      try {
        const isMember = await Group.exists({ _id: groupId, members: userId });
        if (isMember) socket.join(realtime.groupRoom(String(groupId)));
        ack?.({ ok: Boolean(isMember) });
      } catch {
        ack?.({ ok: false });
      }
    });

    socket.on('group:leave', (groupId) => {
      socket.leave(realtime.groupRoom(String(groupId)));
    });

    // "Yazıyor..." sinyali: sadece konuşmanın diğer katılımcısına iletilir (engelleme varsa iletilmez).
    socket.on('dm:typing', async (conversationId) => {
      try {
        if (!mongoose.isValidObjectId(conversationId)) return;
        const conversation = await Conversation.findById(conversationId).select('participants').lean();
        if (!conversation?.participants.some((id) => id.equals(userId))) return;
        const otherId = conversation.participants.find((id) => !id.equals(userId));
        if (!otherId || (await isBlockedBetween(userId, otherId))) return;
        realtime.emitToUsers(otherId, 'dm:typing', { conversationId: String(conversationId), userId });
      } catch {
        // Yazıyor sinyali kritik değil; hata sessizce yok sayılır.
      }
    });

    // Mesajı açık bağlantı üzerinden gönderme (mobil uygulama): her mesajda yeni HTTP isteği kurulmaz.
    // Yetki kontrolleri REST ile aynı servisten geçer; sonuç ack ile döner.
    socket.on('dm:send', async (payload: DmSendPayload, ack?: DmSendAck) => {
      if (typeof ack !== 'function') return;
      try {
        const { conversationId, input } = parseDmSend(payload);
        const message = await sendDirectMessage(userId, conversationId, input);
        // ObjectId/Date alanları REST yanıtındaki gibi düz JSON'a çevrilir.
        ack({ ok: true, message: JSON.parse(JSON.stringify(message)) });
      } catch (err) {
        const status = err instanceof ApiError ? err.statusCode : 500;
        ack({ ok: false, status, message: err instanceof ApiError ? err.message : 'Something went wrong.' });
      }
    });

    socket.on('disconnect', () => {
      touchActivity(userId);
      if (realtime.removeConnection(userId)) broadcastPresence(userId).catch(() => {});
    });
  });

  realtime.setIo(io);
  return io;
};

export default initSocket;
