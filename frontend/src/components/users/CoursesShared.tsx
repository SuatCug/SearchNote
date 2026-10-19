import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { useGetUserCoursesQuery } from '@/services/usersApi';

const PREVIEW = 8;

// Profildeki "Courses shared": kişinin not paylaştığı dersler ve not sayıları (izleyicinin görebildiği notlardan).
// Derse tıklayınca kişinin not sayfası o dersle aranmış olarak açılır.
export default function CoursesShared({ userId }: { userId: string }) {
  const { data } = useGetUserCoursesQuery(userId);
  const courses = data?.data?.courses ?? [];
  if (!courses.length) return null;

  const visible = courses.slice(0, PREVIEW);
  const more = courses.length - visible.length;

  return (
    <div className="mt-5">
      <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
        <BookOpen size={13} /> Courses shared
      </h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {visible.map((c) => (
          <li key={c.code}>
            <Link
              to={`/users/${userId}/notes?q=${encodeURIComponent(c.code)}`}
              title={c.name && c.name !== c.code ? c.name : undefined}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:border-navy-200 hover:bg-navy-50 hover:text-navy-700"
            >
              {c.code}
              <span className="text-xs font-normal text-gray-400">{c.count}</span>
            </Link>
          </li>
        ))}
        {more > 0 && (
          <li>
            <Link to={`/users/${userId}/notes`} className="inline-flex px-2 py-1 text-sm font-semibold text-navy-600 hover:text-navy-700">
              +{more} more
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}
