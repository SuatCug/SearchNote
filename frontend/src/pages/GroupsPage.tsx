import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { Compass, Inbox, Loader2, MapPin, Plus, Search, SlidersHorizontal, Star, UserRound, Users, type LucideIcon } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import GroupGrid from '@/components/groups/GroupGrid';
import GroupActivityRow from '@/components/groups/GroupActivityRow';
import GroupActivityCard from '@/components/groups/GroupActivityCard';
import GroupCard from '@/components/groups/GroupCard';
import JoinRequestsPanel from '@/components/groups/JoinRequestsPanel';
import Pagination from '@/components/common/Pagination';
import Alert from '@/components/common/Alert';
import EmptyState from '@/components/common/EmptyState';
import Spinner from '@/components/common/Spinner';
import GroupFilterModal from '@/components/groups/GroupFilterModal';
import { activeFilterCount, DEFAULT_GROUP_FILTERS, type GroupFilters } from '@/components/groups/groupFilters';
import { useDebounce } from '@/hooks/useDebounce';
import { useKeepInViewOnChange } from '@/hooks/useKeepInViewOnChange';
import {
  useGetFavoriteGroupsQuery,
  useGetGroupsQuery,
  useGetIncomingRequestsQuery,
  useGetMyGroupActivityQuery,
  useGetSentRequestsQuery,
  type GroupListParams,
} from '@/services/groupsApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { pluralize } from '@/lib/format';
import { groupCode } from '@/lib/groupStyle';
import { normalize } from '@/lib/schoolSearch';

type Tab = 'mine' | 'explore' | 'requests';

// Bu sayıda (ve fazla) grup olunca "Gruplarım"da arama kutusu çıkar.
const SEARCH_MIN_GROUPS = 4;

// Tarayıcıda arama: her kelime grubun adında, ders kodunda ya da (varsa) açıklamasında geçmeli
// (Türkçe karakter ve büyük harf farkı yok sayılır). Gruplarım'da asıl arama, Explore'da sunucu cevabı gelene kadar.
function matchGroups<T extends { name: string; courseCode?: string; description?: string }>(list: T[], term: string) {
  const words = normalize(term).split(' ').filter(Boolean);
  if (!words.length) return list;
  return list.filter((g) => {
    const text = normalize(`${g.name} ${g.courseCode ?? ''} ${groupCode(g.name, g.courseCode)} ${g.description ?? ''}`);
    return words.every((w) => text.includes(w));
  });
}

// Filter penceresinde gösterilen en fazla ders kodu.
const MAX_FILTER_COURSES = 12;

export default function GroupsPage() {
  const token = useAppSelector((state) => state.auth.token);
  const [searchParams, setSearchParams] = useSearchParams();

  // Giriş yapmış kullanıcı varsayılan olarak kendi gruplarını görür (mobil uygulamadaki gibi); misafir keşfeder.
  const requestedTab = searchParams.get('tab');
  const tab: Tab = !token
    ? 'explore'
    : requestedTab === 'explore' || requestedTab === 'requests'
      ? requestedTab
      : 'mine';

  const incoming = useGetIncomingRequestsQuery(undefined, { skip: !token });
  const sent = useGetSentRequestsQuery(undefined, { skip: !token });
  const waiting = incoming.data?.data?.requests.length ?? 0;
  const sentCount = sent.data?.data?.requests.length ?? 0;

  const setTab = (t: Tab) => setSearchParams(t === 'mine' ? {} : { tab: t });
  // Gruplarımda bulunamayan arama Explore'da sürdürülür.
  const exploreWith = (q = '') => setSearchParams(q ? { tab: 'explore', q } : { tab: 'explore' });
  const headerRef = useRef<HTMLDivElement>(null);
  // Aşağıdayken sekme değişirse sayfa başlığı (sekmeler) en üste gelir; kısa sekmede sayfa dibine sıkışmasın.
  useKeepInViewOnChange(tab, headerRef);

  return (
    <PageLayout>
      <div ref={headerRef} className="flex scroll-mt-24 flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
          <p className="text-sm text-gray-500 mt-1">Study groups have a chat and shared notes for one course or project.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {token && (
            <div className="inline-flex rounded-xl bg-gray-200/80 p-1" role="tablist">
              <TabButton active={tab === 'mine'} onClick={() => setTab('mine')} icon={UserRound}>
                My Groups
              </TabButton>
              <TabButton active={tab === 'explore'} onClick={() => setTab('explore')} icon={Compass}>
                Explore
              </TabButton>
              <TabButton active={tab === 'requests'} onClick={() => setTab('requests')} icon={Inbox} badge={waiting + sentCount} badgeTone={waiting ? 'alert' : 'muted'}>
                Requests
              </TabButton>
            </div>
          )}
          {token && (
            <Link to="/groups/new" className="btn-primary">
              <Plus size={16} /> Create Group
            </Link>
          )}
        </div>
      </div>

      <div className="min-h-[calc(100vh-14rem)]">
        {tab === 'mine' && <MyGroupsTab onExplore={exploreWith} />}
        {tab === 'explore' && <ExploreTab />}
        {tab === 'requests' && <JoinRequestsPanel />}
      </div>
    </PageLayout>
  );
}

// Üyesi olduğum gruplar (favoriler başta, sonra en son hareket eden) ve üyesi olmadığım favori gruplarım.
function MyGroupsTab({ onExplore }: { onExplore: (q?: string) => void }) {
  const activity = useGetMyGroupActivityQuery();
  const favorites = useGetFavoriteGroupsQuery();
  const [showFavorites, setShowFavorites] = useState(false);
  const [search, setSearch] = useState('');

  const mine = useMemo(() => activity.data?.data?.groups ?? [], [activity.data]);
  const favs = useMemo(() => favorites.data?.data?.items ?? [], [favorites.data]);

  const myIds = new Set(mine.map((g) => g._id));
  const myFavs = mine.filter((g) => g.isFavorite);
  // Üyesi olmadığım ama yıldızladığım gruplar sadece Favorites'te görünür.
  const otherFavs = favs.filter((g) => !myIds.has(g._id));
  const favCount = myFavs.length + otherFavs.length;

  // Son favori kaldırılırsa hepsine dönülür.
  const favoritesOnly = showFavorites && favCount > 0;
  // Arama kutusu birkaç grup olunca anlamlı; az grupta gösterilmez.
  const canSearch = mine.length + otherFavs.length >= SEARCH_MIN_GROUPS;
  const term = canSearch ? search.trim() : '';

  if (activity.isLoading) return <Spinner />;
  if (activity.error) return <Alert>{getErrorMessage(activity.error)}</Alert>;
  if (!mine.length && !favs.length) {
    return (
      <EmptyState
        icon={Users}
        title="You haven't joined a group yet"
        text="Find a group for your course or start one and invite your classmates."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => onExplore()} className="btn-primary">
              <Compass size={16} /> Explore groups
            </button>
            <Link to="/groups/new" className="btn-secondary">
              <Plus size={16} /> Create a group
            </Link>
          </div>
        }
      />
    );
  }

  const activityList = matchGroups(favoritesOnly ? myFavs : [...myFavs, ...mine.filter((g) => !g.isFavorite)], term);
  const otherList = favoritesOnly ? matchGroups(otherFavs, term) : [];

  return (
    <div>
      {/* Şerit: altı çizili All / Favorites (navbar ile aynı dil), sağda (telefonda altta) gruplarımda arama. */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:border-b sm:border-gray-200">
        <div className="-mb-px flex gap-5 border-b border-gray-200 sm:border-b-0" role="group" aria-label="Filter groups">
          <StripTab selected={!favoritesOnly} onClick={() => setShowFavorites(false)} count={mine.length}>
            All
          </StripTab>
          {favCount > 0 && (
            <StripTab selected={favoritesOnly} onClick={() => setShowFavorites(true)} count={favCount}>
              <Star size={14} className={favoritesOnly ? 'fill-amber-400 text-amber-400' : ''} /> Favorites
            </StripTab>
          )}
        </div>
        {canSearch && (
          <label className="relative block sm:mb-2 sm:ml-auto sm:w-72">
            <span className="sr-only">Search your groups</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your groups"
              className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm placeholder-gray-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </label>
        )}
      </div>

      {!activityList.length && !otherList.length ? (
        <p className="py-10 text-center text-sm text-gray-500">
          {term ? `No groups match "${term}".` : "You haven't joined a group yet."}{' '}
          <button type="button" onClick={() => onExplore(term)} className="font-semibold text-navy-600 hover:text-navy-700">
            {term ? 'Search in Explore' : 'Explore groups'}
          </button>
        </p>
      ) : (
        <>
          {/* Telefonda sohbet listesi gibi satırlar (mobil uygulamayla aynı), geniş ekranda Explore gibi kartlar.
              Üyesi olmadığım favoriler Explore kartıyla gösterilir. */}
          <div className="space-y-4 sm:hidden">
            {activityList.length > 0 && (
              <div className="card divide-y divide-gray-100 overflow-hidden">
                {activityList.map((g) => (
                  <GroupActivityRow key={g._id} group={g} />
                ))}
              </div>
            )}
            {otherList.map((g, i) => (
              <GroupCard key={g._id} group={g} index={i} />
            ))}
          </div>
          <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
            {activityList.map((g, i) => (
              <GroupActivityCard key={g._id} group={g} index={i} />
            ))}
            {otherList.map((g, i) => (
              <GroupCard key={g._id} group={g} index={activityList.length + i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// "Gruplarım" sekme şeridinin bir sekmesi: seçiliyse koyu yazı + alt çizgi.
function StripTab({
  selected,
  onClick,
  count,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  count?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 pt-1 text-sm font-semibold transition-colors ${
        selected ? 'border-navy-800 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'
      }`}
    >
      {children}
      {count !== undefined && <span className="font-normal text-gray-400">{count}</span>}
    </button>
  );
}

// Keşfet (mobildeki Discover ile aynı): yazdıkça arayan kutu + rozetli "Filters" butonu, altında tek dokunuşla
// Everywhere / My university. Ders, katılım türü, göster ve sıralama Filter penceresinde.
// Filtreler adreste tutulur (paylaşılabilir, geri tuşuyla korunur); varsayılan değerler yazılmaz.
function ExploreTab() {
  const token = useAppSelector((state) => state.auth.token);
  const university = useAppSelector((state) => state.auth.user?.university);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterOpen, setFilterOpen] = useState(false);
  const page = Number(searchParams.get('page')) || 1;
  const q = searchParams.get('q') ?? '';
  const sortParam = searchParams.get('sort');
  const privacyParam = searchParams.get('privacy');
  const filters: GroupFilters = {
    course: searchParams.get('course') ?? '',
    scope: token && searchParams.get('scope') === 'university' ? 'university' : 'all',
    privacy: privacyParam === 'public' || privacyParam === 'private' ? privacyParam : 'all',
    show: token && searchParams.get('show') === 'notJoined' ? 'notJoined' : 'all',
    sort: sortParam === 'newest' || sortParam === 'notes' ? sortParam : 'popular',
  };

  const updateParams = (changes: Record<string, string>, { keepPage = false } = {}) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'explore');
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!keepPage) next.delete('page');
    setSearchParams(next);
  };

  // Yazdıkça arar (kısa gecikmeyle). Adresteki arama değişirse (örn. geri tuşu) kutu senkronlanır.
  const [search, setSearch] = useState(q);
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    setSearch(q);
  }
  const typed = search.trim();
  const term = useDebounce(typed, 200);
  const updateRef = useRef(updateParams);
  useEffect(() => {
    updateRef.current = updateParams;
  });
  useEffect(() => {
    if (term !== (new URLSearchParams(window.location.search).get('q') ?? '')) updateRef.current({ q: term });
  }, [term]);

  const applyFilters = (f: GroupFilters) =>
    updateParams({
      course: f.course,
      scope: f.scope === 'university' ? 'university' : '',
      privacy: f.privacy === 'all' ? '' : f.privacy,
      show: f.show === 'notJoined' ? 'notJoined' : '',
      sort: f.sort === 'popular' ? '' : f.sort,
    });
  const clearFilters = () => applyFilters({ ...DEFAULT_GROUP_FILTERS, scope: filters.scope });

  const params: GroupListParams = {
    q,
    page,
    sort: filters.sort,
    course: filters.course || undefined,
    scope: filters.scope === 'university' ? 'university' : undefined,
    privacy: filters.privacy === 'all' ? undefined : filters.privacy,
    exclude: filters.show === 'notJoined' ? 'mine' : undefined,
  };
  const { data, currentData, isLoading, isFetching, error } = useGetGroupsQuery(params);

  // Arama sunucuyu beklemeden hissedilsin: sunucu cevabı gelene kadar ekrandaki liste yazılana göre tarayıcıda süzülür,
  // cevap gelince tam sonuç gösterilir. Değişen sadece arama değil de filtre / sayfaysa eski liste soluk gösterilir.
  const argsKey = JSON.stringify({ ...params, q: undefined, page: undefined });
  const [settled, setSettled] = useState<{ key: string; q: string; page: number } | null>(null);
  if (currentData && (settled?.key !== argsKey || settled.q !== q || settled.page !== page)) {
    setSettled({ key: argsKey, q, page });
  }
  const searchOnly = !currentData && settled?.key === argsKey && settled.page === page;
  const exact = Boolean(currentData) && typed === q;
  const base = currentData?.data?.items ?? data?.data?.items;
  const shown = exact || (!currentData && !searchOnly) ? base : base && matchGroups(base, typed);
  const searching = typed !== q || (isFetching && searchOnly);
  const filterCount = activeFilterCount(filters);

  // Filtredeki ders seçenekleri (mobildeki gibi): gruplarımın ve popüler grupların kodları.
  const mine = useGetMyGroupActivityQuery(undefined, { skip: !token });
  const popular = useGetGroupsQuery({ sort: 'popular', limit: 40 });
  const courses = useMemo(() => {
    const all = [...(mine.data?.data?.groups ?? []), ...(popular.data?.data?.items ?? [])];
    return [...new Set(all.map((g) => groupCode(g.name, g.courseCode)))].slice(0, MAX_FILTER_COURSES);
  }, [mine.data, popular.data]);

  const setPage = (p: number) => {
    updateParams({ page: p > 1 ? String(p) : '' }, { keepPage: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div className="mb-5 space-y-3">
        <div className="flex items-center gap-2">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search groups</span>
            {searching ? (
              <Loader2 size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
            ) : (
              <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            )}
            <input
              type="search"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search groups or courses"
              className="form-input pl-10"
            />
          </label>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            aria-label={filterCount ? `Filters, ${filterCount} active` : 'Filters'}
            className={`relative inline-flex h-[42px] shrink-0 items-center gap-2 rounded-lg border px-3.5 text-sm font-semibold transition-colors ${
              filterCount ? 'border-navy-800 bg-navy-800 text-white' : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal size={17} />
            <span className="hidden sm:inline">Filters</span>
            {filterCount > 0 && (
              <span className="min-w-5 rounded-full bg-white px-1.5 text-center text-xs font-bold leading-5 text-navy-800">{filterCount}</span>
            )}
          </button>
        </div>

        {/* En sık kullanılan filtre: pencereye girmeden tek dokunuşla (mobildeki gibi). */}
        <div className="flex flex-wrap items-center gap-2">
          {token && university && (
            <>
              <Chip selected={filters.scope === 'all'} onClick={() => updateParams({ scope: '' })}>
                Everywhere
              </Chip>
              <Chip selected={filters.scope === 'university'} onClick={() => updateParams({ scope: 'university' })}>
                <MapPin size={13} /> My university
              </Chip>
            </>
          )}
          {filterCount > 0 && (
            <button type="button" onClick={clearFilters} className="px-1 text-sm font-semibold text-navy-600 hover:text-navy-700">
              Clear filters
            </button>
          )}
          {exact && currentData?.data?.pagination && (
            <span className="ml-auto text-sm text-gray-500">{pluralize(currentData.data.pagination.total, 'group')}</span>
          )}
        </div>
      </div>

      {error ? (
        <Alert>{getErrorMessage(error)}</Alert>
      ) : (
        <div className={isFetching && !isLoading && !searchOnly ? 'opacity-60 transition-opacity' : ''}>
          <GroupGrid
            groups={shown}
            // Süzülen listede hiç eşleşme yoksa sunucu cevabı beklenir ("No groups found" yanlışlıkla görünmesin).
            isLoading={isLoading || (!exact && !shown?.length)}
            emptyTitle={q || filterCount ? 'No groups found' : 'No groups yet'}
            emptyText={q || filterCount ? 'Try another search or clear the filters.' : 'Start one for your course and invite your classmates.'}
            emptyAction={
              filterCount ? (
                <button type="button" onClick={clearFilters} className="btn-secondary">
                  Clear filters
                </button>
              ) : (
                token && (
                  <Link to="/groups/new" className="btn-primary">
                    <Plus size={16} /> Create Group
                  </Link>
                )
              )
            }
          />
          <Pagination pagination={data?.data?.pagination} onPageChange={setPage} />
        </div>
      )}

      {filterOpen && (
        <GroupFilterModal
          value={filters}
          courses={courses}
          university={university}
          signedIn={!!token}
          onApply={applyFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
        selected ? 'bg-navy-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  badge?: number;
  // alert: bekleyen iş var (kırmızı), muted: sadece bilgi (gri).
  badgeTone?: 'alert' | 'muted';
  children: ReactNode;
}

function TabButton({ active, onClick, icon: Icon, badge = 0, badgeTone = 'alert', children }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors sm:px-3.5 ${
        active ? 'bg-white text-navy-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
      }`}
    >
      <Icon size={15} />
      {children}
      {badge > 0 && (
        <span className={`rounded-full px-1.5 py-px text-[11px] ${badgeTone === 'alert' ? 'bg-rose-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
          {badge}
        </span>
      )}
    </button>
  );
}
