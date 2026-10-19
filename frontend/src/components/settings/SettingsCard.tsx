import type { ReactNode } from 'react';
import type { AlertVariant } from '@/components/common/Alert';

export type Feedback = { type: AlertVariant | ''; text: string };

// Ayar sayfalarındaki beyaz kutu; title verilirse kutunun içinde küçük başlık olur.
export default function SettingsCard({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 ${className}`}>
      {title && <h2 className="mb-4 text-[15px] font-bold text-gray-900">{title}</h2>}
      {children}
    </section>
  );
}
