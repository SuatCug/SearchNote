import { Link } from 'react-router-dom';
import { Archive, Download, Heart, Lock } from 'lucide-react';
import { formatCount, timeAgo } from '@/lib/format';
import type { FileType, NoteCard } from '@/types/api';

// Mobil uygulamadaki renklerle aynı: yazı / zemin / çerçeve.
const TYPES: Record<FileType, { short: string; text: string; bg: string; border: string; tag: string }> = {
  pdf: { short: 'PDF', text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', tag: 'bg-rose-600' },
  docx: { short: 'DOC', text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', tag: 'bg-blue-600' },
  image: { short: 'IMG', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', tag: 'bg-amber-600' },
  archive: { short: 'ZIP', text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', tag: 'bg-violet-600' },
};

// Profildeki not ızgarasında küçük kart (mobildeki NoteGridCard): üstte dosya türü renginde zemin üzerinde
// köşesi kıvrık sayfa çizimi, ders kodu ve adı; altta başlık, beğeni / indirme sayısı ve tarih.
// Sadece takipçilere açık notlarda kilit ikonu olur (herkese açık olmak varsayılan, ayrıca yazılmaz).
export default function NoteGridCard({ note }: { note: NoteCard }) {
  const type = TYPES[note.fileType] ?? TYPES.pdf;
  return (
    <Link
      to={`/notes/${note._id}`}
      className="card-enter flex w-full min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white hover:shadow-md transition-shadow"
    >
      <div className={`relative flex h-[100px] items-center justify-center border-b border-gray-200 ${type.bg}`}>
        {(note.courseCode || note.courseName) && (
          <span className={`absolute left-2.5 right-2.5 top-2 truncate text-[10px] tracking-wide ${type.text}`}>
            {note.courseCode && <b className="font-extrabold">{note.courseCode}</b>}
            {note.courseCode && note.courseName && note.courseName !== note.courseCode && ' · '}
            {note.courseName !== note.courseCode && <span className="font-semibold opacity-80">{note.courseName}</span>}
          </span>
        )}
        <span className={`relative mt-3 h-[58px] w-[46px] rounded-[5px] border bg-white px-[7px] pt-4 shadow-sm ${type.border}`}>
          {/* Kıvrık köşe */}
          <span
            className={`absolute -right-px -top-px h-3 w-3 rounded-tr-[5px] ${type.bg}`}
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
          />
          <span className={`absolute -right-px -top-px h-3 w-3 border-b border-l ${type.border}`} style={{ clipPath: 'polygon(0 0, 0 100%, 100% 100%)' }} />
          {note.fileType === 'archive' ? (
            <Archive size={18} className={`mx-auto -mt-1 ${type.text}`} />
          ) : (
            <span className="flex flex-col gap-1">
              <span className="h-[3px] w-[70%] rounded bg-gray-200" />
              <span className="h-[3px] w-[90%] rounded bg-gray-200" />
              <span className="h-[3px] w-[55%] rounded bg-gray-200" />
            </span>
          )}
          <span className={`absolute -left-2 bottom-2 rounded-[3px] px-[5px] py-px text-[9px] font-extrabold tracking-wide text-white ${type.tag}`}>
            {type.short}
          </span>
        </span>
      </div>
      <div className="p-3">
        <p className="line-clamp-2 break-words text-sm font-bold leading-[18px] text-gray-900">{note.title}</p>
        <p className="mt-1.5 flex items-center gap-2.5 text-xs text-gray-500">
          {note.visibility === 'followers' && <Lock size={12} className="shrink-0" aria-label="Followers only" />}
          <span className="inline-flex shrink-0 items-center gap-1" title="Likes">
            <Heart size={12} /> {formatCount(note.likesCount)}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1" title="Downloads">
            <Download size={12} /> {formatCount(note.downloadsCount)}
          </span>
          <span className="ml-auto truncate">{timeAgo(note.createdAt)}</span>
        </p>
      </div>
    </Link>
  );
}
