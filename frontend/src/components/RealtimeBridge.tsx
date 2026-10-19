import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { baseApi, type TagType } from '@/services/baseApi';
import { clearTyping, connectSocket, disconnectSocket, markTyping } from '@/lib/socket';

// Socket olayları sadece "bu veri değişti" sinyalidir; ilgili RTK Query önbelleği geçersiz kılınır ve
// açık bileşenler veriyi REST API'den yeniden çeker (yetki kontrolü tek yerde kalır).
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
    socket.on('message:changed', ({ conversationId, senderId }) => {
      if (senderId && senderId !== myId) clearTyping(conversationId);
      invalidate([{ type: 'Conversation', id: conversationId }, 'Conversations', 'Unread']);
    });
    socket.on('dm:typing', ({ conversationId }) => markTyping(conversationId));
    // Mesajlaştığım biri çevrimiçi oldu / çıktı: liste ve açık sohbet başlığı yenilenir.
    socket.on('dm:presence', () => invalidate(['Conversations', 'Conversation']));
    socket.on('group:message', ({ groupId }) => invalidate([{ type: 'GroupMessages', id: groupId }]));
    // Üyesi olduğum bir grupta yeni mesaj / not: "Gruplarım" listesi (son hareket, okunmamış) yenilenir.
    socket.on('group:activity', () => invalidate(['GroupActivity']));
    socket.on('presence:changed', () => invalidate(['ActiveUsers']));

    return () => disconnectSocket();
  }, [token, myId, dispatch]);

  return null;
}
