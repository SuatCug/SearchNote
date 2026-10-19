import { AlertCircle } from 'lucide-react';

// Alanın altındaki kırmızı hata satırı (mobildeki FloatingField / TextField hata satırıyla aynı: ikon + kısa mesaj).
// id: input'un aria-describedby'ı için.
export default function FieldError({ id, children }: { id?: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1 text-xs font-medium text-rose-600">
      <AlertCircle size={13} className="mt-px shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}
