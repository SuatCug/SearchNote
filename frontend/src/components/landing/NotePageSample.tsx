import { Download, FileText, Heart, MessageCircle } from 'lucide-react';
// Gruplar bölümündeki Mert Kaya ile aynı kişi (Unsplash Lisansı, bkz. GroupChatSample).
import mertPhoto from '@/assets/landing/people/mert.jpg';

// Karşılama sayfasının son bölümündeki statik örnek: uygulamadaki not sayfasının sadeleştirilmiş hali
// (sol: açılmış PDF sayfası, sağ: not bilgileri ve butonlar). Tıklanmaz; sadece ne bulunacağını gösterir.
const PAGE_LINES: { text: string; strong?: boolean; mark?: boolean }[] = [
  { text: 'Heap — complete binary tree', strong: true },
  { text: '• max-heap: parent ≥ children' },
  { text: '• insert: add to the end, bubble up', mark: true },
  { text: '  → O(log n)' },
  { text: '• extract-max: swap root, sift down' },
  { text: 'AVL tree', strong: true },
  { text: '• |h(L) − h(R)| ≤ 1 at each node' },
  { text: '• 4 cases: LL, RR, LR, RL rotations' },
];

export default function NotePageSample() {
  return (
    <figure className="m-0">
      <div className="flex flex-col sm:flex-row overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.08)]">
        {/* Açılmış not sayfası */}
        <div className="sm:w-[46%] shrink-0 bg-[#e9edf4] p-5 sm:p-6">
          <div
            className="h-full min-h-[260px] rounded-sm bg-white px-5 pt-4 pb-6 shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
            style={{
              backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 25px, #e6ebf2 25px 26px)',
              backgroundPosition: '0 38px',
            }}
          >
            <p className="m-0 mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-[#8a9099]">
              <span>CENG213 · Week 11</span>
              <span>p. 2</span>
            </p>
            {PAGE_LINES.map(({ text, strong, mark }) => (
              <p
                key={text}
                className={`m-0 whitespace-pre-wrap text-[13px] leading-[26px] ${strong ? 'font-semibold text-navy-900' : 'text-[#3d434a]'}`}
              >
                {mark ? <span className="bg-[#fde68a]/80 px-0.5">{text}</span> : text}
              </p>
            ))}
          </div>
        </div>

        {/* Not bilgileri */}
        <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1 rounded-md border border-rose-100 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">
              <FileText size={12} /> PDF
            </span>
            <span className="text-[#5e6670]">6 pages</span>
          </div>

          <div>
            <p className="m-0 text-xl font-semibold leading-snug text-[#1b1f24]">Final review: heaps & balanced trees</p>
            <p className="m-0 mt-1 text-[#5e6670]">Data Structures · CENG213</p>
            <p className="m-0 text-sm text-[#5e6670]">METU · Computer Engineering · Fall 2025</p>
          </div>

          <div className="flex items-center gap-3">
            <img src={mertPhoto} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
            <span className="min-w-0">
              <span className="block font-semibold text-[#1b1f24]">Mert Kaya</span>
              <span className="block text-sm text-[#5e6670]">3rd year, took the course last term</span>
            </span>
          </div>

          <p className="m-0 flex items-center gap-4 text-sm text-[#5e6670]">
            <span className="inline-flex items-center gap-1">
              <Heart size={15} className="fill-rose-500 text-rose-500" /> 48 likes
            </span>
            <span className="inline-flex items-center gap-1">
              <Download size={15} /> 312 downloads
            </span>
          </p>

          <div className="mt-auto grid grid-cols-2 gap-2" aria-hidden="true">
            <span className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-navy-900 text-[15px] font-semibold text-white">
              <Download size={16} /> Free Download
            </span>
            <span className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-navy-900 text-[15px] font-semibold text-navy-900">
              <MessageCircle size={16} /> Ask the author
            </span>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-sm text-[#5e6670]">A note page on SearchNote (sample)</figcaption>
    </figure>
  );
}
