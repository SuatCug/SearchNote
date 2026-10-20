import type { SuggestedUser } from '@/types/api';

// "Who to follow" kartındaki alt satır: kişi neden öneriliyor (aynı okul / bölüm).
export function suggestionReason(u: SuggestedUser) {
  if (u.sameUniversity && u.sameDepartment) return `Same department · ${u.department}`;
  if (u.sameUniversity) return `Same university · ${u.department || u.university}`;
  if (u.sameDepartment) return `Same department · ${u.university}`;
  return u.university ?? '';
}
