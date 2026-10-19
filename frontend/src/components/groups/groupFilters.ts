// Grupları keşfet filtreleri (mobildeki DiscoverFilters ile aynı). Adreste tutulur; varsayılan değerler yazılmaz.
export interface GroupFilters {
  course: string; // '' = tümü
  scope: 'all' | 'university'; // university = benim okulumun grupları
  privacy: 'all' | 'public' | 'private';
  show: 'all' | 'notJoined';
  sort: 'popular' | 'newest' | 'notes';
}

export const DEFAULT_GROUP_FILTERS: GroupFilters = { course: '', scope: 'all', privacy: 'all', show: 'all', sort: 'popular' };

// Varsayılandan farklı filtre sayısı (Filters butonundaki rozet). Üniversite seçimi Keşfet'te ayrıca
// göründüğü için sayılmaz (mobildeki gibi).
export const activeFilterCount = (f: GroupFilters) =>
  (Object.keys(DEFAULT_GROUP_FILTERS) as (keyof GroupFilters)[]).filter((k) => k !== 'scope' && f[k] !== DEFAULT_GROUP_FILTERS[k])
    .length;
