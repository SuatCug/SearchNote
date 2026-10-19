import type { University } from '@/services/universitiesApi';

// Türkçe karakterleri ve büyük/küçük harfi yok sayar: "bogazici" → "Boğaziçi", "ODTU" → "ODTÜ"
export function normalize(text: string) {
  return text
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Arama sonuçlarını yazılana benzerliğe göre sıralar (mobil uygulamayla aynı kurallar):
// 0: adı ya da kısaltması birebir, ya da adı yazılan kelimeyle başlayan ("koç" → Koç Üniversitesi, "odtu" → ODTÜ)
// 1: adı yazılan kelimelerle sırayla başlayan ("is tek" → İstanbul Teknik)
// 2: yazılan kelimeler tam kelime olarak geçen, 3: diğerleri
export function rankUniversities(list: University[], term: string) {
  const q = normalize(term);
  if (!q) return list;
  const words = q.split(' ');
  const inOrder = new RegExp(`^${words.map((w) => `${w}\\S*`).join(' ')}`);
  const score = (u: University) => {
    const name = normalize(u.name);
    if (name === q || name.startsWith(`${q} `) || u.aliases.some((a) => normalize(a) === q)) return 0;
    if (inOrder.test(name)) return 1;
    const all = ` ${normalize([u.name, ...u.aliases].join(' '))} `;
    return words.every((w) => all.includes(` ${w} `)) ? 2 : 3;
  };
  return list
    .map((u, i) => ({ u, i, s: score(u) }))
    .sort((a, b) => a.s - b.s || (a.s === 0 ? a.u.name.length - b.u.name.length : 0) || a.i - b.i)
    .map((x) => x.u);
}

// Her kelime, isimlerden birindeki bir kelimenin başıyla eşleşmeli ("is tek" → İstanbul Teknik, "odtu" → ODTÜ)
export function filterByWords<T>(list: T[], term: string, names: (item: T) => string[]) {
  const words = normalize(term).split(' ').filter(Boolean);
  if (!words.length) return list;
  return list.filter((item) => {
    const text = ` ${normalize(names(item).join(' '))}`;
    return words.every((w) => text.includes(` ${w}`));
  });
}
