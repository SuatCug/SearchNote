import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { toInternalPath, URL_PATTERN } from '@/lib/links';

// Mesaj metnindeki bağlantılar (http/https ve www.) tıklanabilir olur.
// inert: basılı tutma menüsündeki kopya balonda bağlantılar tıklanmasın.
export default function LinkifiedText({ text, inert = false }: { text: string; inert?: boolean }) {
  const parts = text.split(URL_PATTERN);
  if (inert || parts.length === 1) return <>{text}</>;

  const linkClass = 'underline underline-offset-2 break-all hover:opacity-80';
  return (
    <>
      {parts.map((part, i) => {
        // split'te yakalama grubu kullanıldığı için tek indeksler bağlantıdır.
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const href = part.startsWith('www.') ? `https://${part}` : part;
        const internal = toInternalPath(href);
        return internal ? (
          <Link key={i} to={internal} onClick={(e) => e.stopPropagation()} className={linkClass}>
            {part}
          </Link>
        ) : (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={linkClass}
          >
            {part}
          </a>
        );
      })}
    </>
  );
}
