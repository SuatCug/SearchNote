import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Layers, ListChecks, Loader2, Lock, Search, Sparkles, Trash2, Upload, X } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Spinner from '@/components/common/Spinner';
import Alert from '@/components/common/Alert';
import StudyModal from '@/components/notes/StudyModal';
import PracticeIllustration from '@/components/ai/PracticeIllustration';
import UploadStudyFileModal, { STUDY_FILE_ACCEPT } from '@/components/ai/UploadStudyFileModal';
import { useDialog } from '@/components/common/DialogProvider';
import { useDeleteNoteMutation } from '@/services/notesApi';
import { useGetAiStatusQuery, useGetPracticeListQuery } from '@/services/aiApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { pluralize, timeAgo } from '@/lib/format';
import type { PracticeNote, StudyKind } from '@/types/api';

// Quizzes & flashcards: ders kodu ya da konu yazılır, eşleşen notlar listelenir ve quiz / flashcard doğrudan
// buradan açılır (Explore'a gidip notu kaydetmeye gerek yok). Arama yokken: kaldığın yerden devam (quiz çözülen
// notlar, skoruyla) ve kendi / kaydedilen notlar. Adres: /practice?q=…

const DESCRIPTION =
  'Type a course code or topic, pick a note, and get a 10-question quiz or 15 flashcards made from its pages.';
const MIN_QUERY = 2;
const MAX_COURSE_CHIPS = 8;

export default function PracticePage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const searching = q.length >= MIN_QUERY;

  const [input, setInput] = useState(q);
  // Adres değişince (geri tuşu, çip) kutu da güncellenir.
  const [lastQ, setLastQ] = useState(q);
  if (lastQ !== q) {
    setLastQ(q);
    setInput(q);
  }

  // Yazarken arama yapılmaz; Enter'a basınca sonuç sayfası açılır (geçmişe eklenir, geri tuşu listeye döner).
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = input.trim();
    if (next.length >= MIN_QUERY && next !== q) setParams({ q: next });
  };

  const list = useGetPracticeListQuery(undefined, { refetchOnMountOrArgChange: true });
  const search = useGetPracticeListQuery({ q }, { skip: !searching });
  const { data: aiStatus } = useGetAiStatusQuery();
  const aiEnabled = Boolean(aiStatus?.data.enabled);

  const notes = list.data?.data.notes ?? [];
  // Sayfaları okunmakta olan not varsa liste 5 saniyede bir tazelenir; okuma bitince Quiz / Flashcards açılır
  // (aynı önbellek kaydı, not detayındaki "Study this note" ile aynı yöntem).
  const preparing = notes.some((n) => isReading(n.status));
  useGetPracticeListQuery(undefined, { pollingInterval: 5000, skip: searching || !preparing, skipPollingIfUnfocused: true });
  const uploaded = notes.filter((n) => n.sources[0] === 'uploaded');
  const practiced = notes.filter((n) => n.sources[0] === 'practiced');
  const yours = notes.filter((n) => n.sources[0] !== 'practiced' && n.sources[0] !== 'uploaded');

  // Kişisel dosya: önce dosya seçilir, sonra başlık / ders kodu penceresi açılır.
  const fileInput = useRef<HTMLInputElement>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) setPickedFile(file);
  };
  const uploadButton = (
    <>
      <button type="button" onClick={() => fileInput.current?.click()} className="btn-primary">
        <Upload size={16} /> Upload your own file
      </button>
      <input ref={fileInput} type="file" accept={STUDY_FILE_ACCEPT} onChange={onPickFile} className="hidden" />
    </>
  );

  // Hızlı seçim: öğrencinin notlarındaki ders kodları (en son çalışılan önce).
  const courses = [...new Set(notes.map((n) => n.courseCode).filter(Boolean))].slice(0, MAX_COURSE_CHIPS) as string[];

  const searchBox = (
    <form onSubmit={submit} role="search" className={searching ? 'mt-4' : 'mt-6'}>
      <label className="relative block">
        <span className="sr-only">Course code or topic</span>
        <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={100}
          autoFocus={!searching}
          enterKeyHint="search"
          placeholder="e.g. CENG213 or data structures"
          className="form-input rounded-xl py-3.5 pl-11 pr-10 text-base shadow-sm"
        />
        {input && (
          <button
            type="button"
            onClick={() => setInput('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </label>
    </form>
  );

  const aiOffNotice = !aiEnabled && aiStatus && (
    <p className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
      AI features are turned off on this server, so only quizzes and flashcards made earlier can be opened.
    </p>
  );

  // Quiz / flashcard penceresi sayfa düzeyinde tutulur: cevap kaydedilince liste tazelenir ve not başka bölüme
  // geçebilir (ör. "Pick up where you left off"); pencere satırın içinde olsaydı satırla birlikte kapanırdı.
  const [study, setStudy] = useState<{ noteId: string; kind: StudyKind } | null>(null);
  const openStudy = (noteId: string, kind: StudyKind) => setStudy({ noteId, kind });
  const studyModal = study && (
    <StudyModal
      noteId={study.noteId}
      kind={study.kind}
      onClose={() => setStudy(null)}
    />
  );

  // currentData: yazarken önceki aramanın sonuçları gösterilmez. Sadece aramadan gelen notlar listelenir
  // (arama desteği olmayan eski bir sunucu q'yu yok sayıp kişisel listeyi döndürürse sonuç gibi görünmesin).
  const results = (search.currentData?.data.notes ?? []).filter((n) => n.sources.includes('search'));

  // Sonuç sayfası (Enter'dan sonra): dar düzen, görsel yok.
  if (searching) {
    return (
      <PageLayout narrow>
        <Link to="/practice" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-600 hover:underline">
          <ArrowLeft size={15} /> All notes
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Quizzes & flashcards</h1>
        {searchBox}
        {aiOffNotice}
        <div className="mt-6">
          {search.isFetching && !search.currentData ? (
            <Spinner />
          ) : search.error ? (
            <Alert>{getErrorMessage(search.error)}</Alert>
          ) : results.length ? (
            <NoteList title={pluralize(results.length, 'matching note')} notes={results} aiEnabled={aiEnabled} onOpen={openStudy} />
          ) : (
            <div className="card px-6 py-10 text-center">
              <p className="font-semibold text-gray-900">No notes ready for “{q}”</p>
              <p className="mt-1 text-sm text-gray-600">
                Try a course code like “CENG213”, or{' '}
                <Link to={`/ask?q=${encodeURIComponent(q)}`} className="font-semibold text-navy-600 hover:underline">
                  search inside notes
                </Link>{' '}
                for the topic.
              </p>
            </div>
          )}
        </div>
        {studyModal}
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {/* Üstte: solda görsel, sağda arama ve ders kısayolları (diğer "Learn with AI" sayfalarıyla aynı düzen). */}
      <div className="grid items-center gap-6 sm:py-4 lg:grid-cols-[11fr_9fr] lg:gap-10 lg:py-6">
        <PracticeIllustration className="mx-auto h-auto w-full max-w-[400px] sm:max-w-[560px] lg:mx-0 lg:max-w-none" />
        <div className="lg:max-w-2xl">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl lg:text-4xl">Quizzes & flashcards</h1>
          <p className="mt-2 text-sm text-gray-600 sm:text-base lg:text-lg">{DESCRIPTION}</p>
          {searchBox}
          {courses.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Your courses</span>
              {courses.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setParams({ q: code })}
                  aria-pressed={q === code}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                    q === code
                      ? 'border-navy-600 bg-navy-600 text-white'
                      : 'border-gray-200 bg-white text-navy-700 hover:border-navy-300 hover:bg-navy-50'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            {uploadButton}
            <span className="text-xs text-gray-500">PDF, Word or a photo of your notes · only you can see it</span>
          </div>
          {aiOffNotice}
          <p className="mt-6 flex items-start gap-2 text-xs text-gray-500">
            <Sparkles size={14} className="mt-px shrink-0 text-navy-400" />
            <span>
              Written by AI from each note’s pages. Every question shows the page it came from, and your quiz answers
              build your{' '}
              <Link to="/knowledge" className="font-semibold text-navy-600 hover:underline">
                knowledge map
              </Link>
              .
            </span>
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {list.isLoading ? (
          <Spinner />
        ) : list.error ? (
          <Alert>{getErrorMessage(list.error)}</Alert>
        ) : (
          <>
            {uploaded.length > 0 && <NoteList title="Your uploaded files" notes={uploaded} aiEnabled={aiEnabled} onOpen={openStudy} />}
            {practiced.length > 0 && <NoteList title="Pick up where you left off" notes={practiced} aiEnabled={aiEnabled} onOpen={openStudy} />}
            {yours.length > 0 && <NoteList title="Your notes and saved notes" notes={yours} aiEnabled={aiEnabled} onOpen={openStudy} />}
          </>
        )}
      </div>
      {studyModal}
      {pickedFile && (
        <UploadStudyFileModal
          file={pickedFile}
          onClose={() => setPickedFile(null)}
          onUploaded={() => {
            setPickedFile(null);
            list.refetch();
          }}
        />
      )}
    </PageLayout>
  );
}

// Sayfaları henüz okunmakta (sırada / işleniyor).
const isReading = (status: PracticeNote['status']) => status === 'pending' || status === 'processing';

type OpenStudy = (noteId: string, kind: StudyKind) => void;

function NoteList({ title, notes, aiEnabled, onOpen }: { title: string; notes: PracticeNote[]; aiEnabled: boolean; onOpen: OpenStudy }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">{title}</h2>
      <ul className="card divide-y divide-gray-100 overflow-hidden">
        {notes.map((note) => (
          <NoteRow key={note._id} note={note} aiEnabled={aiEnabled} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  );
}

const scoreClass = (ratio: number) =>
  ratio >= 0.75 ? 'bg-emerald-50 text-emerald-700' : ratio >= 0.5 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700';

// Tek satır: ders kodu, başlık, kısa bilgi; sağda skor ve Quiz / Flashcards (telefonda altta, iki eşit düğme).
function NoteRow({ note, aiEnabled, onOpen }: { note: PracticeNote; aiEnabled: boolean; onOpen: OpenStudy }) {
  const preparing = isReading(note.status);
  // Kişisel dosyanın metni okunamadıysa (boş / taranamayan / hata) quiz açılamaz; dosya silinebilir.
  const unreadable = !preparing && note.status !== 'ready';
  const canOpen = (kind: keyof PracticeNote['ready']) => !preparing && (aiEnabled || note.ready[kind]);
  const { practice } = note;
  const meta = [
    note.isPrivate ? 'Only you' : note.author?.fullName,
    note.pages ? pluralize(note.pages, 'page') : null,
    practice ? `practiced ${timeAgo(practice.lastAt)}` : null,
  ].filter(Boolean);

  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="min-w-0 flex-1">
        {/* Ders kodu girilmeden yüklenen kişisel dosyada ders adı = başlık; aynı yazı iki kez görünmesin. */}
        {(note.courseCode || (note.courseName && note.courseName !== note.title)) && (
          <p className="truncate text-xs font-bold uppercase tracking-wide text-navy-600">
            {note.courseCode || note.courseName}
          </p>
        )}
        <Link to={`/notes/${note._id}`} className="block truncate font-semibold text-gray-900 hover:text-navy-700">
          {note.title}
        </Link>
        <p className="flex items-center gap-1 truncate text-xs text-gray-500">
          {note.isPrivate && <Lock size={11} className="shrink-0" />}
          {meta.join(' · ')}
        </p>
      </div>

      {preparing ? (
        <div className="flex items-center gap-2 sm:shrink-0">
          <p className="flex flex-1 items-center gap-2 text-sm text-gray-500">
            <Loader2 size={15} className="animate-spin" /> Reading the pages…
          </p>
          {note.isPrivate && <DeleteFileButton note={note} />}
        </div>
      ) : unreadable ? (
        <div className="flex items-center gap-2 sm:shrink-0">
          <p className="flex flex-1 items-center gap-2 text-sm text-rose-700">
            <AlertCircle size={15} className="shrink-0" /> Couldn’t read text in this file
          </p>
          {note.isPrivate && <DeleteFileButton note={note} />}
        </div>
      ) : (
        <div className="flex items-center gap-2 sm:shrink-0">
          {practice && (
            <span
              className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold sm:inline ${scoreClass(practice.correct / practice.answered)}`}
            >
              {practice.correct}/{practice.answered}
            </span>
          )}
          <button
            type="button"
            onClick={() => onOpen(note._id, 'quiz')}
            disabled={!canOpen('quiz')}
            className="btn-primary flex-1 px-3 py-2 sm:flex-none"
          >
            <ListChecks size={16} /> {practice ? 'Quiz again' : 'Quiz'}
          </button>
          <button
            type="button"
            onClick={() => onOpen(note._id, 'flashcards')}
            disabled={!canOpen('flashcards')}
            className="btn-secondary flex-1 px-3 py-2 sm:flex-none"
          >
            <Layers size={16} /> Flashcards
          </button>
          {note.isPrivate && <DeleteFileButton note={note} />}
        </div>
      )}

    </li>
  );
}

// Kişisel dosyayı silme (onay sorulur). Silinince liste tazelenir; quiz / flashcard setleri ve cevaplar da silinir.
function DeleteFileButton({ note }: { note: PracticeNote }) {
  const dialog = useDialog();
  const [deleteNote] = useDeleteNoteMutation();
  const [deleting, setDeleting] = useState(false);
  const { refetch } = useGetPracticeListQuery();

  const remove = async () => {
    if (deleting) return;
    const ok = await dialog.confirm({
      title: 'Delete this file?',
      message: `“${note.title}” and its quizzes and flashcards will be deleted.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteNote(note._id).unwrap();
      refetch();
    } catch (error) {
      setDeleting(false);
      await dialog.alert({ title: 'Couldn’t delete the file', message: getErrorMessage(error) });
    }
  };

  return (
    <button
      type="button"
      onClick={remove}
      aria-label={`Delete ${note.title}`}
      title="Delete file"
      className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
    >
      {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
    </button>
  );
}
