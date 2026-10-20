// Üst çubuktaki aramanın "Recent" listesi: sadece bu tarayıcıda, kullanıcı başına saklanır.
// Tarayıcı depolaması kapalı / dolu olabilir: okuma ve yazma hataları sessizce yok sayılır.
export type RecentSearch =
  | { type: 'query'; q: string }
  | { type: 'user'; id: string; fullName: string; avatarUrl?: string; subtitle?: string }
  | { type: 'note'; id: string; title: string; subtitle?: string };

const MAX_RECENT = 6;
const storageKey = (userId: string) => `searchnote:recent-searches:${userId}`;

export const recentKey = (item: RecentSearch) => (item.type === 'query' ? `q:${item.q.toLowerCase()}` : `${item.type}:${item.id}`);

export function loadRecentSearches(userId: string): RecentSearch[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) ?? '[]');
    return Array.isArray(parsed) ? (parsed as RecentSearch[]).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecentSearches(userId: string, items: RecentSearch[]) {
  try {
    if (items.length) localStorage.setItem(storageKey(userId), JSON.stringify(items));
    else localStorage.removeItem(storageKey(userId));
  } catch {
    // Depolama kullanılamıyor: liste bu oturumda bellekte kalır.
  }
}

// En yeni başa eklenir; aynı kayıt varsa öne taşınır.
export function addRecentSearch(userId: string, item: RecentSearch): RecentSearch[] {
  const key = recentKey(item);
  const next = [item, ...loadRecentSearches(userId).filter((r) => recentKey(r) !== key)].slice(0, MAX_RECENT);
  saveRecentSearches(userId, next);
  return next;
}

export function removeRecentSearch(userId: string, key: string): RecentSearch[] {
  const next = loadRecentSearches(userId).filter((r) => recentKey(r) !== key);
  saveRecentSearches(userId, next);
  return next;
}

export function clearRecentSearches(userId: string) {
  saveRecentSearches(userId, []);
}
