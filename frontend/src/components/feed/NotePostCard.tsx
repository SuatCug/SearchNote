import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { Bookmark, Check, Download, Heart, Loader2, MessageCircle, Share2 } from 'lucide-react';
import FileTypeBadge from '@/components/notes/FileTypeBadge';
import VisibilityBadge from '@/components/notes/VisibilityBadge';
import UserAvatar from '@/components/users/UserAvatar';
import LikesModal from '@/components/notes/LikesModal';
import CommentsModal from '@/components/notes/CommentsModal';
import { useDialog } from '@/components/common/DialogProvider';
import { useRegisterDownloadMutation, useToggleLikeMutation, useToggleSaveMutation } from '@/services/notesApi';
import { downloadNote } from '@/lib/downloadNote';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { FILE_TYPES } from '@/lib/constants';
import { formatCount, formatFileSize, timeAgo } from '@/lib/format';
import { compact } from '@/lib/compact';
import type { NoteCard } from '@/types/api';

type OptimisticState = Partial<Pick<NoteCard, 'isLiked' | 'likesCount' | 'isSaved'>>;

const actionClass =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50 disabled:hover:bg-transparent transition-colors';

// Akıştaki sosyal medya tarzı not gönderisi: yazar, içerik, dosya eki, ders etiketleri ve etkileşim butonları.
export default function NotePostCard({ note, index = 0 }: { note: NoteCard; index?: number }) {
  const token = useAppSelector((state) => state.auth.token);
  const isVerified = useAppSelector((state) => state.auth.user?.isVerified);
  const [toggleLike] = useToggleLikeMutation();
  const [toggleSave] = useToggleSaveMutation();
  const [registerDownload] = useRegisterDownloadMutation();
  const dialog = useDialog();

  // Beğeni/kaydet anında görünsün diye yerel (iyimser) durum; liste yenilenip yeni not gelince sıfırlanır.
  const [optimistic, setOptimistic] = useState<OptimisticState | null>(null);
  const [prevNote, setPrevNote] = useState(note);
  if (note !== prevNote) {
    setPrevNote(note);
    setOptimistic(null);
  }
  const isLiked = optimistic?.isLiked ?? note.isLiked;
  const likesCount = optimistic?.likesCount ?? note.likesCount;
  const isSaved = optimistic?.isSaved ?? note.isSaved;

  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const noteUrl = `/notes/${note._id}`;
  const FileIcon = (FILE_TYPES[note.fileType] ?? FILE_TYPES.pdf).icon;
  const verifyHint = isVerified ? undefined : 'Verify your email to do this';

  const handleLike = async () => {
    setOptimistic((o) => ({ ...o, isLiked: !isLiked, likesCount: likesCount + (isLiked ? -1 : 1) }));
    try {
      await toggleLike({ id: note._id, liked: isLiked }).unwrap();
    } catch (err) {
      setOptimistic((o) => ({ ...o, isLiked, likesCount }));
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  const handleSave = async () => {
    setOptimistic((o) => ({ ...o, isSaved: !isSaved }));
    try {
      await toggleSave({ id: note._id, saved: isSaved }).unwrap();
    } catch (err) {
      setOptimistic((o) => ({ ...o, isSaved }));
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadNote(note._id, token, note.originalName);
      registerDownload(note._id);
    } catch (err) {
      dialog.alert({ title: 'Download failed', message: (err as Error).message });
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${noteUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: note.title, url });
      } catch {
        // Kullanıcı paylaşım penceresini kapattı.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  const tags = compact<{ label: string; to: string }>([
    note.courseCode && { label: note.courseCode, to: `/?courseCode=${encodeURIComponent(note.courseCode)}` },
    note.department && { label: note.department, to: `/?department=${encodeURIComponent(note.department)}` },
    note.semester && { label: note.semester, to: `/?semester=${encodeURIComponent(note.semester)}` },
  ]);

  return (
    <article
      className="card card-enter p-4 sm:p-5 hover:border-navy-100 transition-colors"
      style={{ animationDelay: `${Math.min(index, 10) * 50}ms` }}
    >
      <header className="flex items-start gap-3">
        <Link to={`/users/${note.author?._id}`} className="shrink-0">
          <UserAvatar user={note.author} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-tight">
            <Link to={`/users/${note.author?._id}`} className="font-semibold text-gray-900 hover:text-navy-700">
              {note.author?.fullName}
            </Link>
            <span className="text-gray-400"> · {timeAgo(note.createdAt)}</span>
          </p>
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {note.university}
            {note.instructorName && ` · ${note.instructorName}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
          <VisibilityBadge visibility={note.visibility} />
          <FileTypeBadge type={note.fileType} />
        </div>
      </header>

      <div className="mt-3">
        <h3 className="text-[17px] font-bold leading-snug text-gray-900 break-words">
          <Link to={noteUrl} className="hover:text-navy-700">
            {note.title}
          </Link>
        </h3>
        <p className="mt-0.5 text-sm font-medium text-navy-600">{note.courseName}</p>
        {note.description && (
          <p className="mt-2 text-[15px] leading-relaxed text-gray-600 line-clamp-3 whitespace-pre-line break-words">
            {note.description}
          </p>
        )}
      </div>

      {/* Dosya eki */}
      <Link
        to={noteUrl}
        className="mt-3 flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 hover:bg-navy-50/60 hover:border-navy-100 transition-colors"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-navy-600 shadow-sm">
          <FileIcon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-800">{note.originalName}</span>
          <span className="block text-xs text-gray-500">
            {formatFileSize(note.fileSize)} · {formatCount(note.downloadsCount)} downloads
          </span>
        </span>
      </Link>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Link
              key={t.label}
              to={t.to}
              className="max-w-full truncate rounded-md bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-600 hover:bg-navy-100"
            >
              #{t.label}
            </Link>
          ))}
        </div>
      )}

      <footer className="mt-3 -mx-1.5 flex items-center gap-0.5 border-t border-gray-100 pt-2">
        {/* Kalp beğenir; yanındaki sayı beğenenleri açar (Instagram gibi). */}
        <span className="inline-flex items-center">
          <button
            type="button"
            onClick={handleLike}
            disabled={!isVerified}
            title={verifyHint}
            aria-pressed={isLiked}
            aria-label={isLiked ? 'Unlike' : 'Like'}
            className={`${actionClass} pr-1 ${isLiked ? 'text-rose-500 hover:text-rose-600' : ''}`}
          >
            <Heart size={17} className={isLiked ? 'fill-rose-500' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setShowLikes(true)}
            disabled={likesCount === 0}
            title="See who liked this"
            className={`${actionClass} -ml-0.5 pl-1 ${isLiked ? 'text-rose-500 hover:text-rose-600' : ''}`}
          >
            {formatCount(likesCount)}
            <span className="sr-only">likes — see who liked this</span>
          </button>
        </span>
        {/* Yorumlar akıştan ayrılmadan pencerede açılır (Instagram web gibi). */}
        <button type="button" onClick={() => setShowComments(true)} className={actionClass}>
          <MessageCircle size={17} />
          {formatCount(note.commentsCount)}
          <span className="sr-only">comments</span>
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!isVerified || downloading}
          title={verifyHint ?? 'Download'}
          className={actionClass}
        >
          {downloading ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
          <span className="hidden sm:inline">Download</span>
        </button>

        <div className="flex-1" />

        <button type="button" onClick={handleShare} title="Share" aria-label="Share" className={actionClass}>
          {copied ? <Check size={17} className="text-emerald-600" /> : <Share2 size={17} />}
          {copied && <span className="text-xs text-emerald-600">Link copied</span>}
        </button>
        <button
          type="button"
          onClick={handleSave}
          title={isSaved ? 'Remove from saved' : 'Save'}
          aria-label={isSaved ? 'Remove from saved' : 'Save'}
          aria-pressed={isSaved}
          className={`${actionClass} ${isSaved ? 'text-navy-700' : ''}`}
        >
          <Bookmark size={17} className={isSaved ? 'fill-navy-600' : ''} />
        </button>
      </footer>
      {showLikes && <LikesModal noteId={note._id} onClose={() => setShowLikes(false)} />}
      {showComments && <CommentsModal noteId={note._id} onClose={() => setShowComments(false)} />}
    </article>
  );
}
