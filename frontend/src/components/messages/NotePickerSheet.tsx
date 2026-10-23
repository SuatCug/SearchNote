import { useEffect, useState } from 'react';
import { FileText, Loader2, Search } from 'lucide-react';
import ChatSheet from './ChatSheet';
import Alert from '@/components/common/Alert';
import { useGetUserNotesQuery } from '@/services/usersApi';
import { useAppSelector } from '@/app/hooks';
import { getErrorMessage } from '@/lib/getErrorMessage';

interface NotePickerSheetProps {
  onPick: (noteId: string) => void;
  onClose: () => void;
}

// Sohbetteki "+" düğmesi: kendi notlarımdan birini mesaja eklemek için seçtirir.
export default function NotePickerSheet({ onPick, onClose }: NotePickerSheetProps) {
  const me = useAppSelector((state) => state.auth.user);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isFetching, error } = useGetUserNotesQuery(
    { id: me?.id ?? '', limit: 30, q: debounced || undefined },
    { skip: !me?.id }
  );
  const notes = data?.data?.items;

  return (
    <ChatSheet title="Share one of your notes" onClose={onClose}>
      <div className="px-5 pb-3">
        <label className="relative block">
          <span className="sr-only">Search your notes</span>
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your notes"
            className="w-full h-11 rounded-xl border border-gray-300 bg-white pl-11 pr-4 text-[15px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-3 sm:min-h-[240px]">
        {isFetching && !notes?.length ? (
          <div className="flex justify-center py-10 text-gray-400">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : error ? (
          <Alert className="mx-3">{getErrorMessage(error)}</Alert>
        ) : !notes?.length ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">
            {debounced ? 'No notes match that search.' : "You haven't uploaded any notes yet."}
          </p>
        ) : (
          <ul>
            {notes.map((note) => (
              <li key={note._id}>
                <button
                  type="button"
                  onClick={() => onPick(note._id)}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-gray-50 active:bg-gray-100"
                >
                  <span className="w-10 h-10 shrink-0 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center">
                    <FileText size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-gray-900">{note.title}</span>
                    <span className="block truncate text-xs text-gray-500">
                      {[note.courseCode, note.courseName].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ChatSheet>
  );
}
