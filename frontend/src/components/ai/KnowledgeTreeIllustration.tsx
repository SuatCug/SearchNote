// "My knowledge map" sayfasının görseli: dalları konu düğümlerine dönüşmüş büyük bir bilgi ağacı.
// Düğüm renkleri haritadaki durum renkleriyle aynı (yeşil = güçlü, sarı = ilerliyor, kırmızı = zorlanıyor,
// kesikli = henüz çalışılmadı). Renk ve gölge dili "Search inside notes" görseliyle aynı.
// leaves verilirse ağaç öğrencinin kendi haritasını yansıtır.
import type { TopicStatus } from '@/types/api';

const COLORS: Record<TopicStatus, { fill: string; stroke: string }> = {
  strong: { fill: '#ecfdf5', stroke: '#34d399' },
  learning: { fill: '#fffbeb', stroke: '#fbbf24' },
  weak: { fill: '#fff1f2', stroke: '#fb7185' },
  untested: { fill: '#ffffff', stroke: '#97b0d7' },
};

// Dalların uçlarındaki 12 düğüm; durumlar görsel tek başına kullanılırken gösterilen örnek renkler.
const NODES: { x: number; y: number; r: number; status: TopicStatus }[] = [
  { x: 240, y: 140, r: 18, status: 'strong' },
  { x: 170, y: 190, r: 16, status: 'strong' },
  { x: 310, y: 190, r: 16, status: 'learning' },
  { x: 160, y: 120, r: 14, status: 'strong' },
  { x: 120, y: 170, r: 14, status: 'weak' },
  { x: 360, y: 170, r: 14, status: 'strong' },
  { x: 320, y: 120, r: 14, status: 'learning' },
  { x: 196, y: 100, r: 13, status: 'learning' },
  { x: 284, y: 100, r: 13, status: 'strong' },
  { x: 196, y: 250, r: 12, status: 'strong' },
  { x: 284, y: 250, r: 12, status: 'weak' },
  { x: 240, y: 70, r: 15, status: 'untested' },
];

interface Props {
  className?: string;
  // Verilirse düğümler öğrencinin gerçek konu durumlarıyla boyanır (eksik kalanlar "çalışılmadı").
  leaves?: TopicStatus[];
}

export default function KnowledgeTreeIllustration({ className = '', leaves }: Props) {
  return (
    <svg
      viewBox="0 0 480 560"
      className={className}
      role="img"
      aria-label="A large tree whose branches end in colored topic circles, showing strong, in-progress and weak topics"
    >
      <defs>
        <filter id="kti-shadow" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#1e3050" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Zemin gölgesi */}
      <ellipse cx="240" cy="526" rx="180" ry="10" fill="#c9d6ea" />

      {/* Ağacın tacı */}
      <g fill="#dcefe5">
        <circle cx="240" cy="140" r="112" />
        <circle cx="142" cy="184" r="80" />
        <circle cx="338" cy="184" r="80" />
        <circle cx="176" cy="96" r="66" />
        <circle cx="304" cy="96" r="66" />
        <circle cx="240" cy="60" r="56" />
        <circle cx="196" cy="220" r="60" />
        <circle cx="284" cy="220" r="60" />
      </g>
      <g fill="#cfe7da">
        <circle cx="206" cy="214" r="44" />
        <circle cx="276" cy="216" r="42" />
        <circle cx="120" cy="206" r="34" />
        <circle cx="362" cy="204" r="34" />
      </g>

      {/* Gövde ve kökler */}
      <path d="M198 522C220 480 225 380 227 240L253 240C255 380 260 480 282 522Z" fill="#a8875a" />
      <path d="M240 240L253 240C255 380 260 480 282 522L252 522C249 440 245 330 240 240Z" fill="#8a6c44" />
      <path d="M206 520Q182 524 156 532M274 520Q298 524 324 532M238 522Q234 528 228 534" stroke="#8a6c44" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M232 330q6 4 4 12M247 392q-5 3-3 9M233 452q5 4 3 11" stroke="#7a5c38" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* Çimen */}
      <g stroke="#8cc5a6" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M176 524l-3-10M182 524l2-12M188 524l4-8" />
        <path d="M296 524l-3-9M302 524l2-12M308 524l4-8" />
      </g>

      {/* Dallar: konuları birbirine bağlayan çizgiler */}
      <g stroke="#8a6c44" strokeLinecap="round" fill="none">
        <path d="M240 244L240 140" strokeWidth="13" />
        <path d="M236 252L170 190" strokeWidth="11" />
        <path d="M244 252L310 190" strokeWidth="11" />
        <path d="M240 140L240 70" strokeWidth="8" />
        <path d="M240 140L196 100M240 140L284 100" strokeWidth="7" />
        <path d="M170 190L120 170M170 190L160 120" strokeWidth="7" />
        <path d="M310 190L360 170M310 190L320 120" strokeWidth="7" />
        <path d="M236 274L196 250M244 274L284 250" strokeWidth="6" />
      </g>

      {/* Konu düğümleri (önce merkezdeki büyük düğüm) */}
      {NODES.map((node, i) => {
        const status = leaves ? (leaves[i] ?? 'untested') : node.status;
        const c = COLORS[status];
        return (
          <g key={i}>
            <circle
              cx={node.x}
              cy={node.y}
              r={node.r}
              fill={c.fill}
              stroke={c.stroke}
              strokeWidth="4"
              strokeDasharray={status === 'untested' ? '5 4' : undefined}
            />
            {status !== 'untested' && <circle cx={node.x} cy={node.y} r={Math.max(3.5, node.r * 0.3)} fill={c.stroke} />}
          </g>
        );
      })}

      {/* Durum açıklaması kartı */}
      <g transform="translate(360 380)">
        <rect width="96" height="62" rx="12" fill="#ffffff" stroke="#c9d6ea" strokeWidth="2" filter="url(#kti-shadow)" />
        <circle cx="16" cy="16" r="5" fill="#34d399" />
        <rect x="28" y="13" width="54" height="6" rx="3" fill="#2f4a78" />
        <circle cx="16" cy="31" r="5" fill="#fbbf24" />
        <rect x="28" y="28" width="42" height="6" rx="3" fill="#c9d6ea" />
        <circle cx="16" cy="46" r="5" fill="#fb7185" />
        <rect x="28" y="43" width="48" height="6" rx="3" fill="#c9d6ea" />
      </g>

      {/* Düşen yapraklar */}
      <ellipse cx="110" cy="440" rx="9" ry="5" fill="#cfe7da" transform="rotate(-30 110 440)" />
      <ellipse cx="140" cy="494" rx="7" ry="4" fill="#dcefe5" transform="rotate(20 140 494)" />
      <ellipse cx="352" cy="500" rx="8" ry="4.5" fill="#cfe7da" transform="rotate(-15 352 500)" />

      {/* Yapay zekâ parıltıları */}
      <path d="M432 30c2 12 6 16 18 18c-12 2-16 6-18 18c-2-12-6-16-18-18c12-2 16-6 18-18Z" fill="#f2c14e" />
      <path d="M48 44c1.4 8 4 10.6 12 12c-8 1.4-10.6 4-12 12c-1.4-8-4-10.6-12-12c8-1.4 10.6-4 12-12Z" fill="#7c93b8" />
      <path d="M452 112c1.2 7 3.5 9.3 10.5 10.5c-7 1.2-9.3 3.5-10.5 10.5c-1.2-7-3.5-9.3-10.5-10.5c7-1.2 9.3-3.5 10.5-10.5Z" fill="#2f4a78" />
      <circle cx="60" cy="360" r="5" fill="#c9d6ea" />
      <circle cx="420" cy="80" r="4" fill="#7c93b8" />
    </svg>
  );
}
