import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from 'react';
import { Link } from 'react-router-dom';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { useAppSelector } from '@/app/hooks';
import { ArrowDown, ArrowUp, Check, MessagesSquare, MoreHorizontal, Paperclip, Pencil, Plus, Reply } from 'lucide-react';
import UserAvatar from '@/components/users/UserAvatar';
import Spinner from '@/components/common/Spinner';
import Alert from '@/components/common/Alert';
import ComposerBanner from '@/components/messages/ComposerBanner';
import NotePickerSheet from '@/components/messages/NotePickerSheet';
import ForwardSheet, { type SendItem } from '@/components/messages/ForwardSheet';
import MessageActionMenu, { type MessageAction } from '@/components/messages/MessageActionMenu';
import { NoteAttachment } from '@/components/messages/MessageBubble';
import { useDialog } from '@/components/common/DialogProvider';
import {
  useDeleteGroupMessageMutation,
  useEditGroupMessageMutation,
  useGetGroupMessagesQuery,
  useSendGroupMessageMutation,
} from '@/services/groupsApi';
import { useGetNoteQuery } from '@/services/notesApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { clockTime, dayLabel, isSameDay } from '@/lib/chatTime';
import { joinGroupRoom, leaveGroupRoom, useFallbackPolling } from '@/lib/socket';
import type { GroupMessage } from '@/types/api';

// Yeni mesajlar Socket.io grup odasından anında gelir; bağlantı yoksa sunucu bu aralıkla yoklanır.
const POLL_INTERVAL_MS = 5000;
// Aynı kişinin bu süre içindeki ardışık mesajları tek blok olarak gösterilir (isim ve avatar bir kez).
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const LONG_PRESS_MS = 450;
// Listenin dibine bu kadar yakınken gelen yeni mesaj otomatik gösterilir; daha yukarıdaysa "New messages" balonu çıkar.
const NEAR_BOTTOM_PX = 120;

const isCoarsePointer = () => window.matchMedia('(pointer: coarse)').matches;

interface ActionState {
  message: GroupMessage;
  rect: DOMRect;
}

// Grup sohbeti: sadece üyelere gösterilir. Son 100 mesaj listelenir.
// Mobil uygulamayla aynı özellikler: mesajı yanıtlama, kendi mesajını düzenleme ve mesaja not ekleme ("+").
// Mesaj işlemleri DM'deki gibi: telefonda basılı tutunca, masaüstünde sağ tıkla ya da "⋯" ile açılan menüde.
export default function GroupChat({ groupId, isOwner }: { groupId: string; isOwner: boolean }) {
  const me = useAppSelector((state) => state.auth.user);
  const { data, isLoading, error } = useGetGroupMessagesQuery(groupId, {
    pollingInterval: useFallbackPolling(POLL_INTERVAL_MS),
    skipPollingIfUnfocused: true,
  });
  const [sendMessage] = useSendGroupMessageMutation();
  const [editMessage, { isLoading: savingEdit }] = useEditGroupMessageMutation();
  const [deleteMessage] = useDeleteGroupMessageMutation();
  const [text, setText] = useState('');
  const [sendError, setSendError] = useState('');
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [editing, setEditing] = useState<GroupMessage | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [action, setAction] = useState<ActionState | null>(null);
  const [forwarding, setForwarding] = useState<SendItem | null>(null);
  const [toast, setToast] = useState('');
  const [hasUnseen, setHasUnseen] = useState(false);
  const attachedNote = useGetNoteQuery(noteId || skipToken);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nearBottomRef = useRef(true);
  const dialog = useDialog();

  // Sohbet açıkken grubun socket odasına katılınır; yeni mesaj olayı gelince liste yenilenir (bkz. RealtimeBridge).
  useEffect(() => {
    joinGroupRoom(groupId);
    return () => leaveGroupRoom(groupId);
  }, [groupId]);

  const messages = data?.data?.messages;
  const last = messages?.at(-1);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    nearBottomRef.current = true;
    setHasUnseen(false);
  };

  // Yeni mesaj gelince: kullanıcı zaten alttaysa ya da mesajı kendisi gönderdiyse en alta kaydır;
  // yukarıda eski mesajları okuyorsa yeri kaybolmasın, "New messages" balonu gösterilir.
  useLayoutEffect(() => {
    if (!last) return;
    if (nearBottomRef.current || last.user?._id === me?.id) scrollToBottom();
    else setHasUnseen(true);
    // Sadece son mesaj değişince çalışır.
  }, [last?._id]);

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
  const authorName = (userId: string) =>
    userId === me?.id ? 'You' : (messages?.find((m) => m.user?._id === userId)?.user?.fullName ?? 'Someone');

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || savingEdit) return;
    setSendError('');
    if (editing) {
      try {
        await editMessage({ id: groupId, messageId: editing._id, text: trimmed }).unwrap();
        setEditing(null);
        setText('');
      } catch (err) {
        setSendError(getErrorMessage(err));
      }
      return;
    }

    // Yazma kutusu hemen boşalır (sıradaki mesaj beklemeden yazılabilir); gönderilemezse metin, yanıt ve not geri gelir.
    const sentReply = replyTo;
    const sentNoteId = noteId;
    setText('');
    setReplyTo(null);
    setNoteId(null);
    try {
      await sendMessage({ id: groupId, text: trimmed, noteId: sentNoteId, replyTo: sentReply?._id }).unwrap();
    } catch (err) {
      setText((current) => current || trimmed);
      setReplyTo((current) => current ?? sentReply);
      setNoteId((current) => current ?? sentNoteId);
      setSendError(getErrorMessage(err));
    }
  };

  // Masaüstünde Enter gönderir, Shift+Enter yeni satır ekler; telefonda Enter her zaman yeni satırdır.
  // Esc yanıt / düzenlemeyi iptal eder.
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isCoarsePointer()) handleSubmit(e);
    if (e.key === 'Escape') {
      if (editing) cancelEdit();
      else if (replyTo) setReplyTo(null);
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setText('');
  };

  const openActions = useCallback((message: GroupMessage, target: HTMLElement) => {
    navigator.vibrate?.(10);
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
    } else if (kind === 'forward') {
      // Yazısız (sadece not içeren) mesaj, not paylaşımı gibi iletilir.
      setForwarding({ text: message.text || undefined, note: message.note ? { _id: message.note._id, title: message.note.title } : null });
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
        message: 'It will be removed from the group chat for everyone.',
        confirmLabel: 'Delete',
        tone: 'danger',
      });
      if (!ok) return;
      try {
        await deleteMessage({ id: groupId, messageId: message._id }).unwrap();
        if (editing?._id === message._id) cancelEdit();
        if (replyTo?._id === message._id) setReplyTo(null);
      } catch (err) {
        dialog.alert({ message: getErrorMessage(err) });
      }
    }
  };

  // Alıntıya tıklayınca yanıtlanan mesaja kaydırıp kısa süre vurgular.
  const jumpToMessage = (messageId: string) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.add('bg-amber-50');
    setTimeout(() => el.classList.remove('bg-amber-50'), 1200);
  };

  if (isLoading) return <Spinner />;
  if (error) return <Alert>{getErrorMessage(error)}</Alert>;

  return (
    // Sekme çubuğu ekranın üstüne kaydırıldığında (bkz. GroupDetailPage) sohbet ekranın geri kalanını doldurur:
    // navbar + sekme çubuğu + boşluklar ≈ 9rem, telefonda ayrıca alt sekme çubuğu (4rem). Telefonda kenardan kenara.
    <section
      className="card relative flex flex-col overflow-hidden min-h-[360px] h-[calc(100dvh-13rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-9rem)] max-sm:-mx-4 max-sm:rounded-none max-sm:border-x-0 max-sm:shadow-none"
      aria-label="Group chat"
    >
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
          if (nearBottomRef.current && hasUnseen) setHasUnseen(false);
        }}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-5 pt-4 pb-3"
      >
        {!messages?.length ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
            <MessagesSquare size={28} />
            <p className="mt-2 text-sm">No messages yet. Say hi to the group!</p>
          </div>
        ) : (
          <div className="min-h-full flex flex-col justify-end">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const author = m.user?._id;
              const time = new Date(m.createdAt).getTime();
              const newDay = !prev || !isSameDay(prev.createdAt, m.createdAt);
              const joinsPrev =
                !newDay && prev?.user?._id === author && time - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS;
              const joinsNext =
                Boolean(next) &&
                next.user?._id === author &&
                isSameDay(next.createdAt, m.createdAt) &&
                new Date(next.createdAt).getTime() - time < GROUP_WINDOW_MS;
              const mine = author === me?.id;

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
                    joinsPrev={joinsPrev}
                    joinsNext={joinsNext}
                    className={joinsPrev ? 'mt-0.5' : newDay ? '' : 'mt-3'}
                    replyAuthor={m.reply ? authorName(m.reply.user) : undefined}
                    onQuoteClick={jumpToMessage}
                    onOpenActions={openActions}
                  />
                  {(!joinsNext || m.editedAt) && (
                    <div className={`mt-1 px-1 text-xs text-gray-500 ${mine ? 'text-right' : 'pl-11'}`}>
                      {m.editedAt && 'Edited · '}
                      <time dateTime={m.createdAt} title={new Date(m.createdAt).toLocaleString('en-GB')}>
                        {clockTime(m.createdAt)}
                      </time>
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      {hasUnseen && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="sheet-up absolute left-1/2 bottom-24 z-[5] -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-navy-800 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-navy-900"
        >
          <ArrowDown size={14} /> New messages
        </button>
      )}

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-gray-100 bg-white px-3 pt-2.5 pb-3">
        <Alert className="mb-2">{sendError}</Alert>
        {(editing || replyTo) && (
          <ComposerBanner
            icon={editing ? <Pencil size={16} /> : <Reply size={16} />}
            title={editing ? 'Editing message' : `Replying to ${replyTo?.user ? authorName(replyTo.user._id) : 'Someone'}`}
            text={(editing ?? replyTo)?.text ?? ''}
            onCancel={editing ? cancelEdit : () => setReplyTo(null)}
            cancelLabel={editing ? 'Cancel editing' : 'Cancel reply'}
          />
        )}
        {noteId && !editing && (
          <ComposerBanner
            icon={<Paperclip size={16} />}
            title="Attached note"
            text={attachedNote.data?.data?.note?.title ?? (attachedNote.isError ? 'Note unavailable' : 'Loading note...')}
            onCancel={() => setNoteId(null)}
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
          <div className="flex-1 min-w-0 flex items-end rounded-[22px] border border-gray-300 bg-white focus-within:border-navy-500 focus-within:ring-2 focus-within:ring-navy-500/30">
            <label htmlFor="chat-message" className="sr-only">
              Message
            </label>
            <textarea
              id="chat-message"
              ref={inputRef}
              rows={1}
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={noteId ? 'Say something about this note...' : 'Message the group'}
              className="block flex-1 min-w-0 resize-none bg-transparent px-4 py-[10px] text-[15px] leading-6 max-h-32 text-gray-900 placeholder-gray-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={savingEdit || !text.trim()}
            className="w-11 h-11 shrink-0 rounded-full bg-navy-800 text-white hover:bg-navy-900 disabled:bg-navy-800/80 disabled:opacity-70 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2"
            aria-label={editing ? 'Save edit' : 'Send'}
          >
            {editing ? <Check size={20} strokeWidth={2.5} /> : <ArrowUp size={20} strokeWidth={2.5} />}
          </button>
        </div>
      </form>

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
          mine={action.message.user?._id === me?.id}
          bubble={
            <GroupBubble
              message={action.message}
              mine={action.message.user?._id === me?.id}
              replyAuthor={action.message.reply ? authorName(action.message.reply.user) : undefined}
              inert
            />
          }
          canEdit={action.message.user?._id === me?.id}
          canDelete={action.message.user?._id === me?.id || isOwner}
          onAction={handleAction}
          onClose={closeActions}
        />
      )}

      {notePickerOpen && (
        <NotePickerSheet
          onPick={(id) => {
            setNotePickerOpen(false);
            setNoteId(id);
            focusInput();
          }}
          onClose={() => setNotePickerOpen(false)}
        />
      )}
      {forwarding && <ForwardSheet item={forwarding} onClose={() => setForwarding(null)} />}
    </section>
  );
}

interface MessageRowProps {
  message: GroupMessage;
  mine: boolean;
  joinsPrev: boolean;
  joinsNext: boolean;
  className: string;
  replyAuthor?: string;
  onQuoteClick: (messageId: string) => void;
  onOpenActions: (message: GroupMessage, bubble: HTMLElement) => void;
}

// Bir mesaj satırı. Başkasının bloğunda isim ilk mesajın üstünde, avatar son mesajın yanında durur;
// kendi mesajlarında avatar ve isim gösterilmez. Telefonda basılı tutunca, masaüstünde sağ tıklayınca
// ya da "⋯" ile işlem menüsü açılır.
function MessageRow({ message, mine, joinsPrev, joinsNext, className, replyAuthor, onQuoteClick, onOpenActions }: MessageRowProps) {
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
    <div
      data-message-id={message._id}
      className={`group -mx-2 px-2 rounded-2xl flex items-end gap-2 transition-colors ${mine ? 'flex-row-reverse' : ''} ${className}`}
    >
      {!mine &&
        (joinsNext ? (
          <span className="w-8 shrink-0" />
        ) : (
          <Link to={`/users/${message.user?._id}`} className="shrink-0 mb-0.5">
            <UserAvatar user={message.user} size="sm" />
          </Link>
        ))}
      <div className={`min-w-0 max-w-[80%] sm:max-w-[70%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
        {!mine && !joinsPrev && (
          <Link
            to={`/users/${message.user?._id}`}
            className="mb-1 ml-3 text-xs font-semibold text-gray-600 hover:text-navy-700 hover:underline"
          >
            {message.user?.fullName ?? 'Deleted user'}
          </Link>
        )}
        <div className={`flex items-center gap-1 max-w-full ${mine ? 'flex-row-reverse' : ''}`}>
          <div
            ref={bubbleRef}
            className="min-w-0 pointer-coarse:select-none [-webkit-touch-callout:none]"
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
            <GroupBubble
              message={message}
              mine={mine}
              joinsPrev={joinsPrev}
              joinsNext={joinsNext}
              replyAuthor={replyAuthor}
              onQuoteClick={onQuoteClick}
            />
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
      </div>
    </div>
  );
}

interface GroupBubbleProps {
  message: GroupMessage;
  mine: boolean;
  joinsPrev?: boolean;
  joinsNext?: boolean;
  replyAuthor?: string;
  onQuoteClick?: (messageId: string) => void;
  // Basılı tutma menüsündeki kopyada bağlantılar tıklanmasın.
  inert?: boolean;
}

// Mesaj balonu. Aynı bloktaki balonların birbirine bakan köşeleri daha az yuvarlak (Messenger gibi).
function GroupBubble({ message: m, mine, joinsPrev = false, joinsNext = false, replyAuthor, onQuoteClick, inert = false }: GroupBubbleProps) {
  const hasExtras = Boolean(m.reply || m.note);
  const corners = mine
    ? `${joinsPrev ? 'rounded-tr-md' : ''} ${joinsNext ? 'rounded-br-md' : ''}`
    : `${joinsPrev ? 'rounded-tl-md' : ''} ${joinsNext ? 'rounded-bl-md' : ''}`;

  return (
    <div
      className={`rounded-[20px] ${corners} text-[15px] leading-snug ${hasExtras ? 'p-2' : 'px-3.5 py-2'} ${
        mine ? 'bg-navy-800 text-white' : 'bg-navy-100/70 text-gray-900'
      }`}
    >
      {m.reply && (
        <button
          type="button"
          tabIndex={inert ? -1 : undefined}
          onClick={() => !inert && onQuoteClick?.(m.reply!.message)}
          className={`mb-1.5 block w-full min-w-0 rounded-xl px-3 py-1.5 text-left ${
            mine ? 'bg-white/12 hover:bg-white/18' : 'bg-white/80 hover:bg-white'
          }`}
        >
          <span className={`block text-xs font-bold ${mine ? 'text-white/90' : 'text-navy-800'}`}>{replyAuthor}</span>
          <span className={`block truncate text-[13px] ${mine ? 'text-white/75' : 'text-gray-600'}`}>
            {m.reply.text || 'Message'}
          </span>
        </button>
      )}
      {m.note && <NoteAttachment note={m.note} mine={mine} inert={inert} />}
      <p className={`whitespace-pre-line break-words ${hasExtras ? 'px-1.5 pb-0.5' : ''}`}>{m.text}</p>
    </div>
  );
}
