import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import type { DirectMessage, MessageNote } from '@/types/api';

interface MessageBubbleProps {
  message: DirectMessage;
  mine: boolean;
  // Alıntıdaki gönderen adı ("You" ya da karşı tarafın adı).
  replyAuthor?: string;
  onQuoteClick?: (messageId: string) => void;
  // Basılı tutma menüsündeki kopyada bağlantılar tıklanmasın.
  inert?: boolean;
}

// Tek bir mesaj balonu: varsa yanıt alıntısı ve eklenmiş not, ardından metin.
export default function MessageBubble({ message: m, mine, replyAuthor, onQuoteClick, inert = false }: MessageBubbleProps) {
  return (
    <div
      className={`rounded-[20px] px-3.5 py-2.5 text-[15px] leading-snug ${
        mine ? 'bg-navy-800 text-white' : 'bg-navy-100/70 text-gray-900'
      } ${m.reply || m.note ? 'pt-2 px-2' : ''}`}
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
      <p className={`whitespace-pre-line break-words ${m.reply || m.note ? 'px-1.5 pb-0.5' : ''}`}>{m.text}</p>
    </div>
  );
}

// Mesaja eklenmiş not kartı (tıklayınca not sayfası açılır).
export function NoteAttachment({ note, mine, inert }: { note: MessageNote; mine: boolean; inert: boolean }) {
  return (
    <Link
      to={`/notes/${note._id}`}
      tabIndex={inert ? -1 : undefined}
      onClick={(e) => inert && e.preventDefault()}
      className={`mb-1.5 flex items-center gap-2.5 rounded-xl px-3 py-2 transition-colors ${
        mine ? 'bg-white/12 hover:bg-white/18' : 'bg-white hover:bg-navy-50'
      }`}
    >
      <FileText size={18} className={`shrink-0 ${mine ? 'text-white' : 'text-navy-600'}`} />
      <span className="min-w-0">
        <span className={`block truncate text-sm font-semibold ${mine ? 'text-white' : 'text-gray-900'}`}>{note.title}</span>
        <span className={`block truncate text-xs ${mine ? 'text-white/70' : 'text-gray-500'}`}>
          {[note.courseCode, note.courseName].filter(Boolean).join(' · ')}
        </span>
      </span>
    </Link>
  );
}
