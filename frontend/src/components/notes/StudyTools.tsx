import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, ListChecks, Loader2, Search } from 'lucide-react';
import StudyModal from './StudyModal';
import { useGetAiStatusQuery } from '@/services/aiApi';
import { useGetNoteQuery } from '@/services/notesApi';
import type { NoteDetail, StudyKind } from '@/types/api';

interface StudyToolsProps {
  note: Pick<NoteDetail, '_id' | 'ai' | 'fileType'>;
  onOpenPage: (page: number) => void;
}

const STATUS_TEXT: Partial<Record<string, string>> = {
  empty: 'We couldn’t find readable text in this file, so study tools aren’t available.',
  unsupported: 'Study tools aren’t available for this file type.',
  failed: 'We couldn’t read this file, so study tools aren’t available.',
};

// Not detayında "Study this note": nottan quiz / flashcard ve sadece bu notun içinde arama.
// Metin yüklemeden sonra arka planda çıkarılır; o sırada kısa bir bekleme mesajı gösterilir.
export default function StudyTools({ note, onOpenPage }: StudyToolsProps) {
  const navigate = useNavigate();
  const { data: aiStatus } = useGetAiStatusQuery();
  const [open, setOpen] = useState<StudyKind | null>(null);
  const [query, setQuery] = useState('');

  // Eski kayıtlarda durum yok: sunucu açılışında sıraya alınır.
  const status = note.ai?.status ?? 'pending';
  const preparing = status === 'pending' || status === 'processing';
  const ready = status === 'ready';
  const aiEnabled = Boolean(aiStatus?.data.enabled);
  // Hazırlanırken not detayı birkaç saniyede bir tazelenir (aynı önbellek kaydı; sayfa da güncellenir).
  useGetNoteQuery(note._id, { pollingInterval: 5000, skip: !preparing, skipPollingIfUnfocused: true });

  const search = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    navigate(`/ask?${new URLSearchParams({ q: query.trim(), note: note._id })}`);
  };

  return (
    <section className="card p-5" aria-labelledby="study-title">
      <h2 id="study-title" className="text-lg font-semibold text-gray-900">
        Study this note
      </h2>

      {preparing ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={15} className="animate-spin" /> Reading the pages… this takes a minute after upload.
        </p>
      ) : !ready ? (
        <p className="mt-2 text-sm text-gray-500">{STATUS_TEXT[status]}</p>
      ) : (
        <>
          {aiEnabled && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setOpen('quiz')} className="btn-primary px-2 py-2">
                <ListChecks size={16} /> Practice quiz
              </button>
              <button type="button" onClick={() => setOpen('flashcards')} className="btn-secondary border-gray-300 px-2 py-2">
                <Layers size={16} /> Flashcards
              </button>
            </div>
          )}
          <form onSubmit={search} className="relative mt-3">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={300}
              placeholder={aiEnabled ? 'Ask something about this note' : 'Search inside this note'}
              aria-label="Search inside this note"
              className="form-input py-2 pl-9 text-sm"
            />
          </form>
          {note.ai?.ocr && (
            <p className="mt-2 text-xs text-gray-400">Text was read from scanned pages, so small mistakes are possible.</p>
          )}
        </>
      )}

      {open && <StudyModal noteId={note._id} kind={open} onClose={() => setOpen(null)} onOpenPage={onOpenPage} />}
    </section>
  );
}
