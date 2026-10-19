import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from 'react';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import {
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCheck,
  ChevronLeft,
  MoreHorizontal,
  MoreVertical,
  Paperclip,
  Pencil,
  Plus,
  Reply,
  Smile,
  Trash2,
  UserRound,
} from 'lucide-react';
import ChatAvatar from './ChatAvatar';
import MessageBubble from './MessageBubble';
import MessageActionMenu, { type MessageAction } from './MessageActionMenu';
import NotePickerSheet from './NotePickerSheet';
import ComposerBanner from './ComposerBanner';
import BlockButton from '@/components/users/BlockButton';
import { useDialog } from '@/components/common/DialogProvider';
import Spinner from '@/components/common/Spinner';
import Alert from '@/components/common/Alert';
import {
  useDeleteConversationMutation,
  useDeleteDirectMessageMutation,
  useEditDirectMessageMutation,
  useGetConversationQuery,
  useLazyGetOlderMessagesQuery,
  useSendDirectMessageMutation,
} from '@/services/messagesApi';
import { useGetNoteQuery } from '@/services/notesApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { clockTime, dayLabel, isSameDay, lastSeenLabel } from '@/lib/chatTime';
import { resetTypingThrottle, sendTyping, useFallbackPolling, useTypingConversations } from '@/lib/socket';
import type { DirectMessage } from '@/types/api';

// Yeni mesajlar Socket.io ile anında gelir; bağlantı yoksa açık konuşma bu aralıkla yoklanır.
const POLL_INTERVAL_MS = 5000;
// Aynı kişinin bu süre içindeki ardışık mesajları tek grup olarak çizilir (saat sadece grubun sonunda).
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const LONG_PRESS_MS = 450;
const EMOJIS = ['😀', '😂', '😊', '😍', '🥲', '😅', '🤔', '😮', '😢', '😡', '👍', '👎', '👏', '🙏', '💪', '🔥', '❤️', '💯', '🎉', '✅', '📚', '📝', '📌', '💡', '⏰', '☕', '🤝', '👀'];

const NO_MESSAGES: DirectMessage[] = [];

const isCoarsePointer = () => window.matchMedia('(pointer: coarse)').matches;

interface ActionState {
  message: DirectMessage;
  rect: DOMRect;
}

// Birebir sohbet. ?note=<id> ile açıldıysa ("Ask the author" ya da "+") not, gönderilecek mesaja iliştirilir.
export default function ChatPanel({ conversationId }: { conversationId: string }) {
  const me = useAppSelector((state) => state.auth.user);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const attachedNoteId = searchParams.get('note');

  const { data, isLoading, error } = useGetConversationQuery(conversationId, {
    pollingInterval: useFallbackPolling(POLL_INTERVAL_MS),
    skipPollingIfUnfocused: true,
  });
  const attachedNote = useGetNoteQuery(attachedNoteId || skipToken);
  const [sendMessage, { isLoading: sending }] = useSendDirectMessageMutation();
  const [editMessage, { isLoading: savingEdit }] = useEditDirectMessageMutation();
  const [deleteMessage] = useDeleteDirectMessageMutation();
  const [deleteConversation] = useDeleteConversationMutation();
  const typingNow = useTypingConversations().has(conversationId);

  const [text, setText] = useState('');
  const [sendError, setSendError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const [editing, setEditing] = useState<DirectMessage | null>(null);
  const [action, setAction] = useState<ActionState | null>(null);
  const [toast, setToast] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nearBottomRef = useRef(true);
  const dialog = useDialog();

  // Sunucu ilk açılışta son 100 mesajı verir; daha eskileri "Load earlier messages" ile 50'şer gelir ve önüne eklenir.
  // Başka konuşmaya geçince eski sayfalar geçersiz sayılır.
  const [fetchOlder, { isFetching: loadingOlder }] = useLazyGetOlderMessagesQuery();
  const [older, setOlder] = useState<{ conversationId: string; messages: DirectMessage[]; hasMore: boolean } | null>(null);
  const olderMessages = older?.conversationId === conversationId ? older.messages : NO_MESSAGES;
  const pendingScrollRef = useRef<number | null>(null);

  const conversation = data?.data?.conversation;
  const latest = data?.data?.messages;
  const messages = useMemo(() => {
    if (!latest || !olderMessages.length) return latest;
    const ids = new Set(latest.map((m) => m._id));
    return [...olderMessages.filter((m) => !ids.has(m._id)), ...latest];
  }, [latest, olderMessages]);
  const hasMore = olderMessages.length ? Boolean(older?.hasMore) : Boolean(data?.data?.hasMore);
  const lastId = messages?.at(-1)?._id;
  const other = conversation?.otherUser;
  const otherReadAt = conversation?.otherLastReadAt ? new Date(conversation.otherLastReadAt).getTime() : 0;

  const scrollToBottom = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // Yeni mesaj gelince en alta kaydır; "yazıyor" balonu çıkınca kullanıcı zaten alttaysa onu da göster.
  useLayoutEffect(scrollToBottom, [lastId]);
  useLayoutEffect(() => {
    if (typingNow && nearBottomRef.current) scrollToBottom();
  }, [typingNow]);
  // Eski mesajlar üste eklenince okunan yer kaymasın: aradaki yükseklik farkı kadar aşağı kaydırılır.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && pendingScrollRef.current !== null) {
      el.scrollTop += el.scrollHeight - pendingScrollRef.current;
      pendingScrollRef.current = null;
    }
  }, [olderMessages]);

  const loadOlder = async () => {
    const oldest = messages?.[0];
    if (!oldest || loadingOlder || !hasMore) return;
    try {
      const res = await fetchOlder({ id: conversationId, before: oldest.createdAt }).unwrap();
      pendingScrollRef.current = listRef.current?.scrollHeight ?? null;
      setOlder({ conversationId, messages: [...res.data.messages, ...olderMessages], hasMore: res.data.hasMore });
    } catch (err) {
      setSendError(getErrorMessage(err));
    }
  };

  // Düzenlenen / silinen mesaj eski sayfalardaysa orada da güncellenir (son mesajlar sunucudan yeniden gelir).
  const patchOlder = (update: (list: DirectMessage[]) => DirectMessage[]) =>
    setOlder((o) => (o && o.conversationId === conversationId ? { ...o, messages: update(o.messages) } : o));

  // Masaüstünde konuşma açılınca yazma kutusuna odaklan (telefonda klavye kendiliğinden açılmasın).
  useEffect(() => {
    if (!isCoarsePointer()) inputRef.current?.focus();
  }, [conversationId]);

  // Yazma kutusu içeriğe göre uzar (en fazla max-h).
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 1600);
    return () => clearTimeout(timer);
  }, [toast]);

  const focusInput = () => requestAnimationFrame(() => inputRef.current?.focus());

  const removeAttachment = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('note');
    setSearchParams(next, { replace: true });
  };

  const attachNote = (noteId: string) => {
    setNotePickerOpen(false);
    const next = new URLSearchParams(searchParams);
    next.set('note', noteId);
    setSearchParams(next, { replace: true });
    focusInput();
  };

  const cancelEdit = () => {
    setEditing(null);
    setText('');
  };

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending || savingEdit) return;
    setSendError('');
    try {
      if (editing) {
        const { data: edited } = await editMessage({ id: conversationId, messageId: editing._id, text: trimmed }).unwrap();
        patchOlder((list) => list.map((m) => (m._id === edited.message._id ? edited.message : m)));
        setEditing(null);
      } else {
        await sendMessage({ id: conversationId, text: trimmed, noteId: attachedNoteId, replyTo: replyTo?._id }).unwrap();
        setReplyTo(null);
        resetTypingThrottle(conversationId);
        if (attachedNoteId) removeAttachment();
      }
      setText('');
      setEmojiOpen(false);
    } catch (err) {
      setSendError(getErrorMessage(err));
    }
  };

  // Masaüstünde Enter gönderir, Shift+Enter yeni satır. Telefonda Enter yeni satırdır (gönder düğmesi var).
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isCoarsePointer()) handleSubmit(e);
    if (e.key === 'Escape') {
      if (editing) cancelEdit();
      else if (replyTo) setReplyTo(null);
    }
  };

  const handleTextChange = (value: string) => {
    setText(value);
    if (!editing && value.trim()) sendTyping(conversationId);
  };

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const openActions = useCallback((message: DirectMessage, target: HTMLElement) => {
    navigator.vibrate?.(10);
    setEmojiOpen(false);
    setAction({ message, rect: target.getBoundingClientRect() });
  }, []);

  const closeActions = useCallback(() => setAction(null), []);

  const handleAction = async (kind: MessageAction) => {
    const message = action?.message;
    setAction(null);
    if (!message) return;

    if (kind === 'reply') {
      setEditing(null);
      setReplyTo(message);
      focusInput();
    } else if (kind === 'copy') {
      try {
        await navigator.clipboard.writeText(message.text);
        setToast('Copied');
      } catch {
        setToast("Couldn't copy");
      }
    } else if (kind === 'edit') {
      setReplyTo(null);
      setEditing(message);
      setText(message.text);
      focusInput();
    } else if (kind === 'delete') {
      const ok = await dialog.confirm({
        title: 'Delete this message?',
        message: 'It will be removed for both of you.',
        confirmLabel: 'Delete',
        tone: 'danger',
        icon: Trash2,
      });
      if (!ok) return;
      try {
        await deleteMessage({ id: conversationId, messageId: message._id }).unwrap();
        patchOlder((list) => list.filter((m) => m._id !== message._id));
        if (editing?._id === message._id) cancelEdit();
        if (replyTo?._id === message._id) setReplyTo(null);
      } catch (err) {
        dialog.alert({ message: getErrorMessage(err) });
      }
    }
  };

  // Alıntıya dokununca asıl mesaja kaydırıp kısa süre vurgular (silinmiş ya da çok eskiyse bir şey olmaz).
  const jumpToMessage = (messageId: string) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-mid="${messageId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('message-flash');
    void el.offsetWidth;
    el.classList.add('message-flash');
  };

  const handleDeleteConversation = async () => {
    setMenuOpen(false);
    const ok = await dialog.confirm({
      title: 'Delete this conversation?',
      message: 'It will only be removed for you. The other person will still see it.',
      confirmLabel: 'Delete',
      tone: 'danger',
      icon: Trash2,
    });
    if (!ok) return;
    try {
      await deleteConversation(conversationId).unwrap();
      navigate('/messages');
    } catch (err) {
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  if (error) {
    return (
      <div className="p-6 pt-[max(env(safe-area-inset-top),1.5rem)]">
        <Alert>{getErrorMessage(error)}</Alert>
        <Link to="/messages" className="btn-secondary mt-4">
          <ArrowLeft size={16} /> Back to messages
        </Link>
      </div>
    );
  }

  if (isLoading || !conversation) {
    return (
      <div className="h-full flex flex-col">
        <div className="h-16 border-b border-gray-100 pt-safe lg:hidden" />
        <Spinner />
      </div>
    );
  }
  // Mesaj yazılamayan durumlar (engelleme, silinmiş hesap, doğrulanmamış e-posta).
  const blockedNotice = !other
    ? 'This account no longer exists.'
    : conversation.blockedByMe
      ? `You blocked ${other.fullName}. Unblock them to send messages.`
      : conversation.blockedMe
        ? "You can't reply to this conversation."
        : !me?.isVerified
          ? 'Verify your email address to send messages.'
          : null;
  const canWrite = !blockedNotice;

  const status = typingNow
    ? 'typing...'
    : conversation.otherOnline
      ? 'Active now'
      : conversation.otherLastActiveAt
        ? lastSeenLabel(conversation.otherLastActiveAt)
        : '';

  const authorName = (senderId: string) => (senderId === me?.id ? 'You' : (other?.fullName ?? 'Deleted user'));

  return (
    <div className="relative flex flex-col h-full min-h-0 bg-white">
      {/* Başlık: geri, karşı taraf + durum, menü */}
      <header className="shrink-0 border-b border-gray-100 pt-safe">
        <div className="flex items-center gap-1 h-16 px-2 lg:px-4">
          <Link
            to="/messages"
            className="lg:hidden w-10 h-10 -ml-0.5 rounded-full flex items-center justify-center text-gray-800 hover:bg-gray-100"
            aria-label="Back to messages"
          >
            <ChevronLeft size={26} />
          </Link>
          {other ? (
            <Link to={`/users/${other._id}`} className="flex items-center gap-3 min-w-0 flex-1 pl-1 group">
              <ChatAvatar user={other} online={conversation.otherOnline} size="md" />
              <span className="min-w-0">
                <span className="block text-[17px] font-bold leading-tight text-gray-900 truncate group-hover:text-navy-700">
                  {other.fullName}
                </span>
                {status && (
                  <span className={`block text-[13px] truncate ${typingNow ? 'text-sky-700 font-medium' : 'text-gray-500'}`}>
                    {status}
                  </span>
                )}
              </span>
            </Link>
          ) : (
            <span className="flex items-center gap-3 flex-1 pl-1">
              <ChatAvatar user={null} size="md" />
              <span className="text-[17px] font-bold text-gray-500">Deleted user</span>
            </span>
          )}

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label="Conversation options"
              className="w-10 h-10 rounded-full flex items-center justify-center text-gray-800 hover:bg-gray-100"
            >
              <MoreVertical size={20} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="sheet-up absolute right-0 top-full mt-1 z-20 w-56 rounded-2xl bg-white shadow-xl ring-1 ring-black/5 py-1.5">
                  {other && (
                    <Link
                      to={`/users/${other._id}`}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                    >
                      <UserRound size={15} /> View profile
                    </Link>
                  )}
                  {other && (
                    <BlockButton
                      userId={other._id}
                      isBlocked={conversation.blockedByMe}
                      name={other.fullName}
                      variant="menu"
                      onDone={() => setMenuOpen(false)}
                    />
                  )}
                  <button
                    type="button"
                    onClick={handleDeleteConversation}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 size={15} /> Delete conversation
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mesajlar */}
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-5 pt-4 pb-3"
      >
        {!messages?.length ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <ChatAvatar user={other ?? null} />
            <p className="mt-3 font-semibold text-gray-900">{other?.fullName ?? 'Deleted user'}</p>
            <p className="mt-1 text-sm text-gray-500">
              No messages yet{other ? `. Say hi to ${other.fullName.split(' ')[0]}!` : '.'}
            </p>
          </div>
        ) : (
          <div className="min-h-full flex flex-col justify-end">
            {hasMore && (
              <div className="mb-3 flex justify-center">
                <button
                  type="button"
                  onClick={loadOlder}
                  disabled={loadingOlder}
                  className="rounded-full bg-gray-100 px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 disabled:opacity-60"
                >
                  {loadingOlder ? 'Loading...' : 'Load earlier messages'}
                </button>
              </div>
            )}
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const time = new Date(m.createdAt).getTime();
              const newDay = !prev || !isSameDay(prev.createdAt, m.createdAt);
              const joinsPrev =
                !newDay && prev?.sender === m.sender && time - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS;
              const joinsNext =
                next &&
                next.sender === m.sender &&
                isSameDay(next.createdAt, m.createdAt) &&
                new Date(next.createdAt).getTime() - time < GROUP_WINDOW_MS;
              const mine = m.sender === me?.id;
              const seen = mine && otherReadAt >= time;

              return (
                <Fragment key={m._id}>
                  {newDay && (
                    <div className="flex justify-center my-4 first:mt-0">
                      <span className="rounded-full bg-navy-50 px-3 py-1 text-xs font-semibold text-navy-800">
                        {dayLabel(m.createdAt)}
                      </span>
                    </div>
                  )}
                  <MessageRow
                    message={m}
                    mine={mine}
                    className={joinsPrev ? 'mt-1' : newDay ? '' : 'mt-3'}
                    replyAuthor={m.reply ? authorName(m.reply.sender) : undefined}
                    onQuoteClick={jumpToMessage}
                    onOpenActions={openActions}
                  />
                  {!joinsNext && (
                    <div
                      className={`mt-1 flex items-center gap-1 px-1 text-xs text-gray-500 ${mine ? 'justify-end' : 'justify-start'}`}
                    >
                      {m.editedAt && <span>Edited ·</span>}
                      <time dateTime={m.createdAt}>{clockTime(m.createdAt)}</time>
                      {mine &&
                        (seen ? (
                          <CheckCheck size={16} className="text-sky-600" aria-label="Seen" />
                        ) : (
                          <Check size={16} className="text-gray-400" aria-label="Sent" />
                        ))}
                    </div>
                  )}
                </Fragment>
              );
            })}

            {typingNow && (
              <div className="mt-3 flex" aria-label={`${other?.fullName ?? 'They'} is typing`}>
                <div className="flex items-center gap-1 rounded-[20px] bg-navy-100/70 px-4 py-3.5">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="typing-dot w-2 h-2 rounded-full bg-navy-400"
                      style={{ animationDelay: `${d * 0.18}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Yazma alanı */}
      {blockedNotice ? (
        <div className="shrink-0 border-t border-gray-100 px-4 pt-4 pb-[max(env(safe-area-inset-bottom),1rem)] text-center text-sm text-gray-500">
          {blockedNotice}
          {conversation.blockedByMe && other && (
            <div className="mt-2">
              <BlockButton userId={other._id} isBlocked name={other.fullName} />
            </div>
          )}
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="shrink-0 border-t border-gray-100 bg-white px-3 pt-2.5 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
        >
          <Alert className="mb-2">{sendError}</Alert>

          {(editing || replyTo) && (
            <ComposerBanner
              icon={editing ? <Pencil size={16} /> : <Reply size={16} />}
              title={editing ? 'Editing message' : `Replying to ${authorName(replyTo!.sender)}`}
              text={(editing ?? replyTo)!.text}
              onCancel={editing ? cancelEdit : () => setReplyTo(null)}
              cancelLabel={editing ? 'Cancel editing' : 'Cancel reply'}
            />
          )}
          {attachedNoteId && !editing && (
            <ComposerBanner
              icon={<Paperclip size={16} />}
              title="Attached note"
              text={attachedNote.data?.data?.note?.title ?? (attachedNote.isError ? 'Note unavailable' : 'Loading note...')}
              onCancel={removeAttachment}
              cancelLabel="Remove attached note"
            />
          )}

          <div className="flex items-end gap-2.5">
            <button
              type="button"
              onClick={() => setNotePickerOpen(true)}
              disabled={Boolean(editing)}
              className="w-11 h-11 shrink-0 rounded-full bg-navy-50 text-navy-800 hover:bg-navy-100 active:bg-navy-100 disabled:opacity-40 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
              aria-label="Share a note"
              title="Share a note"
            >
              <Plus size={22} />
            </button>

            <div className="relative flex-1 min-w-0 flex items-end rounded-[22px] border border-gray-300 bg-white focus-within:border-navy-500 focus-within:ring-2 focus-within:ring-navy-500/30">
              <label htmlFor="dm-message" className="sr-only">
                Message
              </label>
              <textarea
                id="dm-message"
                ref={inputRef}
                rows={1}
                maxLength={2000}
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={attachedNoteId ? 'Ask something about this note...' : 'Message'}
                className="block flex-1 min-w-0 resize-none bg-transparent pl-4 pr-1 py-[10px] text-[15px] leading-6 max-h-32 text-gray-900 placeholder-gray-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setEmojiOpen((o) => !o)}
                aria-expanded={emojiOpen}
                aria-label="Insert emoji"
                className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-gray-500 hover:text-navy-700 focus:outline-none focus-visible:text-navy-700"
              >
                <Smile size={21} />
              </button>

              {emojiOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setEmojiOpen(false)} />
                  <div className="sheet-up absolute bottom-full right-0 mb-2 z-20 w-[min(296px,calc(100vw-1.5rem))] rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/5 grid grid-cols-7 gap-0.5">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertEmoji(emoji)}
                        className="h-10 rounded-lg text-[22px] hover:bg-gray-100 active:bg-gray-100"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={sending || savingEdit || !text.trim()}
              className="w-11 h-11 shrink-0 rounded-full bg-navy-800 text-white hover:bg-navy-900 disabled:bg-navy-800/80 disabled:opacity-70 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2"
              aria-label={editing ? 'Save edit' : 'Send'}
            >
              {editing ? <Check size={20} strokeWidth={2.5} /> : <ArrowUp size={20} strokeWidth={2.5} />}
            </button>
          </div>
        </form>
      )}

      {toast && (
        <div
          role="status"
          className="sheet-up pointer-events-none absolute left-1/2 bottom-24 -translate-x-1/2 rounded-full bg-gray-900/90 px-4 py-2 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}

      {action && (
        <MessageActionMenu
          rect={action.rect}
          mine={action.message.sender === me?.id}
          bubble={
            <MessageBubble
              message={action.message}
              mine={action.message.sender === me?.id}
              replyAuthor={action.message.reply ? authorName(action.message.reply.sender) : undefined}
              inert
            />
          }
          canEdit={canWrite && action.message.sender === me?.id}
          canDelete={action.message.sender === me?.id}
          onAction={handleAction}
          onClose={closeActions}
        />
      )}

      {notePickerOpen && <NotePickerSheet onPick={attachNote} onClose={() => setNotePickerOpen(false)} />}
    </div>
  );
}

interface MessageRowProps {
  message: DirectMessage;
  mine: boolean;
  className: string;
  replyAuthor?: string;
  onQuoteClick: (messageId: string) => void;
  onOpenActions: (message: DirectMessage, bubble: HTMLElement) => void;
}

// Bir mesaj satırı. Telefonda basılı tutunca, masaüstünde sağ tıklayınca ya da "⋯" ile işlem menüsü açılır.
function MessageRow({ message, mine, className, replyAuthor, onQuoteClick, onOpenActions }: MessageRowProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef({ x: 0, y: 0 });
  // Basılı tutma menüyü açtıysa parmak kalkınca gelen tıklama (bağlantı/alıntı) yok sayılır.
  const longPressed = useRef(false);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancel, []);

  const open = () => {
    if (bubbleRef.current) onOpenActions(message, bubbleRef.current);
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    longPressed.current = false;
    if (e.pointerType === 'mouse') return;
    start.current = { x: e.clientX, y: e.clientY };
    cancel();
    timer.current = setTimeout(() => {
      longPressed.current = true;
      open();
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (timer.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) cancel();
  };

  return (
    <div data-mid={message._id} className={`group -mx-2 px-2 rounded-2xl flex items-center gap-1 ${mine ? 'flex-row-reverse' : ''} ${className}`}>
      <div
        ref={bubbleRef}
        className="min-w-0 max-w-[80%] sm:max-w-[70%] lg:max-w-[65%] pointer-coarse:select-none [-webkit-touch-callout:none]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        onContextMenu={(e) => {
          e.preventDefault();
          cancel();
          if (!longPressed.current) open();
          longPressed.current = true;
        }}
        onClickCapture={(e) => {
          if (longPressed.current) {
            e.preventDefault();
            e.stopPropagation();
            longPressed.current = false;
          }
        }}
      >
        <MessageBubble message={message} mine={mine} replyAuthor={replyAuthor} onQuoteClick={onQuoteClick} />
      </div>
      <button
        type="button"
        onClick={open}
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 opacity-0 group-hover:opacity-100 focus:opacity-100 pointer-coarse:hidden"
        aria-label="Message actions"
      >
        <MoreHorizontal size={18} />
      </button>
    </div>
  );
}
