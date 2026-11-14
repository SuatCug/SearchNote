import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, ExternalLink, FileText, RotateCcw, Sparkles, X } from 'lucide-react';
import Modal from '@/components/common/Modal';
import StepProgress, { type ProgressStep } from '@/components/common/StepProgress';
import { useGetStudySetQuery, useRecordQuizAnswerMutation } from '@/services/aiApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import type { Flashcard, QuizQuestion, StudyKind } from '@/types/api';

interface StudyModalProps {
  noteId: string;
  kind: StudyKind;
  onClose: () => void;
}

const TITLES: Record<StudyKind, string> = {
  quiz: 'New questions',
  'note-quiz': 'Questions from the note',
  'topic-quiz': 'Topic practice',
  flashcards: 'Flashcards',
};

type QuizKind = 'quiz' | 'note-quiz' | 'topic-quiz';

// Üretim sırasında gösterilen adımlar (tek istek: geçişler tahmini sürelere göre; quiz ~20–30 sn, flashcard ~15 sn).
const LOADING_STEPS: Record<StudyKind, ProgressStep[]> = {
  quiz: [
    { label: 'Reading the note', at: 0 },
    { label: 'Looking at the note’s questions and topics', at: 3000 },
    { label: 'Writing new questions', at: 8000 },
    { label: 'Working out the answers', at: 15000 },
  ],
  'note-quiz': [
    { label: 'Reading the note', at: 0 },
    { label: 'Finding the questions', at: 3000 },
    { label: 'Preparing the answer options', at: 9000 },
  ],
  'topic-quiz': [
    { label: 'Looking at this note’s topics', at: 0 },
    { label: 'Writing new questions', at: 3000 },
  ],
  flashcards: [
    { label: 'Reading the note', at: 0 },
    { label: 'Picking the key terms', at: 3000 },
    { label: 'Making the flashcards', at: 7000 },
  ],
};

// Notun kendi sorusunda (Questions from the note) sayfası gösterilir. Yapay zekânın yazdığı sorularda etiket yok:
// hepsi yeni sorudur, nottan alınmış gibi görünmesin.
function originLabel(q: QuizQuestion) {
  if (q.origin === 'note') return q.page ? `Page ${q.page} of the note` : null;
  return null;
}

// Quiz açılınca önce mod seçilir: notun kendi soruları ya da yapay zekânın yazdığı yeni sorular.
const QUIZ_MODES: { kind: 'note-quiz' | 'quiz'; title: string; text: string; icon: typeof FileText }[] = [
  {
    kind: 'note-quiz',
    title: 'Questions from the note',
    text: 'Practise with the questions already in this note, such as past exam questions, exercises and worked examples, asked exactly as they are.',
    icon: FileText,
  },
  {
    kind: 'quiz',
    title: 'New questions',
    text: 'The AI writes new questions from this note: ones similar to the note’s own questions, and ones on its explanations and formulas.',
    icon: Sparkles,
  },
];

function QuizModeChooser({ onChoose }: { onChoose: (kind: 'note-quiz' | 'quiz') => void }) {
  return (
    <div className="px-5 py-5 sm:px-6">
      <p className="text-center text-base font-semibold text-navy-700">How do you want to practise?</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {QUIZ_MODES.map(({ kind, title, text, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            onClick={() => onChoose(kind)}
            className="flex flex-col items-start gap-2 rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-navy-300 hover:bg-navy-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
              <Icon size={18} />
            </span>
            <span className="text-[15px] font-semibold text-gray-900">{title}</span>
            <span className="text-sm leading-relaxed text-gray-600">{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Notta soru bulunamadıysa: diğer moda geçiş.
function NoNoteQuestions({ onNewQuestions }: { onNewQuestions: () => void }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-[15px] font-semibold text-gray-900">No questions in this note</p>
      <p className="mt-1 text-sm text-gray-600">
        We couldn’t find any exam questions, exercises or examples in it. The AI can write new questions instead.
      </p>
      <button type="button" onClick={onNewQuestions} className="btn-primary mt-5">
        <Sparkles size={15} /> Create new questions
      </button>
    </div>
  );
}

// Hazırlanırken içeriğin yerinde duran iskelet: quiz'de soru + 4 şık, flashcard'da kart.
function StudySkeleton({ kind }: { kind: StudyKind }) {
  if (kind === 'flashcards') {
    return <span className="skeleton-box mt-6 block h-44 w-full rounded-xl" />;
  }
  return (
    <div className="mt-6 space-y-3">
      <span className="skeleton-box block h-4 w-[85%] rounded" />
      <span className="skeleton-box block h-4 w-[55%] rounded" />
      <div className="space-y-2 pt-2">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="skeleton-box block h-11 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// Nottan üretilen quiz ya da flashcard'lar. İlk açılışta set üretilir (birkaç saniye sürer), sonra kayıtlıdır.
// Quiz istenince önce mod seçilir (notun soruları / yeni sorular). Quiz bitince aynı pencerede "konu pratiği"ne
// ya da diğer moda geçilebilir.
export default function StudyModal({ noteId, kind: initialKind, onClose }: StudyModalProps) {
  const [kind, setKind] = useState<StudyKind | null>(initialKind === 'quiz' ? null : initialKind);
  // Konu pratiği her açılışta sunucuya sorulur: bitirilen turun yerine sıradaki (ya da yeni) tur gelir.
  const { data, error, isFetching, refetch } = useGetStudySetQuery(
    { noteId, kind: kind ?? 'quiz' },
    { skip: !kind, refetchOnMountOrArgChange: kind === 'topic-quiz' }
  );
  const set = kind ? data?.data.set : undefined;

  if (!kind) {
    return (
      <Modal title="Practice quiz" onClose={onClose} size="lg">
        <QuizModeChooser onChoose={setKind} />
      </Modal>
    );
  }

  return (
    <Modal title={TITLES[kind]} onClose={onClose} size="lg" tall>
      {isFetching && (!set || set.kind !== kind || kind === 'topic-quiz') ? (
        <StepProgress
          key={kind}
          className="px-5 py-6 sm:px-6"
          steps={LOADING_STEPS[kind]}
          slowAfterMs={45000}
          note={
            kind === 'topic-quiz'
              ? 'New questions take about 15 seconds.'
              : kind === 'quiz' || kind === 'note-quiz'
                ? 'The first time takes about 20–30 seconds. After that it opens instantly.'
                : 'The first time takes about 15 seconds. After that it opens instantly.'
          }
        >
          <StudySkeleton kind={kind} />
        </StepProgress>
      ) : error ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-gray-700">{getErrorMessage(error)}</p>
          <button type="button" onClick={() => refetch()} className="btn-secondary mt-4">
            Try again
          </button>
        </div>
      ) : set?.kind === 'note-quiz' && !set.items.length ? (
        <NoNoteQuestions onNewQuestions={() => setKind('quiz')} />
      ) : set?.kind === 'quiz' || set?.kind === 'note-quiz' || set?.kind === 'topic-quiz' ? (
        <>
          {set.mock && <DemoNotice />}
          {set.kind === 'topic-quiz' && <TopicNotice />}
          <Quiz
            key={`${set.kind}-${set.start ?? 0}`}
            noteId={noteId}
            kind={set.kind}
            questions={set.items}
            start={set.start ?? 0}
            onMore={
              set.kind === 'topic-quiz'
                ? () => refetch()
                : set.items.some((q) => q.topic)
                  ? () => setKind('topic-quiz')
                  : undefined
            }
            onSwitch={
              set.kind === 'note-quiz'
                ? { label: 'Try new questions in this note', go: () => setKind('quiz') }
                : set.kind === 'quiz'
                  ? { label: 'Questions from the note', go: () => setKind('note-quiz') }
                  : undefined
            }
          />
        </>
      ) : set?.kind === 'flashcards' ? (
        <>
          {set.mock && <DemoNotice />}
          <Flashcards noteId={noteId} cards={set.items} />
        </>
      ) : null}
    </Modal>
  );
}

// Yerel deneme modu: içerik notun satırlarından hazırlanmış örnektir.
function DemoNotice() {
  return (
    <p className="mx-5 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
      Demo mode: these are sample items made from the note’s lines, not real AI output.
    </p>
  );
}

// Konu pratiği soruları notta yazmayabilir: sayfa bağlantısı yoktur.
function TopicNotice() {
  return (
    <p className="mx-5 mt-3 rounded-lg bg-navy-50 px-3 py-2 text-xs text-navy-800">
      These questions go beyond the note. The AI wrote them on the note’s topics, so they don’t point to a page.
    </p>
  );
}

// Sorunun / kartın geldiği sayfa yeni sekmede açılır: quiz yarıda kalmaz.
function PageLink({ noteId, page }: { noteId: string; page: number | null }) {
  if (!page) return null;
  return (
    <a
      href={`/notes/${noteId}?page=${page}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold text-navy-600 hover:underline"
    >
      See page {page} <ExternalLink size={11} aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

const shuffle = <T,>(list: T[]) => {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// Her açılışta ve "Start over"da soruların sırası ve şıkların yerleri karışır (ezber olmasın).
// index / order asıl sıralardır: cevap kaydı ve doğruluk kontrolü bunlarla yapılır.
// Sorular ve şıklar karıştırılır. Notun kendi sorularında (note-quiz) sınavdaki gibi sıra ve şıklar aynen kalır.
const deal = (questions: QuizQuestion[], keepOrder = false) => {
  const deck = questions.map((q, index) => ({
    q,
    index,
    order: keepOrder ? q.options.map((_, i) => i) : shuffle(q.options.map((_, i) => i)),
  }));
  return keepOrder ? deck : shuffle(deck);
};

function Quiz({
  noteId,
  kind,
  questions,
  start,
  onMore,
  onSwitch,
}: {
  noteId: string;
  kind: QuizKind;
  questions: QuizQuestion[];
  // Konu pratiğinde turun ilk sorusunun sırası.
  start: number;
  // Quiz bitince: notun quiz'inden konu pratiğine geçiş ya da konu pratiğinde yeni tur.
  onMore?: () => void;
  // Quiz bitince diğer moda geçiş (notun soruları <-> yeni sorular).
  onSwitch?: { label: string; go: () => void };
}) {
  const [recordAnswer] = useRecordQuizAnswerMutation();
  const keepOrder = kind === 'note-quiz';
  const rootRef = useRef<HTMLDivElement>(null);
  const [deck, setDeck] = useState(() => deal(questions, keepOrder));
  const [index, setIndex] = useState(0);
  // Seçilen şıkkın asıl sırası.
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const finished = index >= deck.length;

  if (finished) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-4xl font-bold text-gray-900">
          {score}
          <span className="text-gray-400"> / {questions.length}</span>
        </p>
        <p className="mt-2 text-sm text-gray-600">
          {score === questions.length
            ? kind !== 'topic-quiz'
              ? 'All correct. You know this note.'
              : 'All correct. You know these topics.'
            : score >= questions.length * 0.7
              ? 'Good. Go over the ones you missed once more.'
              : kind !== 'topic-quiz'
                ? 'Read the note again and give it another try.'
                : 'Review these topics and give it another try.'}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDeck(deal(questions, keepOrder));
              setIndex(0);
              setPicked(null);
              setScore(0);
            }}
            className="btn-secondary"
          >
            <RotateCcw size={15} /> Start over
          </button>
          {questions.some((q) => q.topic) && (
            <Link to="/knowledge" className={onMore ? 'btn-secondary' : 'btn-primary'}>
              See your knowledge map
            </Link>
          )}
          {onSwitch && (
            <button type="button" onClick={onSwitch.go} className="btn-secondary">
              {onSwitch.label}
            </button>
          )}
          {onMore && (
            <button type="button" onClick={onMore} className="btn-primary">
              <Sparkles size={15} /> {kind === 'topic-quiz' ? 'New questions on these topics' : 'More questions on these topics'}
            </button>
          )}
        </div>
      </div>
    );
  }

  const { q, index: questionIndex, order } = deck[index];
  const answered = picked !== null;

  const choose = (i: number) => {
    if (answered) return;
    setPicked(i);
    if (i === q.answerIndex) setScore((s) => s + 1);
    // Bilgi haritası için kaydedilir (asıl soru ve şık sırasıyla); kayıt başarısız olsa da quiz devam eder.
    recordAnswer({ noteId, index: start + questionIndex, choice: i, ...(kind !== 'quiz' && { set: kind }) });
  };

  const next = () => {
    setIndex((i) => i + 1);
    setPicked(null);
    // Yeni soru pencerenin başından başlasın (uzun bir sorudan sonra aşağıda kalmasın).
    rootRef.current?.closest('.overflow-y-auto')?.scrollTo({ top: 0 });
  };

  return (
    <div
      ref={rootRef}
      // Cevaplandıktan sonra Enter sonraki soruya geçer.
      onKeyDown={(e) => {
        if (e.key === 'Enter' && answered && (e.target as HTMLElement).tagName !== 'BUTTON') next();
      }}
    >
    <div className="px-5 pt-3.5 pb-3">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Question {index + 1} of {deck.length}
        </span>
        <span>{score} correct</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full bg-navy-600 transition-all" style={{ width: `${(index / deck.length) * 100}%` }} />
      </div>

      {(q.topic || originLabel(q)) && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold uppercase tracking-wide">
          {q.topic && <span className="text-navy-600">{q.topic}</span>}
          {originLabel(q) && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 normal-case tracking-normal text-amber-700">{originLabel(q)}</span>
          )}
        </p>
      )}
      <p className={`${q.topic || originLabel(q) ? 'mt-1' : 'mt-3'} text-[15px] font-semibold leading-snug text-gray-900`}>{q.question}</p>
      <ul className="mt-2.5 space-y-1.5">
        {order.map((i, position) => {
          const option = q.options[i];
          const isAnswer = i === q.answerIndex;
          const isPicked = i === picked;
          const tone = !answered
            ? 'border-gray-200 hover:border-navy-300 hover:bg-navy-50/50'
            : isAnswer
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : isPicked
                ? 'border-rose-300 bg-rose-50 text-rose-900'
                : 'border-gray-200 text-gray-500';
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => choose(i)}
                aria-pressed={isPicked}
                className={`flex w-full items-start gap-2.5 rounded-lg border px-3.5 py-2 text-left text-sm transition-colors ${tone}`}
              >
                <span className="mt-px w-4 shrink-0 font-bold">{String.fromCharCode(65 + position)}</span>
                <span className="flex-1">{option}</span>
                {answered && isAnswer && <Check size={16} className="shrink-0 text-emerald-600" />}
                {answered && isPicked && !isAnswer && <X size={16} className="shrink-0 text-rose-600" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>

      {/* Açıklama ve "Next" pencerenin altına sabit: soru uzun olsa da kaydırmadan görünür. */}
      <div className="sticky bottom-0 border-t border-gray-100 bg-white px-5 py-3">
        {answered ? (
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1" aria-live="polite">
              <p className={`text-sm font-semibold ${picked === q.answerIndex ? 'text-emerald-700' : 'text-rose-700'}`}>
                {picked === q.answerIndex ? 'Correct' : 'Not quite'}
              </p>
              <p className="mt-0.5 max-h-28 overflow-y-auto text-sm leading-snug text-gray-700">{q.explanation}</p>
              <PageLink noteId={noteId} page={q.page} />
            </div>
            <button type="button" onClick={next} className="btn-primary shrink-0">
              {index + 1 === questions.length ? 'See score' : 'Next'}
            </button>
          </div>
        ) : (
          <p className="py-1.5 text-center text-xs text-gray-400">Choose an answer</p>
        )}
      </div>
    </div>
  );
}

function Flashcards({ noteId, cards }: { noteId: string; cards: Flashcard[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[index];

  const go = (delta: number) => {
    setIndex((i) => (i + delta + cards.length) % cards.length);
    setFlipped(false);
  };

  return (
    <div className="px-5 py-4">
      <p className="text-center text-xs text-gray-500">
        Card {index + 1} of {cards.length}
      </p>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? 'Show question' : 'Show answer'}
        className={`mt-3 flex min-h-[200px] w-full flex-col items-center justify-center rounded-xl border px-6 py-8 text-center transition-colors ${
          flipped ? 'border-navy-200 bg-navy-50' : 'border-gray-200 bg-white hover:bg-gray-50'
        }`}
      >
        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{flipped ? 'Answer' : 'Question'}</span>
        <span className={`mt-2 ${flipped ? 'text-[15px] text-gray-800' : 'text-lg font-semibold text-gray-900'}`}>
          {flipped ? card.back : card.front}
        </span>
        {!flipped && <span className="mt-4 text-xs text-gray-400">Tap to see the answer</span>}
      </button>
      <div className="mt-2 h-5 text-center">{flipped && <PageLink noteId={noteId} page={card.page} />}</div>
      <div className="mt-2 flex items-center justify-between">
        <button type="button" onClick={() => go(-1)} className="btn-secondary" aria-label="Previous card">
          <ChevronLeft size={16} /> Previous
        </button>
        <button type="button" onClick={() => go(1)} className="btn-primary" aria-label="Next card">
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
