import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { baseApi, type TagType } from '@/services/baseApi';
import { removeDirectMessage, setOtherLastReadAt, upsertDirectMessage } from '@/services/messagesApi';
import { removeGroupMessage, upsertGroupMessage } from '@/services/groupsApi';
import { clearTyping, connectSocket, disconnectSocket, markTyping } from '@/lib/socket';

// Socket olayları çoğunlukla "bu veri değişti" sinyalidir; ilgili RTK Query önbelleği geçersiz kılınır ve
// açık bileşenler veriyi REST API'den yeniden çeker (yetki kontrolü tek yerde kalır).
// Mesaj olayları mesajın kendisini de taşır: açık sohbete beklemeden eklenir.
const REALTIME_TAGS: TagType[] = ['Notifications', 'Conversations', 'Unread', 'ActiveUsers', 'GroupMessages', 'GroupActivity'];

export default function RealtimeBridge() {
  const token = useAppSelector((state) => state.auth.token);
  const myId = useAppSelector((state) => state.auth.user?.id);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!token) return undefined;

    const socket = connectSocket(token);
    const invalidate = (tags: (TagType | { type: TagType; id: string })[]) => dispatch(baseApi.util.invalidateTags(tags));
    let connectedBefore = false;

    // Bağlantı koptuktan sonra geri gelince arada kaçan olaylar için hepsi bir kez yenilenir.
    socket.on('connect', () => {
      if (connectedBefore) invalidate(REALTIME_TAGS);
      connectedBefore = true;
    });
    // Bildirim (beğeni/yorum) gelince açık not detayı da sayıları güncellesin.
    socket.on('notifications:changed', () => invalidate(['Notifications', 'Note']));
    socket.on('message:changed', ({ conversationId, senderId, message, deletedId, readBy, readAt }) => {
      const fromOther = Boolean(senderId && senderId !== myId);
      if (fromOther) clearTyping(conversationId);

      if (message) {
        dispatch(upsertDirectMessage(conversationId, message));
        // Karşı taraftan gelen mesaj ekranda zaten görünür; konuşma açıksa arka planda bir kez yeniden çekilir
        // ki sunucu okundu işaretlesin (karşı taraf "görüldü"yü görür, rozet düşer).
        invalidate(fromOther ? [{ type: 'Conversation', id: conversationId }, 'Conversations', 'Unread'] : ['Conversations']);
      } else if (deletedId) {
        dispatch(removeDirectMessage(conversationId, deletedId));
        invalidate(['Conversations', 'Unread']);
      } else if (readBy && readAt) {
        if (readBy !== myId) dispatch(setOtherLastReadAt(conversationId, readAt));
        invalidate(['Conversations', 'Unread']);
      } else {
        invalidate([{ type: 'Conversation', id: conversationId }, 'Conversations', 'Unread']);
      }
    });
    socket.on('dm:typing', ({ conversationId }) => markTyping(conversationId));
    // Mesajlaştığım biri çevrimiçi oldu / çıktı: liste ve açık sohbet başlığı yenilenir.
    socket.on('dm:presence', () => invalidate(['Conversations', 'Conversation']));
    socket.on('group:message', ({ groupId, message, deletedId }) => {
      if (message) {
        dispatch(upsertGroupMessage(groupId, message));
        // Başkasının mesajı: sohbet arka planda yeniden çekilir ki grup okundu sayılsın ("Gruplarım" rozeti).
        if (message.user?._id !== myId) invalidate([{ type: 'GroupMessages', id: groupId }]);
      } else if (deletedId) {
        dispatch(removeGroupMessage(groupId, deletedId));
      } else {
        invalidate([{ type: 'GroupMessages', id: groupId }]);
      }
    });
    // Üyesi olduğum bir grupta yeni mesaj / not: "Gruplarım" listesi (son hareket, okunmamış) yenilenir.
    socket.on('group:activity', () => invalidate(['GroupActivity']));
    socket.on('presence:changed', () => invalidate(['ActiveUsers']));

    return () => disconnectSocket();
  }, [token, myId, dispatch]);

  return null;
}
