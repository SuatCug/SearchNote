import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ComposerBannerProps {
  icon: ReactNode;
  title: string;
  text: string;
  onCancel: () => void;
  cancelLabel: string;
}

// Yazma kutusunun üstündeki şerit: yanıtlanan / düzenlenen mesaj ya da eklenen not.
export default function ComposerBanner({ icon, title, text, onCancel, cancelLabel }: ComposerBannerProps) {
  return (
    <div className="mb-2 flex items-center gap-3 rounded-2xl bg-navy-50 pl-3.5 pr-1.5 py-2">
      <span className="shrink-0 text-navy-700">{icon}</span>
      <span className="min-w-0 flex-1 border-l-2 border-navy-300 pl-3">
        <span className="block text-xs font-bold text-navy-800">{title}</span>
        <span className="block truncate text-[13px] text-gray-600">{text}</span>
      </span>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-navy-500 hover:bg-navy-100 hover:text-navy-800"
        aria-label={cancelLabel}
      >
        <X size={17} />
      </button>
    </div>
  );
}
