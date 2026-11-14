import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileSearch, Search, Sparkles, X } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import NotesSearchIllustration from '@/components/ai/NotesSearchIllustration';
import EmptyState from '@/components/common/EmptyState';
import StepProgress, { type ProgressStep } from '@/components/common/StepProgress';
import Alert from '@/components/common/Alert';
import UserAvatar from '@/components/users/UserAvatar';
import { useAskNotesQuery, useGetAiStatusQuery } from '@/services/aiApi';
import { useGetNoteQuery } from '@/services/notesApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import type { AnswerSegment, AskResult, ContentSource } from '@/types/api';

// Notların içinde arama: soru ya da konu yazılır, görülebilen notların sayfalarında aranır.
// Sunucuda yapay zekâ açıksa sayfalar soruyu cevaplıyorsa kısa bir cevap yazılır ve altında sadece dayandığı
// sayfalar listelenir; cevaplamıyorsa hiçbir sayfa gösterilmez. Adres: /ask?q=…&course=…&note=…
export default function AskPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const course = params.get('course')?.trim() ?? '';
  const noteId = params.get('note') ?? '';

  const [question, setQuestion] = useState(q);
  const [courseInput, setCourseInput] = useState(course);
  // Adres değişince (geri tuşu, arama kutusundan yeni arama) kutular da güncellenir.
  const [lastParams, setLastParams] = useState({ q, course });
  if (lastParams.q !== q || lastParams.course !== course) {
    setLastParams({ q, course });
    setQuestion(q);
    setCourseInput(course);
  }

  const { data, error, isFetching } = useAskNotesQuery(
    { question: q, courseCode: noteId ? undefined : course || undefined, noteId: noteId || undefined },
    { skip: q.length < 2 }
  );
  const scopedNote = useGetNoteQuery(noteId, { skip: !noteId });
  const { data: aiStatus } = useGetAiStatusQuery();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams();
    if (question.trim()) next.set('q', question.trim());
    if (courseInput.trim() && !noteId) next.set('course', courseInput.trim());
    if (noteId) next.set('note', noteId);
    setParams(next);
  };

  const removeScope = () => {
    const next = new URLSearchParams(params);
    next.delete('note');
    setParams(next);
  };

  const askExample = (example: string) => {
    const next = new URLSearchParams();
    next.set('q', example);
    if (noteId) next.set('note', noteId);
    setParams(next);
  };

  const result = data?.data;
  const searching = q.length >= 2;

  const intro = (
    <>
      <h1 className={`font-bold text-gray-900 ${searching ? 'text-2xl' : 'text-2xl sm:text-3xl lg:text-4xl'}`}>Search inside notes</h1>
      <p className={`text-gray-600 ${searching ? 'mt-1 text-sm' : 'mt-2 text-sm sm:text-base lg:text-lg'}`}>
        Ask a question or type a topic. We look through the pages of the notes you can see and show where it’s explained.
      </p>
    </>
  );

  const form = (
    <form onSubmit={submit} className={`card space-y-3 ${searching ? 'mt-5 p-4' : 'mt-6 p-4 sm:p-5'}`}>
      <label className="relative block">
        <span className="sr-only">Question or topic</span>
        <Search size={searching ? 17 : 19} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={300}
          autoFocus={!q}
          placeholder="e.g. What is the initial value theorem?"
          className={`form-input pl-10 ${searching ? '' : 'sm:py-3.5 sm:text-base'}`}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {noteId ? (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-navy-50 py-1 pl-2.5 pr-1 text-sm text-navy-800">
            <span className="truncate">
              In: <strong>{scopedNote.data?.data.note.title ?? 'this note'}</strong>
            </span>
            <button
              type="button"
              onClick={removeScope}
              aria-label="Search all notes instead"
              className="rounded p-0.5 text-navy-600 hover:bg-navy-100"
            >
              <X size={14} />
            </button>
          </span>
        ) : (
          <input
            value={courseInput}
            onChange={(e) => setCourseInput(e.target.value)}
            maxLength={20}
            placeholder="Course code"
            aria-label="Course code (optional)"
            className="form-input w-36 sm:w-48 py-2 text-sm"
          />
        )}
        <button type="submit" className="btn-primary ml-auto" disabled={question.trim().length < 2}>
          Search
        </button>
      </div>
    </form>
  );

  // Henüz arama yoksa: solda beyaz daire içinde görsel, sağda daha geniş arama alanı ve örnek sorular
  // (telefonda görsel üstte, küçük).
  if (!searching) {
    return (
      <PageLayout>
        <div className="grid items-center gap-6 sm:py-6 lg:grid-cols-2 lg:gap-12 lg:py-8">
          <NotesSearchIllustration className="mx-auto h-auto w-full max-w-[280px] sm:max-w-[400px] lg:mx-0 lg:max-w-[560px]" />
          <div className="lg:max-w-2xl">
            {intro}
            {form}
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Try asking</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => askExample(example)}
                    className="rounded-full border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-700 transition-colors hover:border-navy-300 hover:bg-navy-50 hover:text-navy-800"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-6 flex items-start gap-2 text-xs text-gray-500">
              <Sparkles size={14} className="mt-px shrink-0 text-navy-400" />
              Answers are written by AI from the pages it finds, with numbers that link to each page.
            </p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout narrow>
      {intro}
      {form}

      <div className="mt-6">
        {isFetching ? (
          // Her yeni soruda adımlar baştan başlasın diye key
          <AskLoading key={`${q}|${course}|${noteId}`} withAnswer={aiStatus?.data.enabled ?? true} />
        ) : error ? (
          <Alert>{getErrorMessage(error)}</Alert>
        ) : result && result.sources.length ? (
          <Results result={result} query={q} />
        ) : (
          <EmptyState
            icon={FileSearch}
            title={result?.notCovered ? 'The notes don’t cover that' : 'No page mentions that'}
            text={
              <>
                Try other words, or{' '}
                <Link to={`/?q=${encodeURIComponent(q)}`} className="font-semibold text-navy-600 hover:underline">
                  search note titles
                </Link>{' '}
                instead.
              </>
            }
          />
        )}
      </div>
    </PageLayout>
  );
}

// Bekleme ekranı: sunucuda sırayla olan adımlar (arama → sayfaları okuma → cevabı yazma) ve cevabın geleceği
// kartın iskeleti. Yapay zekâ kapalıysa sadece arama adımı gösterilir.
const ASK_STEPS: ProgressStep[] = [
  { label: 'Searching notes', at: 0 },
  { label: 'Reading the pages', at: 1500 },
  { label: 'Writing the answer', at: 4000 },
];

function AskLoading({ withAnswer }: { withAnswer: boolean }) {
  return (
    <section className="card p-5">
      <StepProgress steps={withAnswer ? ASK_STEPS : ASK_STEPS.slice(0, 1)} slowAfterMs={15000}>
        {withAnswer && (
          <div className="mt-5 space-y-2.5 border-t border-gray-100 pt-4">
            <span className="skeleton-box block h-3.5 w-full rounded" />
            <span className="skeleton-box block h-3.5 w-[94%] rounded" />
            <span className="skeleton-box block h-3.5 w-[88%] rounded" />
            <span className="skeleton-box block h-3.5 w-[60%] rounded" />
          </div>
        )}
      </StepProgress>
    </section>
  );
}

function Results({ result, query }: { result: AskResult; query: string }) {
  return (
    <div className="space-y-6">
      {result.answer && result.answer.length > 0 && (
        <section className="card p-5" aria-labelledby="answer-title">
          <h2 id="answer-title" className="text-sm font-bold uppercase tracking-wide text-gray-500">
            Answer from the notes
          </h2>
          <Answer segments={result.answer} />
          <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
            Written by AI from the pages below. Check them before you rely on it.
          </p>
        </section>
      )}
      {result.answerError && <p className="text-sm text-gray-500">{result.answerError}</p>}

      <section aria-labelledby="sources-title">
        <h2 id="sources-title" className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
          {/* Cevap varsa liste sadece cevabın dayandığı sayfalardır; yoksa (yapay zekâ kapalı / hata) kelime eşleşmeleri */}
          {result.answer?.length ? 'Sources' : 'Pages that match'}
        </h2>
        <ol className="space-y-3">
          {result.sources.map((source, i) => (
            <SourceCard key={source.chunkId} source={source} number={i + 1} query={query} />
          ))}
        </ol>
      </section>
    </div>
  );
}

// Cevap metni düz yazı olarak gösterilir; kaynaklar altta "Pages that match" listesinde.
function Answer({ segments }: { segments: AnswerSegment[] }) {
  return (
    <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-gray-800">
      {segments.map((segment) => segment.text).join('').trim()}
    </p>
  );
}

function SourceCard({ source, number, query }: { source: ContentSource; number: number; query: string }) {
  const { note, page } = source;
  const to = `/notes/${note._id}${page ? `?page=${page}` : ''}`;
  return (
    <li id={`source-${number}`} className="card scroll-mt-24 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-navy-50 text-xs font-bold text-navy-700">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <Link to={to} className="block font-semibold text-gray-900 hover:text-navy-700">
            {note.courseCode ? `${note.courseCode} – ` : ''}
            {note.title}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
            {note.author && (
              <span className="inline-flex items-center gap-1.5">
                <UserAvatar user={note.author} size="xs" /> {note.author.fullName}
              </span>
            )}
            {page && <span className="font-semibold text-navy-700">Page {page}</span>}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-gray-700">{highlight(source.snippet, query)}</p>
          <Link to={to} className="mt-2 inline-block text-sm font-semibold text-navy-600 hover:underline">
            {page ? `Open page ${page}` : 'Open note'}
          </Link>
        </div>
      </div>
    </li>
  );
}

// Boş sayfada gösterilen örnek sorular; tıklanınca doğrudan aranır.
const EXAMPLES = ['What is a stack?', 'Stack vs queue', 'Types of linked lists', 'Min-heap vs max-heap'];

const STOP_WORDS =new Set('nedir ne nasıl neden hangi kaç mi mı mu mü what is are how why which the and'.split(' '));
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Alıntıda arama kelimelerinin geçtiği yerleri kalın gösterir (kelime kökü yeterli: "dönüşümünde" -> "dönüş").
function highlight(text: string, query: string): ReactNode {
  const stems = query
    .toLocaleLowerCase('tr')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .map((w) => escapeRegex(w.slice(0, Math.min(w.length, 5))));
  if (!stems.length) return text;
  const parts = text.split(new RegExp(`(${stems.join('|')})`, 'giu'));
  return parts.map((part, i) => (i % 2 ? <mark key={i} className="rounded bg-amber-100 px-0.5 text-gray-900">{part}</mark> : part));
}
