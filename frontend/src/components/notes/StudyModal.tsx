import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import Modal from '@/components/common/Modal';
import { useGetStudySetQuery, useRecordQuizAnswerMutation } from '@/services/aiApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import type { Flashcard, QuizQuestion, StudyKind } from '@/types/api';

interface StudyModalProps {
  noteId: string;
  kind: StudyKind;
  onClose: () => void;
  // Sorunun geldiği sayfayı önizlemede açar.
  onOpenPage: (page: number) => void;
}

const TITLES: Record<StudyKind, string> = {
  quiz: 'Practice quiz',
  'topic-quiz': 'Topic practice',
  flashcards: 'Flashcards',
};

const LOADING: Record<StudyKind, string> = {
  quiz: 'Writing questions from this note…',
  'topic-quiz': 'Writing new questions on this note’s topics…',
  flashcards: 'Making flashcards from this note…',
};

// Nottan üretilen quiz ya da flashcard'lar. İlk açılışta set üretilir (birkaç saniye sürer), sonra kayıtlıdır.
// Notun quiz'i bitince aynı pencerede "konu pratiği"ne geçilebilir (notla sınırlı olmayan yeni sorular).
export default function StudyModal({ noteId, kind: initialKind, onClose, onOpenPage }: StudyModalProps) {
  const [kind, setKind] = useState<StudyKind>(initialKind);
  // Konu pratiği her açılışta sunucuya sorulur: bitirilen turun yerine sıradaki (ya da yeni) tur gelir.
  const { data, error, isFetching, refetch } = useGetStudySetQuery(
    { noteId, kind },
    { refetchOnMountOrArgChange: kind === 'topic-quiz' }
  );
  const set = data?.data.set;

  const openPage = (page: number) => {
    onClose();
    onOpenPage(page);
  };

  return (
    <Modal title={TITLES[kind]} onClose={onClose} size="lg">
      {isFetching && (!set || set.kind !== kind || kind === 'topic-quiz') ? (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Loader2 size={22} className="animate-spin text-navy-600" />
          <p className="text-sm text-gray-600">{LOADING[kind]}</p>
          <p className="text-xs text-gray-400">
            {kind === 'topic-quiz'
              ? 'New questions take about 15 seconds.'
              : 'The first time takes about 15 seconds. After that it opens instantly.'}
          </p>
        </div>
      ) : error ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-gray-700">{getErrorMessage(error)}</p>
          <button type="button" onClick={() => refetch()} className="btn-secondary mt-4">
            Try again
          </button>
        </div>
      ) : set?.kind === 'quiz' || set?.kind === 'topic-quiz' ? (
        <>
          {set.mock && <DemoNotice />}
          {set.kind === 'topic-quiz' && <TopicNotice />}
          <Quiz
            key={`${set.kind}-${set.start ?? 0}`}
            noteId={noteId}
            kind={set.kind}
            questions={set.items}
            start={set.start ?? 0}
            onOpenPage={openPage}
            onMore={
              set.kind === 'topic-quiz'
                ? () => refetch()
                : set.items.some((q) => q.topic)
                  ? () => setKind('topic-quiz')
                  : undefined
            }
          />
        </>
      ) : set?.kind === 'flashcards' ? (
        <>
          {set.mock && <DemoNotice />}
          <Flashcards cards={set.items} onOpenPage={openPage} />
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

function PageLink({ page, onOpenPage }: { page: number | null; onOpenPage: (page: number) => void }) {
  if (!page) return null;
  return (
    <button type="button" onClick={() => onOpenPage(page)} className="text-xs font-semibold text-navy-600 hover:underline">
      See page {page}
    </button>
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
const deal = (questions: QuizQuestion[]) =>
  shuffle(questions.map((q, index) => ({ q, index, order: shuffle(q.options.map((_, i) => i)) })));

function Quiz({
  noteId,
  kind,
  questions,
  start,
  onOpenPage,
  onMore,
}: {
  noteId: string;
  kind: 'quiz' | 'topic-quiz';
  questions: QuizQuestion[];
  // Konu pratiğinde turun ilk sorusunun sırası.
  start: number;
  onOpenPage: (page: number) => void;
  // Quiz bitince: notun quiz'inden konu pratiğine geçiş ya da konu pratiğinde yeni tur.
  onMore?: () => void;
}) {
  const [recordAnswer] = useRecordQuizAnswerMutation();
  const [deck, setDeck] = useState(() => deal(questions));
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
            ? kind === 'quiz'
              ? 'All correct. You know this note.'
              : 'All correct. You know these topics.'
            : score >= questions.length * 0.7
              ? 'Good. Go over the ones you missed once more.'
              : kind === 'quiz'
                ? 'Read the note again and give it another try.'
                : 'Review these topics and give it another try.'}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDeck(deal(questions));
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
          {onMore && (
            <button type="button" onClick={onMore} className="btn-primary">
              <Sparkles size={15} /> {kind === 'quiz' ? 'More questions on these topics' : 'New questions on these topics'}
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
    recordAnswer({ noteId, index: start + questionIndex, choice: i, ...(kind === 'topic-quiz' && { set: kind }) });
  };

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Question {index + 1} of {deck.length}
        </span>
        <span>{score} correct</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full bg-navy-600 transition-all" style={{ width: `${(index / deck.length) * 100}%` }} />
      </div>

      {q.topic && (
        <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-navy-600">{q.topic}</p>
      )}
      <p className={`${q.topic ? 'mt-1' : 'mt-4'} text-[15px] font-semibold leading-snug text-gray-900`}>{q.question}</p>
      <ul className="mt-3 space-y-2">
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
                className={`flex w-full items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors ${tone}`}
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

      {answered && (
        <div className="mt-4 rounded-lg bg-gray-50 px-3.5 py-3">
          <p className="text-sm text-gray-700">{q.explanation}</p>
          <div className="mt-1.5">
            <PageLink page={q.page} onOpenPage={onOpenPage} />
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setIndex((i) => i + 1);
            setPicked(null);
          }}
          className={`btn-primary ${answered ? '' : 'invisible'}`}
        >
          {index + 1 === questions.length ? 'See score' : 'Next question'}
        </button>
      </div>
    </div>
  );
}

function Flashcards({ cards, onOpenPage }: { cards: Flashcard[]; onOpenPage: (page: number) => void }) {
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
      <div className="mt-2 h-5 text-center">{flipped && <PageLink page={card.page} onOpenPage={onOpenPage} />}</div>
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
