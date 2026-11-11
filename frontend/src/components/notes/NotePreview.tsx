import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock, type LucideIcon } from 'lucide-react';
import { fetchNotePreview } from '@/lib/downloadNote';
import { FILE_TYPES } from '@/lib/constants';
import PdfPages from './PdfPages';
import type { FileType, NoteDetail } from '@/types/api';

const PREVIEWABLE: FileType[] = ['pdf', 'image'];

interface PreviewState {
  blob: Blob | null;
  url: string | null;
  error: string;
  noteId: string | null;
}

// Not detayındaki büyük önizleme alanı: PDF sayfaları pdf.js ile çizilir, görseller <img> ile gösterilir.
// Word / arşiv dosyaları ve giriş yapmamış ziyaretçiler için bilgilendirici bir yer tutucu çıkar.
interface NotePreviewProps {
  note: Pick<NoteDetail, '_id' | 'title' | 'fileType'>;
  token: string | null;
  canView: boolean;
  // ?page=7: PDF önizlemesi bu sayfaya kaydırılır (içerik aramasından gelince).
  page?: number;
}

export default function NotePreview({ note, token, canView, page }: NotePreviewProps) {
  const previewable = PREVIEWABLE.includes(note.fileType);
  const shouldFetch = previewable && canView;
  const [state, setState] = useState<PreviewState>({ blob: null, url: null, error: '', noteId: null });

  useEffect(() => {
    if (!shouldFetch) return undefined;
    let objectUrl: string | undefined;
    let cancelled = false;
    fetchNotePreview(note._id, token)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ blob, url: objectUrl, error: '', noteId: note._id });
      })
      .catch((err: Error) => !cancelled && setState({ blob: null, url: null, error: err.message, noteId: note._id }));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [shouldFetch, note._id, token]);

  const loading = shouldFetch && state.noteId !== note._id;

  if (!previewable) {
    const { icon: Icon, label } = FILE_TYPES[note.fileType];
    return (
      <Placeholder icon={Icon}>
        <p className="font-semibold text-gray-700">No preview for {label} files</p>
        <p className="text-sm text-gray-500 mt-1">Download the file to see its contents.</p>
      </Placeholder>
    );
  }

  if (!canView) {
    return (
      <Placeholder icon={Lock}>
        <p className="font-semibold text-gray-700">Log in to preview</p>
        <p className="text-sm text-gray-500 mt-1">Viewing and downloading notes is free.</p>
        {!token && (
          <Link to="/login" state={{ from: `/notes/${note._id}` }} className="btn-primary mt-4">
            Log In
          </Link>
        )}
      </Placeholder>
    );
  }

  if (loading) {
    return (
      <Placeholder icon={Loader2} spin>
        <p className="text-sm text-gray-500">Loading preview...</p>
      </Placeholder>
    );
  }

  if (state.error) {
    return (
      <Placeholder icon={FILE_TYPES[note.fileType].icon}>
        <p className="text-sm text-gray-500">{state.error}</p>
      </Placeholder>
    );
  }

  return note.fileType === 'pdf' ? (
    state.blob && <PdfPages blob={state.blob} targetPage={page} />
  ) : (
    <div className="flex items-center justify-center max-h-[70vh] overflow-auto">
      <img src={state.url ?? undefined} alt={note.title} className="max-w-full h-auto rounded-lg shadow-sm bg-white" />
    </div>
  );
}

function Placeholder({ icon: Icon, spin = false, children }: { icon: LucideIcon; spin?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center min-h-[420px] px-6">
      <span className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center text-navy-500 mb-4">
        <Icon size={24} className={spin ? 'animate-spin' : ''} />
      </span>
      {children}
    </div>
  );
}
