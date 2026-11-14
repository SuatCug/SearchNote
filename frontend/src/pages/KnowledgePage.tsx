import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, Sparkles } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Spinner from '@/components/common/Spinner';
import Alert from '@/components/common/Alert';
import KnowledgeTreeIllustration from '@/components/ai/KnowledgeTreeIllustration';
import { useGetKnowledgeMapQuery } from '@/services/aiApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import type { KnowledgeMap, KnowledgeNode, TopicStatus } from '@/types/api';

// Kişisel bilgi haritası, ders bazında: quiz cevapları konunun geldiği derse göre toplanır (konu adları tek
// başına anlaşılmıyordu). Her derste doğru oranı, durum ve takılınan konular ("Weak spots") görünür.
// Sunucu konu bazında gönderir (nodes[].courses); gruplama burada yapılır. Hiç çalışılmamış ön koşul konular
// (dersi olmayanlar) bu görünümde yer almaz.

type CourseStatus = Exclude<TopicStatus, 'untested'>;

const STATUS: Record<TopicStatus, { label: string; fill: string; stroke: string; text: string; pill: string }> = {
  strong: { label: 'Strong', fill: '#ecfdf5', stroke: '#34d399', text: '#065f46', pill: 'bg-emerald-50 text-emerald-700' },
  learning: { label: 'Getting there', fill: '#fffbeb', stroke: '#fbbf24', text: '#92400e', pill: 'bg-amber-50 text-amber-700' },
  weak: { label: 'Struggling', fill: '#fff1f2', stroke: '#fb7185', text: '#9f1239', pill: 'bg-rose-50 text-rose-700' },
  untested: { label: 'Not practiced', fill: '#ffffff', stroke: '#cbd5e1', text: '#475569', pill: 'bg-gray-100 text-gray-600' },
};
const COURSE_STATUSES: CourseStatus[] = ['strong', 'learning', 'weak'];

const DESCRIPTION =
  'Built from your practice quiz answers. It shows how you’re doing in each course and which parts of it you’re missing.';

const OTHER_COURSE = 'Other notes';

interface CourseItem {
  key: string;
  name: string;
  // "CENG213" gibi ders kodu (Practice aramasında kullanılır); yoksa ders adı.
  query: string;
  correct: number;
  total: number;
  status: CourseStatus;
  // Dersin konuları, en zayıftan başlayarak.
  topics: KnowledgeNode[];
}

// Sunucudaki konu durum kuralıyla aynı: %50 altı zorlanıyor, en az 2 cevapta %75 ve üstü güçlü.
const statusOf = (correct: number, total: number): CourseStatus => {
  const ratio = correct / total;
  if (ratio < 0.5) return 'weak';
  if (ratio >= 0.75 && total >= 2) return 'strong';
  return 'learning';
};

const ratioOf = (n: { correct: number; total: number }) => (n.total ? n.correct / n.total : 1);

// Konuları derslere toplar (bir konu birden fazla derste geçtiyse her birine sayılır).
const groupByCourse = (nodes: KnowledgeNode[]): CourseItem[] => {
  const byCourse = new Map<string, KnowledgeNode[]>();
  for (const node of nodes) {
    if (!node.total) continue;
    for (const course of node.courses.length ? node.courses : [OTHER_COURSE]) {
      byCourse.set(course, [...(byCourse.get(course) ?? []), node]);
    }
  }
  return [...byCourse.entries()].map(([name, topics]) => {
    const correct = topics.reduce((sum, t) => sum + t.correct, 0);
    const total = topics.reduce((sum, t) => sum + t.total, 0);
    return {
      key: name,
      name,
      query: name === OTHER_COURSE ? '' : name.split(' – ')[0],
      correct,
      total,
      status: statusOf(correct, total),
      topics: [...topics].sort((a, b) => ratioOf(a) - ratioOf(b) || b.total - a.total),
    };
  });
};

// Takılınan konular: güçlü olmayanlar, en zayıftan başlayarak.
const weakSpots = (course: CourseItem) => course.topics.filter((t) => t.status === 'weak' || t.status === 'learning');

export default function KnowledgePage() {
  const { data, isLoading, error } = useGetKnowledgeMapQuery(undefined, { refetchOnMountOrArgChange: true });
  const map = data?.data;
  const courses = useMemo(() => (map ? groupByCourse(map.nodes) : []), [map]);

  const empty = !isLoading && !error && !courses.length;
  const hasMap = courses.length > 0;
  // Ağacın yaprakları dersler (en çok çalışılandan başlayarak, en fazla 12).
  const leaves = useMemo(
    () =>
      courses.length
        ? [...courses]
            .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'tr'))
            .slice(0, TREE_LEAVES)
            .map((c) => c.status)
        : undefined,
    [courses]
  );

  // Sayfanın solunda büyük ağaç (geniş ekranda kaydırırken sabit), sağda başlık ve harita.
  return (
    <PageLayout>
      <div className={`grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 ${empty ? 'items-center sm:py-6 lg:py-8' : ''}`}>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <KnowledgeTreeIllustration
            leaves={leaves}
            className="mx-auto h-auto w-full max-w-[280px] sm:max-w-[380px] lg:max-w-none"
          />
          {hasMap && map && <TreeSummary courses={courses} map={map} />}
        </aside>

        <div className="min-w-0">
          <h1 className={`font-bold text-gray-900 ${empty ? 'text-2xl sm:text-3xl lg:text-4xl' : 'text-2xl sm:text-3xl'}`}>
            My knowledge map
          </h1>
          <p className={`mt-2 text-gray-600 ${empty ? 'text-sm sm:text-base lg:text-lg' : 'text-sm sm:text-base'}`}>
            {DESCRIPTION}
          </p>

          {empty ? (
            <>
              <p className="mt-6 text-sm text-gray-700 sm:text-base">
                Your map is empty for now. Take a quiz on any note and every answer you give fills in a course on the tree.
              </p>
              <Link to="/practice" className="btn-primary mt-5">
                Take a quiz
              </Link>
            </>
          ) : (
            <div className="mt-6">
              {isLoading ? <Spinner /> : error ? <Alert>{getErrorMessage(error)}</Alert> : <MapView courses={courses} />}
            </div>
          )}

          <p className="mt-6 flex items-start gap-2 text-xs text-gray-500">
            <Sparkles size={14} className="mt-px shrink-0 text-navy-400" />
            Quiz questions are written by AI from the note’s pages. Only you can see your map.
          </p>
        </div>
      </div>
    </PageLayout>
  );
}

const TREE_LEAVES = 12;

// Ağacın altında: ders sayıları durumlara göre.
function TreeSummary({ courses, map }: { courses: CourseItem[]; map: KnowledgeMap }) {
  const counts = COURSE_STATUSES.map((s) => ({ status: s, count: courses.filter((c) => c.status === s).length })).filter(
    (c) => c.count > 0
  );
  return (
    <div className="mx-auto mt-2 max-w-[380px] text-center lg:max-w-none">
      <p className="text-sm font-semibold text-gray-900">
        {courses.length} {courses.length === 1 ? 'course' : 'courses'} · {map.totals.answered} answers
      </p>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-600">
        {counts.map(({ status, count }) => (
          <li key={status} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS[status].stroke }} />
            {count} {STATUS[status].label.toLowerCase()}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Odak: zorlanılan dersler ve henüz oturmamış olanlar (%75 altı); oranı en düşük önce, en fazla 4.
const MAX_FOCUS = 4;

function MapView({ courses }: { courses: CourseItem[] }) {
  const focus = useMemo(
    () =>
      courses
        .filter((c) => c.status === 'weak' || (c.status === 'learning' && ratioOf(c) < 0.75))
        .sort((a, b) => ratioOf(a) - ratioOf(b) || b.total - a.total)
        .slice(0, MAX_FOCUS),
    [courses]
  );
  // İlk açılışta hiçbir kart seçili değil; detay ancak bir karta tıklanınca açılır.
  const [selected, setSelected] = useState<string | null>(null);
  const selectedCourse = selected ? courses.find((c) => c.key === selected) : undefined;

  return (
    <div className="space-y-6">
      {focus.length > 0 && (
        <section aria-labelledby="focus-title">
          <h2 id="focus-title" className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
            Where to focus
          </h2>
          <div className="grid gap-3 xl:grid-cols-2">
            {focus.map((c) => (
              <FocusCard key={c.key} course={c} onShow={() => setSelected(c.key)} />
            ))}
          </div>
        </section>
      )}

      <section className="card p-4 sm:p-5" aria-labelledby="graph-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="graph-title" className="text-lg font-semibold text-gray-900">
            Courses to work on
          </h2>
          <Legend />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Courses you haven’t mastered yet and the parts you’re missing. Tap a card for details.
        </p>
        <CourseCards courses={courses} selected={selected} onSelect={setSelected} />
        {selectedCourse && <CourseDetails course={selectedCourse} />}
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: TopicStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS[status].pill}`}>{STATUS[status].label}</span>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
      {COURSE_STATUSES.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border" style={{ background: STATUS[s].fill, borderColor: STATUS[s].stroke }} />
          {STATUS[s].label}
        </li>
      ))}
    </ul>
  );
}

function FocusCard({ course, onShow }: { course: CourseItem; onShow: () => void }) {
  const spots = weakSpots(course).slice(0, 3);
  const lead = course.status === 'weak' ? 'You’re struggling in this course' : 'You’re getting there in this course';
  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onShow}
          title={course.name}
          className="line-clamp-2 min-w-0 break-words text-left font-semibold leading-snug text-gray-900 hover:text-navy-700"
        >
          {course.name}
        </button>
        <span className="shrink-0">
          <StatusPill status={course.status} />
        </span>
      </div>
      <p className="mt-1.5 text-sm text-gray-700">
        {lead} ({course.correct}/{course.total} correct).
        {spots.length > 0 && <> Review {spots.map((t) => t.name).join(', ')} first.</>}
      </p>
      {course.query && (
        <Link
          to={`/practice?q=${encodeURIComponent(course.query)}`}
          className="btn-primary mt-3 px-3.5 py-1.5 text-sm"
        >
          <ListChecks size={15} /> Practise this course
        </Link>
      )}
    </article>
  );
}

// ---------- Dersler (kartlar) ----------

// Kartta gösterilen en fazla zayıf konu sayısı; tamamı kart tıklanınca açılan detayda.
const MAX_CARD_SPOTS = 3;

// Önce zorlanılan, sonra oturmamış dersler; güçlü dersler en altta tek satır.
const COURSE_ORDER: Record<CourseStatus, number> = { weak: 0, learning: 1, strong: 2 };

const STATUS_TEXT: Record<TopicStatus, string> = {
  strong: 'text-emerald-700',
  learning: 'text-amber-700',
  weak: 'text-rose-700',
  untested: 'text-gray-500',
};

function StatusDot({ status }: { status: TopicStatus }) {
  const s = STATUS[status];
  return (
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-full border"
      style={{ background: status === 'untested' ? 'transparent' : s.stroke, borderColor: s.stroke }}
      aria-hidden
    />
  );
}

function CourseCards({
  courses,
  selected,
  onSelect,
}: {
  courses: CourseItem[];
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  const { gaps, strong } = useMemo(() => {
    const byName = (a: CourseItem, b: CourseItem) => a.name.localeCompare(b.name, 'tr');
    return {
      gaps: courses
        .filter((c) => c.status !== 'strong')
        .sort((a, b) => COURSE_ORDER[a.status] - COURSE_ORDER[b.status] || ratioOf(a) - ratioOf(b) || byName(a, b)),
      strong: courses.filter((c) => c.status === 'strong').sort(byName),
    };
  }, [courses]);

  return (
    <>
      {gaps.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {gaps.map((c) => {
            const isSelected = c.key === selected;
            const spots = weakSpots(c);
            const shown = spots.slice(0, MAX_CARD_SPOTS);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => onSelect(c.key)}
                aria-pressed={isSelected}
                className={`rounded-lg border bg-white p-3.5 text-left transition-colors ${
                  isSelected ? 'border-navy-700 ring-1 ring-navy-700' : 'border-gray-200 hover:border-navy-300'
                }`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 min-w-0 break-words font-semibold leading-snug text-gray-900" title={c.name}>
                    {c.name}
                  </span>
                  <span className={`shrink-0 text-xs font-semibold ${STATUS_TEXT[c.status]}`}>
                    {c.correct}/{c.total} correct
                  </span>
                </span>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${Math.max(ratioOf(c) * 100, 4)}%`, background: STATUS[c.status].stroke }}
                  />
                </span>
                <span className="mt-2.5 block text-xs text-gray-600">
                  {spots.length ? (
                    <>
                      <span className="font-semibold text-gray-700">Weak spots: </span>
                      {shown.map((t, i) => (
                        <span key={t.key} className="inline-flex items-center gap-1">
                          {i > 0 && ', '}
                          <StatusDot status={t.status} />
                          {t.name}
                        </span>
                      ))}
                      {spots.length > shown.length && (
                        <span className="font-semibold text-navy-600"> +{spots.length - shown.length} more</span>
                      )}
                    </>
                  ) : (
                    <>No single weak spot. Take another quiz on this course.</>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-700">No gaps right now. You’re strong in every course you practiced.</p>
      )}

      {strong.length > 0 && (
        <p className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-gray-600">
          <span className="font-semibold text-gray-800">You’re strong in:</span>
          {strong.map((c, i) => (
            <button key={c.key} type="button" onClick={() => onSelect(c.key)} className="text-emerald-700 hover:underline">
              {c.name}
              {i < strong.length - 1 && ','}
            </button>
          ))}
        </p>
      )}
    </>
  );
}

// Seçili ders: konuları tek tek (durum ve skor) ve o dersin notlarına geçiş.
function CourseDetails({ course }: { course: CourseItem }) {
  return (
    <div className="mt-4 rounded-lg border border-gray-100 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-gray-900">{course.name}</h3>
        <StatusPill status={course.status} />
        <span className="text-xs text-gray-500">
          {course.correct} of {course.total} answers correct
        </span>
      </div>
      <p className="mt-3 text-xs font-semibold text-gray-500">Parts of this course you practiced:</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {course.topics.map((t) => (
          <li
            key={t.key}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-700"
          >
            <StatusDot status={t.status} />
            {t.name}
            <span className={STATUS_TEXT[t.status]}>
              {t.correct}/{t.total}
            </span>
          </li>
        ))}
      </ul>
      {course.query && (
        <Link
          to={`/practice?q=${encodeURIComponent(course.query)}`}
          className="btn-primary mt-3 px-3.5 py-1.5 text-sm"
        >
          <ListChecks size={15} /> Practise {course.query}
        </Link>
      )}
    </div>
  );
}
