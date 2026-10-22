import { useEffect, useState } from 'react';
import { Check, CornerUpRight, FileText, Loader2, Search } from 'lucide-react';
import ChatSheet from './ChatSheet';
import UserAvatar from '@/components/users/UserAvatar';
import Alert from '@/components/common/Alert';
import { useSearchUsersQuery } from '@/services/usersApi';
import {
  useGetConversationsQuery,
  useSendDirectMessageMutation,
  useStartConversationMutation,
} from '@/services/messagesApi';
import { useAppSelector } from '@/app/hooks';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { newClientId } from '@/lib/clientId';
import type { UserCard } from '@/types/api';

const MAX_RECIPIENTS = 10;
const MIN_QUERY = 2;
// Sunucu boş mesaj kabul etmiyor; not yazısız gönderilirse bu gider (mobilde de aynı).
const DEFAULT_NOTE_TEXT = 'Check out this note 📚';

// Gönderilecek şey: iletilen mesaj (text dolu) ya da paylaşılan not (text yok, isteğe bağlı yazı eklenir).
export interface SendItem {
  text?: string;
  note: { _id: string; title: string } | null;
}

// Notu mesajla gönderir ya da mesajı iletir (mobildeki ForwardSheet'in web hali): arama boşken son konuştuğum
// kişiler, yazınca kişi araması; en fazla 10 kişi seçilir. Sunucuda ayrı bir "iletme" yok: her kişiyle konuşma
// açılır (yoksa oluşturulur) ve yazı + ekli not yeni mesaj olarak gönderilir.
export default function ForwardSheet({
  item,
  onClose,
}: {
  item: SendItem;
  onClose: () => void;
}) {
  const me = useAppSelector((state) => state.auth.user);
  const isNote = item.text === undefined;
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<UserCard[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [startConversation] = useStartConversationMutation();
  const [sendMessage] = useSendDirectMessageMutation();

  // Her tuşta istek atmamak için kısa bir gecikme.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const searching = debounced.length >= MIN_QUERY;
  const conversations = useGetConversationsQuery(undefined, { skip: searching });
  const search = useSearchUsersQuery({ q: debounced, limit: 20 }, { skip: !searching });
  const recent = (conversations.data?.data?.conversations ?? []).flatMap((c) => (c.otherUser ? [c.otherUser] : []));
  const people = (searching ? (search.data?.data?.users ?? []) : recent).filter((u) => u._id !== me?.id);
  const loading = searching ? search.isFetching && !search.data : conversations.isLoading;
  const isSelected = (id: string) => selected.some((u) => u._id === id);

  const close = () => {
    if (!sending) onClose();
  };

  const toggle = (user: UserCard) => {
    setSelected((prev) =>
      prev.some((u) => u._id === user._id)
        ? prev.filter((u) => u._id !== user._id)
        : prev.length >= MAX_RECIPIENTS
          ? prev
          : [...prev, user]
    );
  };

  const handleSend = async () => {
    if (!selected.length || sending || done) return;
    setSending(true);
    setError('');
    const text = isNote ? message.trim() || DEFAULT_NOTE_TEXT : item.text!;
    const failed: UserCard[] = [];
    let lastError = '';
    // Sırayla gönderilir: aynı anda çok istek sunucuyu zorlamasın.
    for (const user of selected) {
      try {
        const { data } = await startConversation(user._id).unwrap();
        await sendMessage({
          id: data.conversationId,
          text,
          noteId: item.note?._id ?? null,
          clientId: newClientId(),
        }).unwrap();
      } catch (err) {
        failed.push(user);
        lastError = getErrorMessage(err);
      }
    }
    setSending(false);
    if (failed.length) {
      // Gidemeyenler seçili kalır, tekrar denenebilir.
      const sent = selected.length - failed.length;
      setSelected(failed);
      setError(`${sent ? `Sent to ${sent}, but ` : ''}couldn't send to ${failed.map((u) => u.fullName).join(', ')}. ${lastError}`);
      return;
    }
    // Hepsi gitti: düğmede kısa bir "Sent" görünür, sonra pencere kapanır.
    setDone(true);
    setTimeout(onClose, 700);
  };

  return (
    <ChatSheet title={isNote ? 'Send to' : 'Forward to'} onClose={close}>
      <div className="px-5 pb-3 space-y-2.5">
        {/* Gönderilecek notun / mesajın önizlemesi */}
        <div className="flex items-center gap-2.5 rounded-xl bg-navy-50 px-3.5 py-2.5 text-sm text-gray-600">
          {item.note ? (
            <FileText size={16} className="shrink-0 text-navy-700" />
          ) : (
            <CornerUpRight size={16} className="shrink-0 text-navy-700" />
          )}
          <span className="line-clamp-2 break-words">
            {item.note?.title}
            {item.note && item.text ? ' · ' : ''}
            {item.text}
          </span>
        </div>

        {isNote && (
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write a message..."
            maxLength={2000}
            className="w-full h-10 rounded-xl bg-gray-100 px-3.5 text-[15px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-500"
          />
        )}

        <label className="relative block">
          <span className="sr-only">Search people</span>
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people"
            className="w-full h-10 rounded-xl border border-gray-300 bg-white pl-11 pr-4 text-[15px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
          />
        </label>
      </div>

      {!searching && <p className="px-5 pb-1 text-xs font-bold tracking-wide text-gray-500">RECENT</p>}

      <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-2 sm:min-h-[220px]">
        {loading ? (
          <div className="flex justify-center py-10 text-gray-400">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : !people.length ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">
            {searching ? 'No people match that name.' : 'Search for someone to send this to.'}
          </p>
        ) : (
          <ul>
            {people.map((u) => {
              const on = isSelected(u._id);
              return (
                <li key={u._id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(u)}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-gray-50 active:bg-gray-100"
                  >
                    <UserAvatar user={u} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-gray-900">{u.fullName}</span>
                      <span className="block truncate text-xs text-gray-500">
                        {[u.university, u.department].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                        on ? 'border-navy-800 bg-navy-800 text-white' : 'border-gray-300'
                      }`}
                      aria-hidden="true"
                    >
                      {on && <Check size={14} strokeWidth={3} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="px-5 pt-2 pb-4">
        {error && <Alert className="mb-2.5">{error}</Alert>}
        <button
          type="button"
          onClick={handleSend}
          disabled={!selected.length}
          aria-busy={sending}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-navy-800 text-[15px] font-bold text-white hover:bg-navy-900 disabled:opacity-50"
        >
          {sending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : done ? (
            <>
              <Check size={18} strokeWidth={3} /> Sent
            </>
          ) : selected.length > 1 ? (
            `Send to ${selected.length} people`
          ) : (
            'Send'
          )}
        </button>
      </div>
    </ChatSheet>
  );
}
