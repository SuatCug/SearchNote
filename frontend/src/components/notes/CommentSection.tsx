import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { Send, Trash2 } from 'lucide-react';
import Alert from '@/components/common/Alert';
import UserAvatar from '@/components/users/UserAvatar';
import { useDialog } from '@/components/common/DialogProvider';
import { useAddCommentMutation, useDeleteCommentMutation } from '@/services/notesApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { timeAgo } from '@/lib/format';
import type { Comment, NoteDetail } from '@/types/api';

export default function CommentSection({ note }: { note: NoteDetail }) {
  const user = useAppSelector((state) => state.auth.user);
  const [addComment, { isLoading: adding }] = useAddCommentMutation();
  const [deleteComment] = useDeleteCommentMutation();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const dialog = useDialog();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    try {
      await addComment({ id: note._id, text: text.trim() }).unwrap();
      setText('');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

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

  // Yorumu, yorumun sahibi veya notun sahibi silebilir (backend ile aynı kural).
  const canDelete = (comment: Comment) => Boolean(user && (comment.user?._id === user.id || note.isOwner));

  return (
    <section id="comments" className="card p-5 scroll-mt-36 md:scroll-mt-24" aria-labelledby="comments-title">
      <h2 id="comments-title" className="text-lg font-semibold text-gray-900">
        Comments <span className="text-gray-400 font-normal text-base">({note.comments.length})</span>
      </h2>

      {/* Yorum yazma alanı listenin üstünde: yeni yorum hemen görünür, uzun listede aşağı kaydırmak gerekmez. */}
      {!user ? (
        <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
          <Link to="/login" state={{ from: `/notes/${note._id}` }} className="font-semibold text-navy-600 hover:text-navy-700">
            Log in
          </Link>{' '}
          to leave a comment.
        </p>
      ) : !user.isVerified ? (
        <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
          Verify your email address to leave a comment.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 flex items-start gap-3">
          <UserAvatar user={user} size="sm" className="mt-1" />
          <div className="min-w-0 flex-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Write a comment..."
              className="form-input resize-y text-sm"
              aria-label="Comment"
            />
            <div className="mt-2 flex justify-end">
              <button type="submit" disabled={adding || !text.trim()} className="btn-primary py-2">
                <Send size={15} /> {adding ? 'Sending...' : 'Comment'}
              </button>
            </div>
          </div>
        </form>
      )}

      <ul className="mt-4 space-y-4">
        {note.comments.length === 0 && (
          <li className="py-6 text-center text-sm text-gray-400">No comments yet. Be the first to comment.</li>
        )}
        {/* En yeni yorum üstte */}
        {[...note.comments].reverse().map((comment) => (
          <li key={comment._id} className="group flex items-start gap-3">
            <Link to={`/users/${comment.user?._id}`} className="shrink-0">
              <UserAvatar user={comment.user} size="sm" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-2.5">
                <Link to={`/users/${comment.user?._id}`} className="text-sm font-semibold text-gray-900 hover:text-navy-600">
                  {comment.user?.fullName ?? 'Deleted user'}
                </Link>
                <p className="mt-0.5 text-sm leading-relaxed text-gray-700 break-words whitespace-pre-line">{comment.text}</p>
              </div>
              <div className="mt-1 flex items-center gap-3 px-2 text-xs text-gray-400">
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
    </section>
  );
}
