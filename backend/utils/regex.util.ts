// Kullanıcı girdisini RegExp içinde güvenle kullanabilmek için özel karakterleri kaçırır.
const escapeRegex = (value: unknown) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// JS'in 'i' bayrağı Türkçe İ/ı eşleşmelerini bilmez ve kullanıcılar çoğu zaman Türkçe karakter
// kullanmadan yazar ("itu" -> "İTÜ"). Bu yüzden her harf, Türkçe karşılıklarını da kapsayan bir sınıfa çevrilir.
const TURKISH_CHAR_CLASSES = [
  ['c', 'ç'],
  ['g', 'ğ'],
  ['i', 'ı', 'İ', 'I'],
  ['o', 'ö'],
  ['s', 'ş'],
  ['u', 'ü'],
];

const CHAR_CLASS_MAP = TURKISH_CHAR_CLASSES.reduce<Record<string, string>>((map, group) => {
  const cls = `[${group.join('')}${group.map((c) => c.toLocaleUpperCase('tr')).join('')}]`;
  group.forEach((c) => {
    map[c] = cls;
    map[c.toLocaleUpperCase('tr')] = cls;
  });
  return map;
}, {});

const toTurkishInsensitive = (value: string) =>
  escapeRegex(value.trim())
    .split('')
    .map((c) => CHAR_CLASS_MAP[c] || c)
    .join('');

// Büyük/küçük harf ve Türkçe karakter duyarsız "içerir" araması.
const containsRegex = (value: string) => new RegExp(toTurkishInsensitive(value), 'i');

// Büyük/küçük harf ve Türkçe karakter duyarsız tam eşleşme (örn. üniversite / bölüm filtresi).
const exactRegex = (value: string) => new RegExp(`^${toTurkishInsensitive(value)}$`, 'i');

const MAX_QUERY_LENGTH = 100;
const MAX_QUERY_WORDS = 8;

// Arama metnini kelimelere böler (aşırı uzun girdiler kırpılır).
const splitSearchWords = (value: unknown) =>
  typeof value === 'string'
    ? value.slice(0, MAX_QUERY_LENGTH).trim().split(/\s+/).filter(Boolean).slice(0, MAX_QUERY_WORDS)
    : [];

// Kelime bazlı arama: her kelime, verilen alanlardan en az birinde geçmelidir (sıra önemsiz).
// Örn. "algoritma odtü" -> başlığında "algoritma", üniversitesinde "ODTÜ" geçen not bulunur.
// extraClauses(word, index): kelime başına $or'a eklenecek ek koşullar (örn. yazar adı eşleşmesi).
// Kelime yoksa null döner.
type Clause = Record<string, unknown>;

const wordSearchMatch = (
  value: unknown,
  fields: string[],
  extraClauses: (word: string, index: number) => Clause[] = () => []
): Clause | null => {
  const words = splitSearchWords(value);
  if (!words.length) return null;
  const clauses = words.map((word, i) => {
    const regex = containsRegex(word);
    return { $or: [...fields.map((field) => ({ [field]: regex })), ...extraClauses(word, i)] };
  });
  return clauses.length === 1 ? clauses[0] : { $and: clauses };
};

export { escapeRegex, containsRegex, exactRegex, splitSearchWords, toTurkishInsensitive, wordSearchMatch };
