import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MessagesSquare } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import ConversationList from '@/components/messages/ConversationList';
import ChatPanel from '@/components/messages/ChatPanel';
import { useGetConversationsQuery } from '@/services/messagesApi';
import { useFallbackPolling } from '@/lib/socket';
import { DESKTOP_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';

// Konuşma listesi Socket.io olaylarıyla anında yenilenir; bağlantı yoksa bu aralıkla yoklanır.
const LIST_POLL_INTERVAL_MS = 10000;

// Telefonda sohbet ekranın görünen kısmına (klavye açıkken klavyenin üstüne) oturur.
// Klavye açılınca bazı tarayıcılar sayfayı değil sadece görünen alanı küçültür; visualViewport bunu verir.
function useVisualViewport(active: boolean) {
  const [box, setBox] = useState<{ height: number; top: number } | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return undefined;
    const update = () => setBox({ height: vv.height, top: vv.offsetTop });
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [active]);

  return active ? box : null;
}

// /messages: büyük ekranda solda konuşmalar, sağda sohbet (tek kart).
// Telefonda liste sayfanın kendisidir; konuşma açılınca sohbet tam ekran açılır (üst bar ve alt sekmeler gizlenir).
export default function MessagesPage() {
  const { id } = useParams();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const mobileChat = Boolean(id) && !isDesktop;
  const viewport = useVisualViewport(mobileChat);
  const { data, isLoading, error } = useGetConversationsQuery(undefined, {
    pollingInterval: useFallbackPolling(LIST_POLL_INTERVAL_MS),
    skipPollingIfUnfocused: true,
  });

  // Tam ekran sohbet açıkken arkadaki sayfa kaymasın.
  useEffect(() => {
    if (!mobileChat) return undefined;
    document.documentElement.classList.add('chat-open');
    return () => document.documentElement.classList.remove('chat-open');
  }, [mobileChat]);

  return (
    <PageLayout>
      <div className="-mx-4 sm:-mx-6 -my-6 sm:-my-8 min-h-[calc(100dvh-8rem)] bg-white lg:m-0 lg:min-h-[560px] lg:h-[calc(100dvh-10rem)] lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:overflow-hidden lg:rounded-2xl lg:border lg:border-gray-200 lg:shadow-sm">
        <aside className={`lg:min-h-0 lg:border-r lg:border-gray-100 ${id ? 'hidden lg:block' : ''}`}>
          <ConversationList conversations={data?.data?.conversations} isLoading={isLoading} error={error} />
        </aside>

        {id ? (
          <section
            className="fixed inset-x-0 top-0 h-dvh z-[60] bg-white lg:static lg:z-auto lg:h-auto lg:min-h-0"
            style={mobileChat && viewport ? { height: viewport.height, top: viewport.top } : undefined}
          >
            <ChatPanel key={id} conversationId={id} />
          </section>
        ) : (
          <section className="hidden lg:flex flex-col items-center justify-center text-center text-gray-400 px-6">
            <span className="w-16 h-16 rounded-full bg-navy-50 text-navy-600 flex items-center justify-center">
              <MessagesSquare size={28} />
            </span>
            <p className="mt-4 font-semibold text-gray-800">Your messages</p>
            <p className="mt-1 text-sm">Select a conversation or start a new one.</p>
          </section>
        )}
      </div>
    </PageLayout>
  );
}
