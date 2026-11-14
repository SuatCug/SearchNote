import { Lock, UserCheck } from 'lucide-react';
import type { NoteVisibility } from '@/types/api';

// "Sadece takipçiler" ve kişisel (sadece sen) notlarda gösterilen rozet; herkese açık notlarda hiçbir şey göstermez.
export default function VisibilityBadge({ visibility, className = '' }: { visibility?: NoteVisibility; className?: string }) {
  if (visibility === 'private') {
    return (
      <span
        title="Uploaded for your own quizzes. Only you can see this file."
        className={`inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-700 ${className}`}
      >
        <Lock size={13} />
        Only you
      </span>
    );
  }
  if (visibility !== 'followers') return null;
  return (
    <span
      title="Only the author's followers can see this note"
      className={`inline-flex items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ${className}`}
    >
      <UserCheck size={13} />
      Followers
    </span>
  );
}
