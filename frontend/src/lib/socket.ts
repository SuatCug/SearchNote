import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/services/baseApi';
import type { ApiErrorBody, DirectMessage, GroupMessage } from '@/types/api';

// Sunucudan gelen olaylar çoğunlukla "bir şey değişti" sinyali taşır (bkz. backend/sockets/index.ts).
// Mesaj olayları değişen mesajın kendisini de taşır: açık sohbet yeniden çekmeden günceller.
export interface ServerToClientEvents {
  'notifications:changed': () => void;
  'message:changed': (payload: {
    conversationId: string;
    // Yeni mesajda gönderen; message: yeni ya da düzenlenen mesaj, deletedId: silinen mesaj,
    // readBy/readAt: konuşmayı okuyan kişi ve zamanı.
    senderId?: string;
    message?: DirectMessage;
    deletedId?: string;
    readBy?: string;
    readAt?: string;
  }) => void;
  'group:message': (payload: { groupId: string; message?: GroupMessage; deletedId?: string }) => void;
  // Üyesi olduğum grupta yeni mesaj ya da paylaşılan not ("Gruplarım" listesi için).
  'group:activity': (payload: { groupId: string }) => void;
  'presence:changed': (payload: { userId: string }) => void;
  // Mesajlaştığım biri çevrimiçi oldu / çıktı.
  'dm:presence': (payload: { userId: string }) => void;
  // Konuşmadaki karşı taraf yazıyor.
  'dm:typing': (payload: { conversationId: string; userId: string }) => void;
}

export interface ClientToServerEvents {
  'group:join': (groupId: string, ack?: (res: { ok: boolean }) => void) => void;
  'group:leave': (groupId: string) => void;
  'dm:typing': (conversationId: string) => void;
  'dm:send': (
    payload: { conversationId: string; text: string; noteId?: string | null; replyTo?: string | null; clientId: string },
    ack: (res: DmSendResult) => void
  ) => void;
}

export type DmSendResult = { ok: true; message: DirectMessage } | ({ ok: false; status: number } & ApiErrorBody);

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Socket.io sunucusu API ile aynı adreste çalışır (".../api" öneki olmadan).
const SOCKET_URL = new URL(API_URL, window.location.origin).origin;

let socket: AppSocket | null = null;
const listeners = new Set<() => void>();
// Açık grup sohbetleri: yeniden bağlanınca odalara tekrar katılmak için (aynı grup birden fazla yerde açık olabilir).
const joinedGroups = new Map<string, number>();

const emitChange = () => listeners.forEach((listener) => listener());

export const connectSocket = (token: string) => {
  disconnectSocket();
  const next: AppSocket = io(SOCKET_URL, { auth: { token } });
  socket = next;
  next.on('connect', () => {
    joinedGroups.forEach((_, groupId) => next.emit('group:join', groupId));
    emitChange();
  });
  next.on('disconnect', emitChange);
  next.on('connect_error', emitChange);
  return next;
};

export const disconnectSocket = () => {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  emitChange();
};

export const getSocket = () => socket;

export const joinGroupRoom = (groupId: string) => {
  joinedGroups.set(groupId, (joinedGroups.get(groupId) || 0) + 1);
  if (socket?.connected) socket.emit('group:join', groupId);
};

export const leaveGroupRoom = (groupId: string) => {
  const count = (joinedGroups.get(groupId) || 1) - 1;
  if (count > 0) {
    joinedGroups.set(groupId, count);
    return;
  }
  joinedGroups.delete(groupId);
  if (socket?.connected) socket.emit('group:leave', groupId);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useSocketConnected = () => useSyncExternalStore(subscribe, () => Boolean(socket?.connected));

// Veriler normalde socket olaylarıyla anında yenilenir; bağlantı yokken (koptu / kurulamadı)
// yedek olarak verilen aralıkla sorgulama (polling) yapılır.
export const useFallbackPolling = (intervalMs: number) => (useSocketConnected() ? 0 : intervalMs);

// --- "Yazıyor..." göstergesi ---
// Karşı taraf yazarken birkaç saniyede bir sinyal gelir; son sinyalden bu kadar süre sonra gösterge kalkar.
const TYPING_TTL_MS = 4000;
// Kendi yazarken sinyali en fazla bu aralıkla gönderiyoruz.
const TYPING_THROTTLE_MS = 2500;

const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
let typingSnapshot: ReadonlySet<string> = new Set();
const typingListeners = new Set<() => void>();

const setTyping = (conversationId: string, on: boolean) => {
  const next = new Set(typingSnapshot);
  if (on) next.add(conversationId);
  else next.delete(conversationId);
  typingSnapshot = next;
  typingListeners.forEach((listener) => listener());
};

export const markTyping = (conversationId: string) => {
  clearTimeout(typingTimers.get(conversationId));
  typingTimers.set(
    conversationId,
    setTimeout(() => {
      typingTimers.delete(conversationId);
      setTyping(conversationId, false);
    }, TYPING_TTL_MS)
  );
  if (!typingSnapshot.has(conversationId)) setTyping(conversationId, true);
};

// Karşı taraftan mesaj gelince gösterge hemen kalkar (yazmaya devam ederse yeni sinyalle geri gelir).
export const clearTyping = (conversationId: string) => {
  clearTimeout(typingTimers.get(conversationId));
  typingTimers.delete(conversationId);
  if (typingSnapshot.has(conversationId)) setTyping(conversationId, false);
};

const subscribeTyping = (listener: () => void) => {
  typingListeners.add(listener);
  return () => {
    typingListeners.delete(listener);
  };
};

// Şu an karşı tarafın yazdığı konuşmaların id'leri.
export const useTypingConversations = () => useSyncExternalStore(subscribeTyping, () => typingSnapshot);

const lastTypingSent = new Map<string, number>();

export const sendTyping = (conversationId: string) => {
  const now = Date.now();
  if (!socket?.connected || now - (lastTypingSent.get(conversationId) ?? 0) < TYPING_THROTTLE_MS) return;
  lastTypingSent.set(conversationId, now);
  socket.emit('dm:typing', conversationId);
};

// Mesaj gönderilince bir sonraki tuşta hemen yeni sinyal gidebilsin.
export const resetTypingThrottle = (conversationId: string) => lastTypingSent.delete(conversationId);
