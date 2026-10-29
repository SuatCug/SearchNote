import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { Trash2 } from 'lucide-react';
import Alert from '@/components/common/Alert';
import UserAvatar from '@/components/users/UserAvatar';
import { useDialog } from '@/components/common/DialogProvider';
import { useAddCommentMutation, useDeleteCommentMutation } from '@/services/notesApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { timeAgo } from '@/lib/format';
import type { Comment, NoteDetail } from '@/types/api';

// Not sayfasındaki yorumlar kartı (Instagram'daki gibi): yüksekliği sınırlı, yorumlar kartın içinde kayar,
// yazma kutusu kartın altında sabit. Yorum eklendikçe sayfa uzamaz.
export default function CommentSection({ note }: { note: NoteDetail }) {
  return (
    <section id="comments" className="card flex flex-col overflow-hidden scroll-mt-20 md:scroll-mt-24" aria-labelledby="comments-title">
      <h2 id="comments-title" className="border-b border-gray-100 px-5 py-3.5 text-lg font-semibold text-gray-900">
        Comments <span className="text-gray-400 font-normal text-base">({note.comments.length})</span>
      </h2>
      <div className="max-h-[min(55vh,440px)] overflow-y-auto overscroll-contain px-4 py-3 lg:max-h-[min(60vh,520px)]">
        <CommentList note={note} />
      </div>
      <div className="border-t border-gray-100 px-4 py-2.5">
        <CommentForm note={note} />
      </div>
    </section>
  );
}

// Giriş / doğrulama durumuna göre tek satırlık yorum kutusu: Enter gönderir, Shift+Enter yeni satır.
export function CommentForm({ note, autoFocus = false }: { note: NoteDetail; autoFocus?: boolean }) {
  const user = useAppSelector((state) => state.auth.user);
  const [addComment] = useAddCommentMutation();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Pencere kendi kapat butonuna odaklandıktan sonra (bir kare sonra) yazma kutusuna geçilir.
  useEffect(() => {
    if (!autoFocus) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [autoFocus]);

  // Yorum hemen listede görünür ve kutu boşalır; gönderilemezse yazı kutuya geri konur.
  const submit = async () => {
    const value = text.trim();
    if (!value || !user) return;
    setError('');
    setText('');
    try {
      await addComment({
        id: note._id,
        text: value,
        user: { _id: user.id, fullName: user.fullName, avatarUrl: user.avatarUrl },
      }).unwrap();
    } catch (err) {
      setText((current) => current || value);
      setError(getErrorMessage(err));
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  if (!user) {
    return (
      <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
        <Link to="/login" state={{ from: `/notes/${note._id}` }} className="font-semibold text-navy-600 hover:text-navy-700">
          Log in
        </Link>{' '}
        to leave a comment.
      </p>
    );
  }
  if (!user.isVerified) {
    return <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">Verify your email address to leave a comment.</p>;
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <UserAvatar user={user} size="sm" />
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={1000}
          placeholder="Add a comment..."
          className="max-h-24 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          aria-label="Comment"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="shrink-0 text-sm font-bold text-navy-600 hover:text-navy-800 disabled:opacity-40"
        >
          Post
        </button>
      </form>
      <Alert className="mt-3">{error}</Alert>
    </>
  );
}

// En yakın kaydırılabilir üst kutu (not sayfasında yorum kartı, pencerede pencerenin gövdesi).
// Bulunamazsa null: sayfanın kendisi asla kaydırılmaz.
function scrollParent(el: HTMLElement | null) {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (overflowY === 'auto' || overflowY === 'scroll') return p;
  }
  return null;
}

// Yorum listesi (eskiden yeniye, en yeni altta, yazma kutusunun hemen üstünde); sahibi veya not sahibi silebilir.
// Açılınca ve yeni yorum gelince liste en alta kayar.
export function CommentList({ note, className = '' }: { note: NoteDetail; className?: string }) {
  const user = useAppSelector((state) => state.auth.user);
  const [deleteComment] = useDeleteCommentMutation();
  const [error, setError] = useState('');
  const dialog = useDialog();
  const listRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);
  const count = note.comments.length;

  // Silmede kaydırılmaz; sadece ilk açılışta ve yorum sayısı artınca.
  useLayoutEffect(() => {
    if (count > prevCount.current) {
      const box = scrollParent(listRef.current);
      if (box) box.scrollTop = box.scrollHeight;
    }
    prevCount.current = count;
  }, [count]);

  const handleDelete = async (commentId: string) => {
    const ok = await dialog.confirm({
      title: 'Delete this comment?',
      message: "The comment will be removed for everyone. This can't be undone.",
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteComment({ id: note._id, commentId }).unwrap();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  // Yorumu, yorumun sahibi veya notun sahibi silebilir (backend ile aynı kural). Henüz gönderilmekte olan
  // (geçici kimlikli) yorum silinemez.
  const canDelete = (comment: Comment) =>
    !comment._id.startsWith('temp-') && Boolean(user && (comment.user?._id === user.id || note.isOwner));

  return (
    <div ref={listRef} className={className}>
      <ul className="space-y-2.5">
        {count === 0 && <li className="py-6 text-center text-sm text-gray-400">No comments yet. Be the first to comment.</li>}
        {note.comments.map((comment) => (
          <li key={comment._id} className="group flex items-start gap-2">
            <Link to={`/users/${comment.user?._id}`} className="shrink-0">
              <UserAvatar user={comment.user} size="xs" className="mt-0.5 !h-7 !w-7" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="inline-block max-w-full rounded-2xl rounded-tl-sm bg-gray-50 px-3 py-1.5">
                <Link to={`/users/${comment.user?._id}`} className="text-[14px] font-semibold text-gray-900 hover:text-navy-600">
                  {comment.user?.fullName ?? 'Deleted user'}
                </Link>
                <p className="text-[14px] leading-snug text-gray-700 break-words whitespace-pre-line">{comment.text}</p>
              </div>
              <div className="mt-0.5 flex items-center gap-3 px-2 text-xs text-gray-400">
                {timeAgo(comment.createdAt)}
                {canDelete(comment) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(comment._id)}
                    className="inline-flex items-center gap-1 font-medium hover:text-rose-500 opacity-0 group-hover:opacity-100 focus:opacity-100 pointer-coarse:opacity-100 transition-opacity"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Alert className="mt-3">{error}</Alert>
    </div>
  );
}
