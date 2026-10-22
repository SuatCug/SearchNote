// Socket.io örneğine controller'lardan erişmek için ince bir katman.
// Socket sunucusu başlatılmamışsa (örn. betikler, testler) emit çağrıları sessizce atlanır.
import type { Server } from 'socket.io';
import type { IdLike } from '../types/common.ts';

let io: Server | null = null;

// Çevrimiçi kullanıcılar: userId -> açık bağlantı (sekme/cihaz) sayısı. Tek sunucu örneği için bellekte tutulur.
const connections = new Map<string, number>();

const setIo = (instance: Server) => {
  io = instance;
};

const userRoom = (userId: IdLike) => `user:${userId}`;
const groupRoom = (groupId: IdLike) => `group:${groupId}`;

// Olayla gönderilen Mongoose belgesi / ObjectId alanları REST yanıtındaki gibi düz JSON'a çevrilir
// (ObjectId içindeki Buffer, socket.io'da ikili veri sanılmasın).
const toPlainJSON = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

// Bir ya da birden fazla kullanıcının tüm açık bağlantılarına olay gönderir.
const emitToUsers = (userIds: IdLike | null | undefined | (IdLike | null | undefined)[], event: string, payload: object = {}) => {
  if (!io) return;
  const ids = (Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean).map(String);
  if (ids.length) io.to(ids.map(userRoom)).emit(event, payload);
};

const emitToGroup = (groupId: IdLike | null | undefined, event: string, payload: object = {}) => {
  if (!io || !groupId) return;
  io.to(groupRoom(String(groupId))).emit(event, payload);
};

// Bağlantı eklendiğinde kullanıcı ilk kez çevrimiçi olduysa true döner.
const addConnection = (userId: string) => {
  const count = (connections.get(userId) || 0) + 1;
  connections.set(userId, count);
  return count === 1;
};

// Bağlantı kapandığında kullanıcının son bağlantısıysa true döner (artık çevrimdışı).
const removeConnection = (userId: string) => {
  const count = (connections.get(userId) || 1) - 1;
  if (count <= 0) {
    connections.delete(userId);
    return true;
  }
  connections.set(userId, count);
  return false;
};

const getOnlineUserIds = () => [...connections.keys()];

const isOnline = (userId: IdLike) => connections.has(String(userId));

// Kullanıcının tüm açık bağlantılarını kapatır (hesap silindiğinde).
const disconnectUser = (userId: IdLike) => {
  io?.in(userRoom(userId)).disconnectSockets(true);
};

export {
  toPlainJSON,
  disconnectUser,
  setIo,
  userRoom,
  groupRoom,
  emitToUsers,
  emitToGroup,
  addConnection,
  removeConnection,
  getOnlineUserIds,
  isOnline,
};
