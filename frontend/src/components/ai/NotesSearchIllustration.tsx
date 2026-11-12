// "Search inside notes" sayfasının boş hâlindeki görsel: elinde kitapla duran bir öğrenci, büyütecini
// kocaman bir not sayfasına tutup cevabı içeren vurgulu satırı büyütüyor. Yanında kaynak numarası rozeti
// ve yapay zekâyı anlatan parıltılar. Karakter tarzı ve renkler karşılama sayfasındaki görselle aynı.
export default function NotesSearchIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 400"
      className={className}
      role="img"
      aria-label="A student holding a magnifying glass up to a large note page, highlighting the line that answers a question"
    >
      <defs>
        <clipPath id="nsi-lens">
          <circle cx="284" cy="128" r="30" />
        </clipPath>
        <filter id="nsi-shadow" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#1e3050" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Zemin gölgesi */}
      <ellipse cx="240" cy="364" rx="196" ry="10" fill="#c9d6ea" />

      {/* Not sayfaları */}
      <rect x="226" y="50" width="196" height="270" rx="14" fill="#c9d6ea" transform="rotate(6 324 185)" />
      <rect x="220" y="54" width="200" height="272" rx="14" fill="#ffffff" stroke="#c9d6ea" strokeWidth="2" filter="url(#nsi-shadow)" />
      <rect x="242" y="76" width="96" height="11" rx="5.5" fill="#2f4a78" />
      <rect x="242" y="96" width="60" height="7" rx="3.5" fill="#7c93b8" />
      <rect x="236" y="118" width="166" height="20" rx="5" fill="#fde68a" />
      <rect x="242" y="124.5" width="124" height="7" rx="3.5" fill="#d9a521" opacity="0.55" />
      <g fill="#e0e8f4">
        <rect x="242" y="152" width="150" height="7" rx="3.5" />
        <rect x="270" y="168" width="128" height="7" rx="3.5" />
        <rect x="270" y="184" width="118" height="7" rx="3.5" />
        <rect x="270" y="212" width="80" height="7" rx="3.5" />
        <rect x="242" y="244" width="150" height="7" rx="3.5" />
        <rect x="242" y="260" width="132" height="7" rx="3.5" />
        <rect x="242" y="276" width="144" height="7" rx="3.5" />
      </g>
      <rect x="374" y="300" width="34" height="14" rx="7" fill="#f1f5fb" />
      <rect x="381" y="305" width="20" height="4" rx="2" fill="#7c93b8" />

      {/* Kaynak numarası rozeti */}
      <g transform="translate(372 188)">
        <rect width="92" height="44" rx="12" fill="#ffffff" stroke="#c9d6ea" strokeWidth="2" filter="url(#nsi-shadow)" />
        <rect x="11" y="11" width="22" height="22" rx="6" fill="#e0e8f4" />
        <text x="22" y="27" textAnchor="middle" fontSize="13" fontWeight="700" fill="#1e3050" fontFamily="system-ui, sans-serif">
          1
        </text>
        <rect x="41" y="14" width="40" height="6" rx="3" fill="#2f4a78" />
        <rect x="41" y="25" width="28" height="5" rx="2.5" fill="#c9d6ea" />
      </g>

      {/* Öğrenci: bacaklar ve ayakkabılar */}
      {/* Rahat duruş: sol bacak hafif dışa açık, sağ bacak dizden az kırık */}
      <path d="M140 268L129 340" stroke="#1e3050" strokeWidth="24" strokeLinecap="round" />
      <path d="M182 268L192 306L194 340" stroke="#1e3050" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M186 298L193 306" stroke="#15233d" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M120 252H200L198 280Q160 286 122 280Z" fill="#1e3050" />
      <path d="M108 356q2-9 18-9h8q6 0 6 9Z" fill="#2a1d16" />
      <path d="M188 356q0-9 6-9h8q16 0 18 9Z" fill="#2a1d16" />

      {/* Gövde (kazak) — omuzlar biraz daha geniş */}
      <path d="M114 262C110 210 122 182 160 177C198 182 210 210 206 262Z" fill="#7c93b8" />
      <path d="M184 182C202 191 210 212 206 262L190 262Z" fill="#6b82a8" />
      <path d="M116 256H204" stroke="#6b82a8" strokeWidth="6" strokeLinecap="round" />

      {/* Sol kol ve elindeki kitap */}
      <rect x="90" y="226" width="34" height="46" rx="4" fill="#f2c14e" transform="rotate(-8 107 249)" />
      <rect x="90" y="226" width="7" height="46" rx="2" fill="#d9a521" transform="rotate(-8 107 249)" />
      <path d="M124 196C112 214 108 234 111 250" stroke="#6b82a8" strokeWidth="19" strokeLinecap="round" fill="none" />
      <ellipse cx="112" cy="256" rx="8" ry="7" fill="#c98d63" />

      {/* Boyun ve yaka */}
      <rect x="153" y="162" width="14" height="22" rx="5" fill="#b07a52" />
      <path d="M150 182Q160 192 170 182" stroke="#5f759b" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* Baş ve at kuyruğu (yüz sağa, büyütece bakıyor) */}
      <g transform="translate(0 12)">
      <path d="M142 106C120 110 114 140 124 162C132 148 138 132 148 120Z" fill="#2a1d16" />
      <ellipse cx="162" cy="126" rx="25" ry="28" fill="#c98d63" />
      <ellipse cx="142" cy="132" rx="4.5" ry="6.5" fill="#b07a52" />
      <path d="M137 130C132 98 152 88 168 90C184 92 192 106 188 118C176 110 160 108 148 114L142 134Z" fill="#2a1d16" />
      <circle cx="139" cy="111" r="3.5" fill="#f2c14e" />

      <path d="M161 120q5-3 10 0M175 120q4-3 8 0" stroke="#2a1d16" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <ellipse cx="167" cy="129" rx="2.6" ry="3.2" fill="#1b1f24" />
      <ellipse cx="179" cy="129" rx="2.6" ry="3.2" fill="#1b1f24" />
      <circle cx="167.9" cy="128" r="0.9" fill="#ffffff" />
      <circle cx="179.9" cy="128" r="0.9" fill="#ffffff" />
      <path d="M176 134q3.5 3 0.5 5" stroke="#9a6844" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M166 144q6 5 12 0" stroke="#7a3e2a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="160" cy="139" r="4.5" fill="#e07a6a" opacity="0.25" />
      <circle cx="183" cy="139" r="4" fill="#e07a6a" opacity="0.25" />
      </g>

      {/* Büyüteç: içinde vurgulu satır büyümüş görünür */}
      <g clipPath="url(#nsi-lens)">
        <circle cx="284" cy="128" r="30" fill="#ffffff" />
        <rect x="240" y="94" width="120" height="10" rx="5" fill="#c9d6ea" />
        <rect x="240" y="110" width="130" height="36" rx="8" fill="#fde68a" />
        <rect x="256" y="121" width="30" height="14" rx="7" fill="#d9a521" opacity="0.7" />
        <rect x="292" y="121" width="30" height="14" rx="7" fill="#d9a521" opacity="0.7" />
        <rect x="240" y="154" width="110" height="10" rx="5" fill="#e0e8f4" />
      </g>
      <circle cx="284" cy="128" r="30" fill="none" stroke="#1e3050" strokeWidth="8" />
      <path d="M268 112a21 21 0 0 1 15-5" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.9" />
      <path d="M233 195L262 157" stroke="#1e3050" strokeWidth="9" strokeLinecap="round" />
      <path d="M236 191L246 178" stroke="#2f4a78" strokeWidth="4" strokeLinecap="round" />

      {/* Sağ kol: büyüteci tutuyor */}
      <path d="M194 196C210 208 224 204 236 190" stroke="#7c93b8" strokeWidth="19" strokeLinecap="round" fill="none" />
      <ellipse cx="240" cy="186" rx="8.5" ry="8" fill="#c98d63" />

      {/* Yapay zekâ parıltıları */}
      <path d="M440 34c2 12 6 16 18 18c-12 2-16 6-18 18c-2-12-6-16-18-18c12-2 16-6 18-18Z" fill="#f2c14e" />
      <path d="M456 92c1.2 7 3.5 9.3 10.5 10.5c-7 1.2-9.3 3.5-10.5 10.5c-1.2-7-3.5-9.3-10.5-10.5c7-1.2 9.3-3.5 10.5-10.5Z" fill="#2f4a78" />
      <path d="M78 74c1.4 8 4 10.6 12 12c-8 1.4-10.6 4-12 12c-1.4-8-4-10.6-12-12c8-1.4 10.6-4 12-12Z" fill="#7c93b8" />
      <circle cx="206" cy="40" r="4" fill="#7c93b8" />
      <circle cx="62" cy="230" r="5" fill="#c9d6ea" />
    </svg>
  );
}
