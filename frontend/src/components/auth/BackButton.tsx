import { ArrowLeft } from 'lucide-react';

// Adım adım auth ekranlarında (kayıt, şifre sıfırlama) bir önceki adıma dönüş.
export default function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800"
    >
      <ArrowLeft size={16} /> Back
    </button>
  );
}
