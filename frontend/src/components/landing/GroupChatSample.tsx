import { FileText, Lock, Plus, SendHorizontal } from 'lucide-react';
// Unsplash Lisansı (ücretsiz, atıf gerekmez):
// zeynep.jpg → unsplash.com/photos/IF9TK5Uy-KI, mert.jpg → unsplash.com/photos/DzhBQ5We4QI,
// you.jpg → unsplash.com/photos/s3aDHKxHZSc (yüze göre 192px kırpıldı)
import zeynepPhoto from '@/assets/landing/people/zeynep.jpg';
import mertPhoto from '@/assets/landing/people/mert.jpg';
import youPhoto from '@/assets/landing/people/you.jpg';

// Karşılama sayfasındaki gruplar bölümü: uygulamadaki grup sayfasının sohbet sekmesinin statik örneği
// (grup başlığı, sekmeler, mesajlar, mesaja eklenmiş not ve yanıt). Tıklanmaz.
type SampleMessage = {
  name: string;
  photo: string;
  time: string;
  text: string;
  mine?: boolean;
  note?: { title: string; course: string };
  reply?: { name: string; text: string };
};

const MESSAGES: SampleMessage[] = [
  { name: 'Zeynep Demir', photo: zeynepPhoto, time: '20:41', text: 'Does anyone have the solutions for problem set 4?' },
  {
    name: 'Mert Kaya',
    photo: mertPhoto,
    time: '20:44',
    text: 'Uploaded mine. Q5 is a bit messy, the rest should be fine.',
    note: { title: 'PS4 solutions (Q1–Q6)', course: 'CENG213 · Data Structures' },
  },
  {
    name: 'You',
    photo: youPhoto,
    time: '20:46',
    text: 'Thanks! Is the final open-book?',
    mine: true,
    reply: { name: 'Mert Kaya', text: 'Uploaded mine. Q5 is a bit messy…' },
  },
  { name: 'Zeynep Demir', photo: zeynepPhoto, time: '20:47', text: 'No, one A4 cheat sheet is allowed.' },
];

export default function GroupChatSample() {
  return (
    <figure className="m-0">
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.08)] select-none"
      >
        {/* Grup başlığı ve sekmeler */}
        <div className="px-5 pt-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-[12px] font-extrabold tracking-wide text-white">
              CENG
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[17px] font-semibold text-[#1b1f24]">CENG213 · Data Structures</span>
              <span className="flex items-center gap-1 text-sm text-[#5e6670]">
                <Lock size={12} /> Private · 5 members · 12 notes
              </span>
            </span>
          </div>
          <div className="mt-4 flex gap-6 border-b border-gray-200 text-sm font-semibold">
            <span className="pb-2.5 text-[#5e6670]">Notes 12</span>
            <span className="pb-2.5 text-[#5e6670]">Members 5</span>
            <span className="-mb-px border-b-2 border-navy-900 pb-2.5 text-navy-900">Chat</span>
          </div>
        </div>

        {/* Mesajlar */}
        <div className="space-y-3.5 bg-[#fbfaf8] px-5 py-4">
          {MESSAGES.map((m) => (
            <div key={`${m.name}-${m.time}`} className={`flex gap-2.5 ${m.mine ? 'flex-row-reverse' : ''}`}>
              <img src={m.photo} alt="" width={32} height={32} className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover" />
              <div className={`flex min-w-0 max-w-[80%] flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
                <span className="text-xs text-[#5e6670]">
                  {!m.mine && <span className="font-semibold text-[#3d434a]">{m.name} · </span>}
                  {m.time}
                </span>
                <div
                  className={`mt-1 rounded-2xl text-[14px] leading-snug ${m.note || m.reply ? 'p-2' : 'px-3.5 py-2'} ${
                    m.mine ? 'rounded-tr-sm bg-navy-900 text-white' : 'rounded-tl-sm bg-[#eceff3] text-[#1b1f24]'
                  }`}
                >
                  {m.reply && (
                    <span className="mb-1.5 block rounded-xl bg-white/12 px-3 py-1.5">
                      <span className="block text-xs font-bold text-white/90">{m.reply.name}</span>
                      <span className="block truncate text-[13px] text-white/75">{m.reply.text}</span>
                    </span>
                  )}
                  {m.note && (
                    <span className="mb-1.5 flex items-center gap-2.5 rounded-xl bg-white px-3 py-2">
                      <FileText size={18} className="shrink-0 text-navy-700" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{m.note.title}</span>
                        <span className="block truncate text-xs text-[#5e6670]">{m.note.course}</span>
                      </span>
                    </span>
                  )}
                  <span className={`block ${m.note || m.reply ? 'px-1.5 pb-0.5' : ''}`}>{m.text}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Yazma alanı */}
        <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-50 text-navy-800">
            <Plus size={18} />
          </span>
          <span className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-400">Write a message...</span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-900 text-white">
            <SendHorizontal size={16} />
          </span>
        </div>
      </div>
    </figure>
  );
}
