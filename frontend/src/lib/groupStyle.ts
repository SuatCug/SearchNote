import type { GroupColor } from '@/types/api';

// Grupların rengi ve kısa kodu: liste, kart ve grup sayfasında (mobil uygulamayla) aynı görünüm.

// Marka laciverdiyle uyumlu, doygunluğu düşük tonlar. Sunucu 6 rengi kabul eder; formda 4'ü sunulur.
export const GROUP_COLORS: Record<GroupColor, string> = {
  navy: '#1e3050',
  purple: '#4f4672',
  teal: '#2f5f5a',
  orange: '#8a4f32',
  blue: '#34557d',
  green: '#3f5e45',
};

// Oluşturma / düzenleme formunda sunulan renkler
export const GROUP_COLOR_IDS: GroupColor[] = ['navy', 'purple', 'teal', 'orange'];

export const groupColor = (color?: GroupColor | null) => GROUP_COLORS[color ?? 'navy'] ?? GROUP_COLORS.navy;

// Ders kodunun harfleri ("CENG213" -> "CENG"); ders kodu yoksa grup adından:
// "MAT101 Calculus" -> "MAT", "İE332 Proje" -> "İE332", "Algoritmalar Çalışma" -> "ALG".
export function groupCode(name: string, courseCode?: string | null) {
  const code = courseCode?.trim();
  if (code) return code.match(/^\p{L}{2,5}/u)?.[0]?.toLocaleUpperCase('tr') ?? code.slice(0, 5).toLocaleUpperCase('tr');
  const trimmed = name.trim();
  const course = trimmed.match(/^(\p{L}{2,4})\s?(\d{2,4})/u);
  if (course) {
    const letters = course[1].toLocaleUpperCase('tr');
    return letters.length >= 3 ? letters : letters + course[2];
  }
  const word = trimmed.split(/\s+/).find((w) => /\p{L}|\d/u.test(w)) ?? '?';
  return word.replace(/[^\p{L}\d]/gu, '').slice(0, 3).toLocaleUpperCase('tr') || '?';
}

// Grup adı ders koduyla başlamıyorsa "CENG213 · Veri Yapıları" gibi gösterilir.
export function groupTitle(name: string, courseCode?: string | null) {
  const code = courseCode?.trim();
  if (!code) return name;
  const plain = (s: string) => s.toLocaleUpperCase('tr').replace(/\s/g, '');
  return plain(name).startsWith(plain(code)) ? name : `${code} · ${name}`;
}
