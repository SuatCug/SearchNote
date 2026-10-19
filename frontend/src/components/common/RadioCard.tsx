import type { LucideIcon } from 'lucide-react';

// Mobildeki seçim kartı: solda yuvarlak radyo, ortada başlık + açıklama, sağda (varsa) ikon.
// Not formundaki "Who can see this note?" ve grup formundaki "Who can join?" kullanır.
export default function RadioCard({
  name,
  checked,
  onChange,
  title,
  text,
  icon: Icon,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  text: string;
  icon?: LucideIcon;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3.5 rounded-xl border px-4 py-3.5 transition-colors ${
        checked ? 'border-navy-900 bg-navy-50' : 'border-gray-200 bg-white hover:border-navy-200'
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
          checked ? 'border-navy-900' : 'border-gray-300'
        }`}
        aria-hidden="true"
      >
        {checked && <span className="h-3 w-3 rounded-full bg-navy-900" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-gray-900">{title}</span>
        <span className="block text-sm text-gray-500">{text}</span>
      </span>
      {Icon && <Icon size={19} className={checked ? 'shrink-0 text-navy-900' : 'shrink-0 text-gray-400'} />}
    </label>
  );
}
