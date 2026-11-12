// "Practice" sayfasının görseli: solda üst üste flashcard'lar, sağda doğru şıkkı işaretlenmiş bir quiz kartı,
// skor rozeti ve kalem. Renk ve gölge dili "Search inside notes" ve "Knowledge map" görselleriyle aynı.
export default function PracticeIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 400"
      className={className}
      role="img"
      aria-label="A stack of flashcards next to a quiz card with the correct answer checked"
    >
      <defs>
        <filter id="pi-shadow" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#1e3050" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Zemin gölgesi */}
      <ellipse cx="240" cy="364" rx="196" ry="10" fill="#c9d6ea" />

      {/* Flashcard destesi */}
      <rect x="44" y="118" width="210" height="148" rx="16" fill="#c9d6ea" transform="rotate(-12 149 192)" />
      <rect x="48" y="128" width="210" height="148" rx="16" fill="#ffffff" stroke="#c9d6ea" strokeWidth="2" transform="rotate(-5 153 202)" />
      <g transform="rotate(3 160 222)">
        <rect x="54" y="148" width="212" height="150" rx="16" fill="#ffffff" stroke="#c9d6ea" strokeWidth="2" filter="url(#pi-shadow)" />
        <rect x="74" y="168" width="48" height="8" rx="4" fill="#7c93b8" />
        <text x="160" y="248" textAnchor="middle" fontSize="64" fontWeight="800" fill="#2f4a78" fontFamily="system-ui, sans-serif">
          ?
        </text>
        <rect x="112" y="268" width="96" height="7" rx="3.5" fill="#e0e8f4" />
        {/* Kartı çevir oku */}
        <path d="M236 270a14 14 0 1 1-4-14" stroke="#97b0d7" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M232 249l1 8-8 0" stroke="#97b0d7" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Quiz kartı */}
      <g filter="url(#pi-shadow)">
        <rect x="244" y="64" width="196" height="268" rx="18" fill="#ffffff" stroke="#c9d6ea" strokeWidth="2" />
      </g>
      <rect x="264" y="86" width="40" height="8" rx="4" fill="#7c93b8" />
      <rect x="264" y="104" width="150" height="10" rx="5" fill="#2f4a78" />
      <rect x="264" y="122" width="112" height="10" rx="5" fill="#2f4a78" />

      {/* Şıklar: ikincisi doğru */}
      <rect x="264" y="148" width="156" height="34" rx="10" fill="#ffffff" stroke="#e0e8f4" strokeWidth="2" />
      <circle cx="282" cy="165" r="7" fill="none" stroke="#c9d6ea" strokeWidth="2.5" />
      <rect x="298" y="161" width="90" height="8" rx="4" fill="#e0e8f4" />

      <rect x="264" y="192" width="156" height="34" rx="10" fill="#ecfdf5" stroke="#34d399" strokeWidth="2.5" />
      <circle cx="282" cy="209" r="9" fill="#34d399" />
      <path d="M277.5 209l3 3 6-6.5" stroke="#ffffff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="298" y="205" width="104" height="8" rx="4" fill="#6ee7b7" />

      <rect x="264" y="236" width="156" height="34" rx="10" fill="#ffffff" stroke="#e0e8f4" strokeWidth="2" />
      <circle cx="282" cy="253" r="7" fill="none" stroke="#c9d6ea" strokeWidth="2.5" />
      <rect x="298" y="249" width="76" height="8" rx="4" fill="#e0e8f4" />

      {/* İlerleme çubuğu */}
      <rect x="264" y="294" width="156" height="8" rx="4" fill="#e0e8f4" />
      <rect x="264" y="294" width="104" height="8" rx="4" fill="#34d399" />

      {/* Skor rozeti */}
      <g transform="translate(392 40)" filter="url(#pi-shadow)">
        <rect width="72" height="36" rx="18" fill="#ffffff" stroke="#c9d6ea" strokeWidth="2" />
        <circle cx="19" cy="18" r="9" fill="#ecfdf5" stroke="#34d399" strokeWidth="2.5" />
        <path d="M15 18l2.6 2.6 5-5.4" stroke="#34d399" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="34" y="12" width="26" height="6" rx="3" fill="#2f4a78" />
        <rect x="34" y="22" width="18" height="5" rx="2.5" fill="#c9d6ea" />
      </g>

      {/* Kalem */}
      <g transform="rotate(-38 196 334)">
        <rect x="136" y="326" width="104" height="16" rx="4" fill="#f2c14e" />
        <rect x="136" y="326" width="104" height="5" rx="2" fill="#d9a521" opacity="0.5" />
        <rect x="128" y="326" width="12" height="16" rx="3" fill="#fb7185" />
        <rect x="138" y="326" width="6" height="16" fill="#c9d6ea" />
        <path d="M240 326L258 334L240 342Z" fill="#ecd7b3" />
        <path d="M252 331.3L258 334L252 336.7Z" fill="#1e3050" />
      </g>

      {/* Yapay zekâ parıltıları */}
      <path d="M60 40c1.6 9.6 4.8 12.8 14.4 14.4c-9.6 1.6-12.8 4.8-14.4 14.4c-1.6-9.6-4.8-12.8-14.4-14.4c9.6-1.6 12.8-4.8 14.4-14.4Z" fill="#f2c14e" />
      <path d="M210 52c1.2 7 3.5 9.3 10.5 10.5c-7 1.2-9.3 3.5-10.5 10.5c-1.2-7-3.5-9.3-10.5-10.5c7-1.2 9.3-3.5 10.5-10.5Z" fill="#2f4a78" />
      <path d="M454 200c1 6 3 8 9 9c-6 1-8 3-9 9c-1-6-3-8-9-9c6-1 8-3 9-9Z" fill="#7c93b8" />
      <circle cx="36" cy="300" r="5" fill="#c9d6ea" />
      <circle cx="150" cy="70" r="4" fill="#7c93b8" />
    </svg>
  );
}
