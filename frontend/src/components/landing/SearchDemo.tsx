import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Search, X } from 'lucide-react';

// Karşılama sayfasındaki "aramayı dene" bölümü. Ziyaretçi gerçek kataloğu göremediği için
// sabit örnek notlar üzerinde, uygulamadaki gibi kelime bazlı arama yapılır.

type FileType = 'PDF' | 'DOCX' | 'JPG' | 'ZIP';

const SAMPLE_NOTES: {
  code: string;
  course: string;
  title: string;
  instructor: string;
  university: string;
  semester: string;
  type: FileType;
  likes: number;
}[] = [
  { code: 'MAT101', course: 'Calculus I', title: 'Limits & derivatives cheat sheet', instructor: 'Dr. Ayşe Kaya', university: 'ODTÜ', semester: 'Fall 2025', type: 'PDF', likes: 128 },
  { code: 'CENG213', course: 'Data Structures', title: 'Trees, heaps and hashing summary', instructor: 'Prof. Mehmet Demir', university: 'ODTÜ', semester: 'Fall 2025', type: 'PDF', likes: 96 },
  { code: 'MED105', course: 'Anatomy', title: 'Upper limb diagrams', instructor: 'Prof. Selin Koç', university: 'Hacettepe', semester: 'Spring 2025', type: 'JPG', likes: 87 },
  { code: 'FIZ102', course: 'Physics II', title: 'Electromagnetism solved problems', instructor: 'Dr. Can Öztürk', university: 'İTÜ', semester: 'Spring 2025', type: 'JPG', likes: 74 },
  { code: 'MATH201', course: 'Linear Algebra', title: 'Midterm prep: eigenvalues & eigenvectors', instructor: 'Dr. Zeynep Arslan', university: 'Boğaziçi', semester: 'Fall 2025', type: 'DOCX', likes: 61 },
  { code: 'STAT201', course: 'Statistics', title: 'Hypothesis testing, weeks 6–9', instructor: 'Dr. Burak Aydın', university: 'Ege', semester: 'Fall 2025', type: 'PDF', likes: 52 },
  { code: 'ECON101', course: 'Microeconomics', title: 'Consumer theory lecture notes', instructor: 'Prof. Ali Yıldız', university: 'Bilkent', semester: 'Fall 2025', type: 'DOCX', likes: 43 },
  { code: 'CHEM201', course: 'Organic Chemistry', title: 'Reaction mechanisms flashcards', instructor: 'Dr. Elif Şahin', university: 'Hacettepe', semester: 'Spring 2025', type: 'ZIP', likes: 38 },
];

const FILE_TYPES: FileType[] = ['PDF', 'DOCX', 'JPG', 'ZIP'];
const EXAMPLES = ['calculus', 'ODTÜ', 'Demir', 'MATH201'];

const TYPE_STYLES: Record<FileType, string> = {
  PDF: 'bg-navy-900 text-white',
  DOCX: 'bg-[#c9d6ea] text-navy-900',
  JPG: 'bg-[#f2c14e] text-navy-900',
  ZIP: 'bg-[#e6e3dc] text-[#3d434a]',
};

// Bölüm çok uzamasın diye en fazla bu kadar sonuç listelenir.
const MAX_SHOWN = 4;

const normalize = (text: string) => text.toLocaleLowerCase('tr');

export default function SearchDemo() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<FileType | null>(null);

  // Uygulamadaki arama gibi: her kelime notun herhangi bir alanında geçmeli.
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const results = SAMPLE_NOTES.filter((note) => {
    if (type && note.type !== type) return false;
    const haystack = normalize(`${note.code} ${note.course} ${note.title} ${note.instructor} ${note.university} ${note.semester}`);
    return words.every((w) => haystack.includes(w));
  });

  const shown = results.slice(0, MAX_SHOWN);

  const chip = (active: boolean) =>
    `inline-flex min-h-9 items-center rounded-full px-4 text-[15px] font-semibold transition-colors ${
      active ? 'bg-navy-900 text-white' : 'border border-[#8c9199] text-[#3d434a] hover:border-navy-900 hover:text-navy-900'
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#5e6670]" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Course, course code, instructor or university"
          aria-label="Search sample notes"
          className="h-14 w-full rounded-full border border-[#8c9199] bg-white pl-12 pr-12 text-[17px] outline-none focus:border-navy-900 focus:ring-1 focus:ring-navy-900 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[#5e6670] hover:bg-black/5"
            aria-label="Clear search"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-[#5e6670]">Try</span>
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" onClick={() => setQuery(ex)} className="text-[15px] font-semibold text-navy-900 underline-offset-2 hover:underline">
            “{ex}”
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="File type">
        <button type="button" onClick={() => setType(null)} aria-pressed={type === null} className={chip(type === null)}>
          All files
        </button>
        {FILE_TYPES.map((t) => (
          <button key={t} type="button" onClick={() => setType(type === t ? null : t)} aria-pressed={type === t} className={chip(type === t)}>
            {t}
          </button>
        ))}
      </div>

      <p className="m-0 text-sm text-[#5e6670]" aria-live="polite">
        {results.length > MAX_SHOWN
          ? `Showing ${MAX_SHOWN} of ${results.length} matching sample notes`
          : `${results.length} of ${SAMPLE_NOTES.length} sample notes`}
      </p>

      <ul className="m-0 p-0 list-none flex flex-col gap-2">
        {shown.map((note) => (
          <li key={note.code}>
            <Link
              to="/register"
              className="flex items-center gap-4 rounded-lg bg-white p-3 sm:p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-[0_0_0_1px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.08)]"
            >
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tracking-[0.06em] ${TYPE_STYLES[note.type]}`}>
                {note.type}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[17px] font-semibold">{note.title}</span>
                <span className="truncate text-sm text-[#3d434a]">
                  <span className="font-semibold">{note.code}</span> · {note.course} · {note.instructor}
                </span>
                <span className="truncate text-sm text-[#5e6670]">
                  {note.university} · {note.semester}
                </span>
              </span>
              <span className="hidden sm:flex shrink-0 items-center gap-1 text-sm text-[#5e6670]">
                <Heart size={15} aria-hidden="true" />
                {note.likes}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {results.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#c4c0b6] p-6 text-center">
          <p className="m-0 text-[17px] font-semibold">Nothing in the samples for that</p>
          <p className="mt-1 mb-0 text-[#5e6670]">The real catalog is much bigger — sign up and search it.</p>
        </div>
      )}
    </div>
  );
}
