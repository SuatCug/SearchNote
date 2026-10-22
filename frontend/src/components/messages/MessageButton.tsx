import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { MessageCircle } from 'lucide-react';
import { messagesApi, useStartConversationMutation } from '@/services/messagesApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { useDialog } from '@/components/common/DialogProvider';

// Kullanıcı başına konuşma id'si (oturum sahibi + karşı taraf). Butonun üzerine gelinince / dokunulunca konuşma
// önceden açılır, tıklamada id hazır olduğu için mesajlar sayfasına beklemeden geçilir. Henüz mesaj yoksa
// boş konuşma listede görünmez.
const conversationIds = new Map<string, Promise<string>>();

// Kullanıcıyla konuşmayı açıp mesajlar sayfasına götürür. noteId verilirse ("Ask the author")
// not, ilk mesaja eklenmek üzere mesaj kutusuna iliştirilir.
interface MessageButtonProps {
  userId: string;
  noteId?: string;
  label?: string;
  className?: string;
}

export default function MessageButton({ userId, noteId, label = 'Message', className = 'btn-secondary' }: MessageButtonProps) {
  const token = useAppSelector((state) => state.auth.token);
  const myId = useAppSelector((state) => state.auth.user?.id);
  const isVerified = useAppSelector((state) => state.auth.user?.isVerified);
  // Konuşma listesi önbellekteyse id oradan alınır (sunucuya hiç gidilmez).
  const cachedId = useAppSelector(
    (state) =>
      messagesApi.endpoints.getConversations
        .select()(state)
        .data?.data.conversations.find((c) => c.otherUser?._id === userId)?._id
  );
  const navigate = useNavigate();
  const [startConversation] = useStartConversationMutation();
  const prefetchConversation = messagesApi.usePrefetch('getConversation');
  // Açılırken tekrar tıklama yok sayılır. Buton disabled yapılmaz: kısa bir an "yasak" imleci ve soluklaşma görünüyordu.
  const opening = useRef(false);
  const dialog = useDialog();
  const canMessage = Boolean(token && isVerified);

  const getConversationId = () => {
    if (cachedId) return Promise.resolve(cachedId);
    const key = `${myId}:${userId}`;
    let pending = conversationIds.get(key);
    if (!pending) {
      pending = startConversation(userId)
        .unwrap()
        .then(({ data }) => data.conversationId);
      // Hata olursa saklanmaz: tıklamada tekrar denenir ve hata o zaman gösterilir.
      pending.catch(() => conversationIds.delete(key));
      conversationIds.set(key, pending);
    }
    return pending;
  };

  // Fare üstüne gelince / klavyeyle odaklanınca sadece id hazırlanır.
  const prepare = () => {
    if (canMessage) getConversationId().catch(() => {});
  };

  // Basıldığı an (tıklamadan biraz önce) konuşma verisi de çekilmeye başlar; açılış okunmuş sayılır, bu yüzden
  // üstüne gelince değil sadece basınca yapılır.
  const handlePointerDown = () => {
    if (!canMessage) return;
    getConversationId()
      .then((id) => prefetchConversation(id))
      .catch(() => {});
  };

  const handleClick = async () => {
    if (!token) return navigate('/login');
    if (opening.current) return;
    opening.current = true;
    try {
      const id = await getConversationId();
      navigate(`/messages/${id}${noteId ? `?note=${noteId}` : ''}`);
    } catch (err) {
      opening.current = false;
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerEnter={prepare}
      onFocus={prepare}
      onPointerDown={handlePointerDown}
      disabled={Boolean(token && !isVerified)}
      title={token && !isVerified ? 'Verify your email to send messages' : undefined}
      className={className}
    >
      <MessageCircle size={16} /> {label}
    </button>
  );
}
