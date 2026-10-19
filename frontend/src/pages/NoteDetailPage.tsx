import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { Download, Heart, MessageCircle, Pencil, Trash2, UserRound, Users } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Spinner from '@/components/common/Spinner';
import Alert from '@/components/common/Alert';
import EmptyState from '@/components/common/EmptyState';
import FileTypeBadge from '@/components/notes/FileTypeBadge';
import VisibilityBadge from '@/components/notes/VisibilityBadge';
import NotePreview from '@/components/notes/NotePreview';
import CommentSection from '@/components/notes/CommentSection';
import LikesModal from '@/components/notes/LikesModal';
import UserAvatar from '@/components/users/UserAvatar';
import MessageButton from '@/components/messages/MessageButton';
import { useDialog } from '@/components/common/DialogProvider';
import {
  useDeleteNoteMutation,
  useGetNoteQuery,
  useRegisterDownloadMutation,
  useToggleLikeMutation,
} from '@/services/notesApi';
import { downloadNote } from '@/lib/downloadNote';
import { getErrorMessage, isNotFound } from '@/lib/getErrorMessage';
import { compact } from '@/lib/compact';
import type { NoteDetail } from '@/types/api';
import { formatCount, formatDate, formatFileSize, pluralize } from '@/lib/format';

// "#ceng101" gibi etiket metni: Türkçe karakterler korunur, boşluklar kaldırılır.
const toTag = (value: string) => `#${value.toLocaleLowerCase('tr').replace(/\s+/g, '')}`;

// Not bilgilerinden tıklanabilir etiketler türetilir; her biri ilgili filtreyle aramayı açar.
type NoteTag = { label: string; params: Record<string, string> };

const buildTags = (note: NoteDetail) =>
  compact<NoteTag>([
    note.courseCode && { label: toTag(note.courseCode), params: { courseCode: note.courseCode } },
    { label: toTag(note.department), params: { department: note.department } },
    { label: toTag(note.university), params: { university: note.university } },
    note.semester && { label: toTag(note.semester), params: { semester: note.semester } },
  ]);

export default function NoteDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAppSelector((state) => state.auth);
  // Başkalarının beğeni/yorumları önbellekte görünmez; detay sayfası her açılışta tazelenir.
  const { data, isLoading, error } = useGetNoteQuery(id, { refetchOnMountOrArgChange: true });
  const [toggleLike] = useToggleLikeMutation();
  const [deleteNote, { isLoading: deleting }] = useDeleteNoteMutation();
  const [registerDownload] = useRegisterDownloadMutation();
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [showLikes, setShowLikes] = useState(false);
  const dialog = useDialog();

  if (isLoading) return <PageLayout><Spinner /></PageLayout>;
  if (error || !data) {
    return (
      <PageLayout narrow>
        <EmptyState
          title={isNotFound(error) ? 'Note not found' : 'Could not load note'}
          text={isNotFound(error) ? 'This note may have been deleted or never existed.' : getErrorMessage(error)}
          action={<Link to="/" className="btn-primary">Back to notes</Link>}
        />
      </PageLayout>
    );
  }

  const note = data.data.note;
  const canInteract = Boolean(token && user?.isVerified);

  // Giriş yapmamış kullanıcı giriş sayfasına, doğrulamamış kullanıcı uyarıya yönlendirilir.
  const requireVerified = () => {
    if (!token) {
      navigate('/login', { state: { from: `/notes/${id}` } });
      return false;
    }
    if (!user?.isVerified) {
      setActionError('You need to verify your email address first.');
      return false;
    }
    return true;
  };

  const handleDownload = async () => {
    if (!requireVerified()) return;
    setActionError('');
    setDownloading(true);
    try {
      await downloadNote(note._id, token, note.originalName);
      registerDownload(note._id);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  // Beğenenler listesi giriş gerektirir; ziyaretçi giriş sayfasına yönlenir, sonra bu nota döner.
  const openLikes = () => {
    if (!token) return navigate('/login', { state: { from: `/notes/${note._id}` } });
    setShowLikes(true);
  };

  const handleLike = async () => {
    if (!requireVerified()) return;
    try {
      await toggleLike({ id: note._id, liked: note.isLiked }).unwrap();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    const ok = await dialog.confirm({
      title: 'Delete this note?',
      message: `"${note.title}" will be permanently deleted along with its likes and comments. This can't be undone.`,
      confirmLabel: 'Delete note',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteNote(note._id).unwrap();
      navigate(user ? `/users/${user.id}` : '/', { replace: true });
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  const infoRows = compact<[label: string, value: string]>([
    ['Course', note.courseName],
    note.courseCode && ['Course code', note.courseCode],
    ['University', note.university],
    ['Department', note.department],
    note.instructorName && ['Instructor', note.instructorName],
    note.semester && ['Semester', note.semester],
  ]);

  return (
    <PageLayout>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <FileTypeBadge type={note.fileType} />
        <VisibilityBadge visibility={note.visibility} />
        <span className="text-sm text-gray-500">{formatDate(note.createdAt)}</span>
        {note.group && (
          <Link
            to={`/groups/${note.group._id}`}
            className="inline-flex items-center gap-1 rounded-md bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-700 hover:bg-navy-100"
          >
            <Users size={12} /> {note.group.name}
          </Link>
        )}
      </div>
      <h1 className="text-2xl sm:text-[28px] font-bold text-gray-900 break-words mb-6">
        {note.courseCode ? `${note.courseCode} - ` : ''}
        {note.title}
      </h1>

      {/* Geniş ekranda: solda önizleme ve altında yorumlar, sağda bilgi kartları (iki satıra yayılır).
          Telefonda sıra: önizleme, bilgi kartları, yorumlar. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr] items-start">
        {/* Sol: önizleme */}
        <section className="card overflow-hidden" aria-labelledby="preview-title">
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
            <h2 id="preview-title" className="text-lg font-semibold text-gray-900">
              Preview
            </h2>
            <span className="text-xs text-gray-400 truncate" title={note.originalName}>
              {note.originalName} · {formatFileSize(note.fileSize)}
            </span>
          </div>

          <div className="mx-5 rounded-lg bg-gray-200/70 p-3 sm:p-4">
            <NotePreview note={note} token={token} canView={canInteract} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <Download size={15} /> {pluralize(note.downloadsCount, 'download')}
              </span>
              <span className="flex items-center gap-1.5">
                <MessageCircle size={15} /> {pluralize(note.commentsCount, 'comment')}
              </span>
              <LikesLink count={note.likesCount} onOpen={openLikes} />
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleDownload} disabled={downloading} className="btn-primary bg-navy-800 hover:bg-navy-900">
                <Download size={16} />
                {downloading ? 'Downloading...' : token ? 'Free Download' : 'Log in to download'}
              </button>
              <button
                type="button"
                onClick={handleLike}
                aria-pressed={note.isLiked}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                  note.isLiked
                    ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Heart size={16} className={note.isLiked ? 'fill-rose-500 text-rose-500' : ''} />
                {formatCount(note.likesCount)}
              </button>
            </div>
          </div>
          {actionError && <Alert className="mx-5 mb-4">{actionError}</Alert>}
        </section>

        {/* Sağ: bilgi kartları */}
        <aside className="space-y-5 lg:row-span-2">
          <section className="card p-5" aria-labelledby="info-title">
            <h2 id="info-title" className="text-lg font-semibold text-gray-900">
              Note Details
            </h2>

            <Link to={`/users/${note.author?._id}`} className="mt-3 flex items-center gap-3 group">
              <UserAvatar user={note.author} size="md" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900 group-hover:text-navy-600 truncate">
                  {note.author?.fullName ?? 'Deleted user'}
                </span>
                <span className="block text-xs text-gray-500 truncate">{note.author?.university}</span>
              </span>
            </Link>

            <dl className="mt-4 space-y-1.5 text-sm">
              {infoRows.map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <dt className="font-semibold text-gray-900 shrink-0">{label}:</dt>
                  <dd className="text-gray-700 min-w-0 break-words">{value}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
              <span>{formatDate(note.createdAt)}</span>
              <span className="text-gray-300">|</span>
              <span>{pluralize(note.downloadsCount, 'download')}</span>
              <span className="text-gray-300">|</span>
              <LikesLink count={note.likesCount} onOpen={openLikes} />
            </p>

            {note.isOwner ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link to={`/notes/${note._id}/edit`} className="btn-secondary py-2 border-gray-300">
                  <Pencil size={15} /> Edit
                </Link>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="btn-secondary py-2 border-gray-300 text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                >
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            ) : (
              note.author && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <MessageButton
                    userId={note.author._id}
                    noteId={note._id}
                    label="Ask the author"
                    className="btn-primary py-2 px-2"
                  />
                  <Link to={`/users/${note.author._id}`} className="btn-secondary py-2 px-2 border-gray-300">
                    <UserRound size={15} /> View Profile
                  </Link>
                </div>
              )
            )}
          </section>

          <section className="card p-5" aria-labelledby="desc-title">
            <h2 id="desc-title" className="text-lg font-semibold text-gray-900">
              Description & Tags
            </h2>
            {note.description ? (
              <p className="mt-2 text-sm leading-relaxed text-gray-700 whitespace-pre-line break-words">{note.description}</p>
            ) : (
              <p className="mt-2 text-sm text-gray-400">No description added.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {/* Etiketler aramaya götürür; ziyaretçi arama yapamadığı için onlara düz etiket gösterilir. */}
              {buildTags(note).map((tag) =>
                token ? (
                  <Link
                    key={tag.label}
                    to={`/?${new URLSearchParams(tag.params)}`}
                    className="rounded-md bg-gray-100 px-2.5 py-1 text-sm text-gray-700 hover:bg-navy-50 hover:text-navy-700 transition-colors"
                  >
                    {tag.label}
                  </Link>
                ) : (
                  <span key={tag.label} className="rounded-md bg-gray-100 px-2.5 py-1 text-sm text-gray-700">
                    {tag.label}
                  </span>
                )
              )}
            </div>
          </section>
        </aside>

        {/* Sol, önizlemenin altı: yorumlar */}
        <div className="min-w-0 lg:col-start-1">
          <CommentSection note={note} />
        </div>
      </div>
      {showLikes && <LikesModal noteId={note._id} onClose={() => setShowLikes(false)} />}
    </PageLayout>
  );
}

// "12 likes": tıklanınca beğenenler açılır (beğeni yoksa düz metin).
function LikesLink({ count, onOpen }: { count: number; onOpen: () => void }) {
  const content = (
    <>
      <Heart size={14} className="fill-rose-500 text-rose-500" /> {pluralize(count, 'like')}
    </>
  );
  if (!count) return <span className="flex items-center gap-1.5">{content}</span>;
  return (
    <button
      type="button"
      onClick={onOpen}
      title="See who liked this"
      className="flex items-center gap-1.5 rounded hover:text-gray-900 hover:underline underline-offset-2"
    >
      {content}
    </button>
  );
}
