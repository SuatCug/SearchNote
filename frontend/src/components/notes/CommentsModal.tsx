import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import Modal from '@/components/common/Modal';
import Spinner from '@/components/common/Spinner';
import UserAvatar from '@/components/users/UserAvatar';
import { CommentForm, CommentList } from './CommentSection';
import { useGetNoteQuery } from '@/services/notesApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { timeAgo } from '@/lib/format';

// Akıştaki yorum ikonuna basınca açılan yorum penceresi (Instagram web gibi): üstte not özeti,
// ortada kayan yorum listesi, altta sabit yazma kutusu. Yorumlar not detayından gelir.
export default function CommentsModal({ noteId, onClose }: { noteId: string; onClose: () => void }) {
  const { data, isLoading, error } = useGetNoteQuery(noteId);
  const note = data?.data?.note;

  return (
    <Modal
      title={
        <>
          <MessageCircle size={17} className="text-navy-600" /> Comments
          {note && <span className="font-normal text-gray-400">({note.comments.length})</span>}
        </>
      }
      onClose={onClose}
      footer={note && <CommentForm note={note} autoFocus />}
    >
      {isLoading ? (
        <div className="py-10">
          <Spinner />
        </div>
      ) : !note ? (
        <p className="px-5 py-10 text-center text-sm text-gray-500">{error ? getErrorMessage(error) : 'Note not found.'}</p>
      ) : (
        <>
          <Link to={`/notes/${note._id}`} className="flex items-start gap-3 border-b border-gray-100 px-4 py-2.5 hover:bg-gray-50">
            <UserAvatar user={note.author} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm">
                <span className="font-semibold text-gray-900">{note.author?.fullName}</span>
                <span className="text-gray-400"> · {timeAgo(note.createdAt)}</span>
              </span>
              <span className="block truncate text-sm font-bold text-gray-900">{note.title}</span>
              <span className="block text-xs font-semibold text-navy-600">Open note</span>
            </span>
          </Link>
          <CommentList note={note} className="px-4 py-3" />
        </>
      )}
    </Modal>
  );
}
