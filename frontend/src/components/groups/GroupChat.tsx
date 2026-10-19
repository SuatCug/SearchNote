import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type SyntheticEvent } from 'react';
import { Link } from 'react-router-dom';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { useAppSelector } from '@/app/hooks';
import { MessagesSquare, Paperclip, Pencil, Plus, Reply, SendHorizontal, Trash2 } from 'lucide-react';
import UserAvatar from '@/components/users/UserAvatar';
import Spinner from '@/components/common/Spinner';
import Alert from '@/components/common/Alert';
import ComposerBanner from '@/components/messages/ComposerBanner';
import NotePickerSheet from '@/components/messages/NotePickerSheet';
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
import { timeAgo } from '@/lib/format';
import { joinGroupRoom, leaveGroupRoom, useFallbackPolling } from '@/lib/socket';
import type { GroupMessage } from '@/types/api';

// Yeni mesajlar Socket.io grup odasından anında gelir; bağlantı yoksa sunucu bu aralıkla yoklanır.
const POLL_INTERVAL_MS = 5000;

// Grup sohbeti: sadece üyelere gösterilir. Son 100 mesaj listelenir.
// Mobil uygulamayla aynı özellikler: mesajı yanıtlama, kendi mesajını düzenleme ve mesaja not ekleme ("+").
export default function GroupChat({ groupId, isOwner }: { groupId: string; isOwner: boolean }) {
  const me = useAppSelector((state) => state.auth.user);
  const { data, isLoading, error } = useGetGroupMessagesQuery(groupId, {
    pollingInterval: useFallbackPolling(POLL_INTERVAL_MS),
    skipPollingIfUnfocused: true,
  });
  const [sendMessage, { isLoading: sending }] = useSendGroupMessageMutation();
  const [editMessage, { isLoading: savingEdit }] = useEditGroupMessageMutation();
  const [deleteMessage] = useDeleteGroupMessageMutation();
  const [text, setText] = useState('');
  const [sendError, setSendError] = useState('');
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [editing, setEditing] = useState<GroupMessage | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const attachedNote = useGetNoteQuery(noteId || skipToken);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dialog = useDialog();

  // Sohbet açıkken grubun socket odasına katılınır; yeni mesaj olayı gelince liste yenilenir (bkz. RealtimeBridge).
  useEffect(() => {
    joinGroupRoom(groupId);
    return () => leaveGroupRoom(groupId);
  }, [groupId]);

  const messages = data?.data?.messages;
  const lastId = messages?.at(-1)?._id;

  // Yeni mesaj gelince (sayfanın kendisini değil) sadece mesaj listesini en alta kaydır.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  const focusInput = () => requestAnimationFrame(() => inputRef.current?.focus());
  const authorName = (userId: string) =>
    userId === me?.id ? 'You' : (messages?.find((m) => m.user?._id === userId)?.user?.fullName ?? 'Someone');

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending || savingEdit) return;
    setSendError('');
    try {
      if (editing) {
        await editMessage({ id: groupId, messageId: editing._id, text: trimmed }).unwrap();
        setEditing(null);
      } else {
        await sendMessage({ id: groupId, text: trimmed, noteId, replyTo: replyTo?._id }).unwrap();
        setReplyTo(null);
        setNoteId(null);
      }
      setText('');
    } catch (err) {
      setSendError(getErrorMessage(err));
    }
  };

  // Enter gönderir, Shift+Enter yeni satır ekler. Esc yanıt / düzenlemeyi iptal eder.
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) handleSubmit(e);
    if (e.key === 'Escape') {
      if (editing) cancelEdit();
      else if (replyTo) setReplyTo(null);
    }
  };

  const startReply = (m: GroupMessage) => {
    setEditing(null);
    setReplyTo(m);
    focusInput();
  };

  const startEdit = (m: GroupMessage) => {
    setReplyTo(null);
    setEditing(m);
    setText(m.text);
    focusInput();
  };

  const cancelEdit = () => {
    setEditing(null);
    setText('');
  };

  const handleDelete = async (messageId: string) => {
    const ok = await dialog.confirm({
      title: 'Delete this message?',
      message: 'It will be removed from the group chat for everyone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteMessage({ id: groupId, messageId }).unwrap();
      if (editing?._id === messageId) cancelEdit();
      if (replyTo?._id === messageId) setReplyTo(null);
    } catch (err) {
      dialog.alert({ message: getErrorMessage(err) });
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
    <section className="card flex flex-col h-[60vh] min-h-[420px]" aria-label="Group chat">
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
        {!messages?.length ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
            <MessagesSquare size={28} />
            <p className="mt-2 text-sm">No messages yet. Say hi to the group!</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.user?._id === me?.id;
            const hasExtras = Boolean(m.reply || m.note);
            return (
              <div
                key={m._id}
                data-message-id={m._id}
                className={`group flex gap-2.5 rounded-xl transition-colors ${mine ? 'flex-row-reverse' : ''}`}
              >
                <Link to={`/users/${m.user?._id}`} className="shrink-0 mt-0.5">
                  <UserAvatar user={m.user} size="sm" />
                </Link>
                <div className={`min-w-0 max-w-[75%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs text-gray-500">
                    {!mine && <span className="font-semibold text-gray-700">{m.user?.fullName ?? 'Deleted user'} · </span>}
                    {timeAgo(m.createdAt)}
                    {m.editedAt && ' · Edited'}
                  </span>
                  <div className={`mt-1 flex items-center gap-1 ${mine ? 'flex-row-reverse' : ''}`}>
                    <div
                      className={`min-w-0 rounded-2xl text-sm ${hasExtras ? 'p-2' : 'px-3.5 py-2'} ${
                        mine ? 'bg-navy-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                      }`}
                    >
                      {m.reply && (
                        <button
                          type="button"
                          onClick={() => jumpToMessage(m.reply!.message)}
                          className={`mb-1.5 block w-full min-w-0 rounded-xl px-3 py-1.5 text-left ${
                            mine ? 'bg-white/12 hover:bg-white/18' : 'bg-white/80 hover:bg-white'
                          }`}
                        >
                          <span className={`block text-xs font-bold ${mine ? 'text-white/90' : 'text-navy-800'}`}>
                            {authorName(m.reply.user)}
                          </span>
                          <span className={`block truncate text-[13px] ${mine ? 'text-white/75' : 'text-gray-600'}`}>
                            {m.reply.text || 'Message'}
                          </span>
                        </button>
                      )}
                      {m.note && <NoteAttachment note={m.note} mine={mine} inert={false} />}
                      <p className={`whitespace-pre-line break-words ${hasExtras ? 'px-1.5 pb-0.5' : ''}`}>{m.text}</p>
                    </div>
                    <div className="flex shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
                      <ActionButton label="Reply" onClick={() => startReply(m)}>
                        <Reply size={14} />
                      </ActionButton>
                      {mine && (
                        <ActionButton label="Edit message" onClick={() => startEdit(m)}>
                          <Pencil size={14} />
                        </ActionButton>
                      )}
                      {(mine || isOwner) && (
                        <ActionButton label="Delete message" danger onClick={() => handleDelete(m._id)}>
                          <Trash2 size={14} />
                        </ActionButton>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-100 p-3 sm:p-4">
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
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setNotePickerOpen(true)}
            disabled={Boolean(editing)}
            className="w-10 h-10 shrink-0 rounded-full bg-navy-50 text-navy-800 hover:bg-navy-100 disabled:opacity-40 flex items-center justify-center"
            aria-label="Share a note"
            title="Share a note"
          >
            <Plus size={20} />
          </button>
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
            placeholder={noteId ? 'Say something about this note...' : 'Write a message...'}
            className="form-input resize-none max-h-32"
          />
          <button
            type="submit"
            disabled={sending || savingEdit || !text.trim()}
            className="btn-primary px-3.5 shrink-0"
            aria-label={editing ? 'Save' : 'Send'}
          >
            <SendHorizontal size={17} />
          </button>
        </div>
      </form>

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
    </section>
  );
}

function ActionButton({
  label,
  danger = false,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`p-1 rounded text-gray-300 hover:bg-gray-100 ${danger ? 'hover:text-rose-500' : 'hover:text-navy-600'}`}
    >
      {children}
    </button>
  );
}
