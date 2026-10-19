import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { Compass, Inbox, MapPin, Plus, Search, SlidersHorizontal, UserRound, Users, type LucideIcon } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import GroupGrid from '@/components/groups/GroupGrid';
import GroupActivityRow from '@/components/groups/GroupActivityRow';
import JoinRequestsPanel from '@/components/groups/JoinRequestsPanel';
import Pagination from '@/components/common/Pagination';
import Alert from '@/components/common/Alert';
import EmptyState from '@/components/common/EmptyState';
import Spinner from '@/components/common/Spinner';
import GroupFilterModal from '@/components/groups/GroupFilterModal';
import { activeFilterCount, DEFAULT_GROUP_FILTERS, type GroupFilters } from '@/components/groups/groupFilters';
import { useDebounce } from '@/hooks/useDebounce';
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

type Tab = 'mine' | 'explore' | 'requests';

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
  const waiting = incoming.data?.data?.requests.length ?? 0;

  const setTab = (t: Tab) => setSearchParams(t === 'mine' ? {} : { tab: t });

  return (
    <PageLayout>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
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
              <TabButton active={tab === 'requests'} onClick={() => setTab('requests')} icon={Inbox} badge={waiting}>
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

      {tab === 'mine' && <MyGroupsTab onExplore={() => setTab('explore')} />}
      {tab === 'explore' && <ExploreTab />}
      {tab === 'requests' && <JoinRequestsPanel />}
    </PageLayout>
  );
}

// Üyesi olduğum gruplar (favoriler başta, sonra en son hareket eden) ve üyesi olmadığım favori gruplarım.
function MyGroupsTab({ onExplore }: { onExplore: () => void }) {
  const activity = useGetMyGroupActivityQuery();
  const favorites = useGetFavoriteGroupsQuery();
  const sent = useGetSentRequestsQuery();
  const [course, setCourse] = useState('');

  const mine = useMemo(() => activity.data?.data?.groups ?? [], [activity.data]);
  const favs = useMemo(() => favorites.data?.data?.items ?? [], [favorites.data]);

  // Çipler: gruplarımın ve favorilerimin ders kodları (ilk görülme sırasıyla).
  const courses = useMemo(() => [...new Set([...mine, ...favs].map((g) => groupCode(g.name, g.courseCode)))], [mine, favs]);
  const selected = courses.includes(course) ? course : '';
  const match = (g: { name: string; courseCode?: string }) => !selected || groupCode(g.name, g.courseCode) === selected;

  const myIds = new Set(mine.map((g) => g._id));
  const myList = [...mine.filter((g) => g.isFavorite), ...mine.filter((g) => !g.isFavorite)].filter(match);
  const favList = favs.filter((g) => !myIds.has(g._id)).filter(match);
  const sentCount = sent.data?.data?.requests.length ?? 0;

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
            <button type="button" onClick={onExplore} className="btn-primary">
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

  return (
    <div className="space-y-8">
      {courses.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by course">
          <Chip selected={!selected} onClick={() => setCourse('')}>
            All
          </Chip>
          {courses.map((c) => (
            <Chip key={c} selected={selected === c} onClick={() => setCourse(selected === c ? '' : c)}>
              {c}
            </Chip>
          ))}
        </div>
      )}

      {sentCount > 0 && (
        <p className="text-sm text-gray-500">
          You have {pluralize(sentCount, 'pending join request')}.{' '}
          <Link to="/groups?tab=requests" className="font-semibold text-navy-600 hover:text-navy-700">
            See requests
          </Link>
        </p>
      )}

      {myList.length > 0 && (
        <section aria-labelledby="mine-title">
          <h2 id="mine-title" className="mb-3 text-base font-semibold text-gray-900">
            Groups you're in <span className="font-normal text-gray-400">{myList.length}</span>
          </h2>
          <div className="card divide-y divide-gray-100 overflow-hidden">
            {myList.map((g) => (
              <GroupActivityRow key={g._id} group={g} />
            ))}
          </div>
        </section>
      )}

      {favList.length > 0 && (
        <section aria-labelledby="fav-title">
          <h2 id="fav-title" className="mb-3 text-base font-semibold text-gray-900">
            Favorite groups
          </h2>
          <GroupGrid groups={favList} />
        </section>
      )}
    </div>
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
  const term = useDebounce(search.trim(), 350);
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
  const { data, isLoading, isFetching, error } = useGetGroupsQuery(params);
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
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
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
          {data?.data?.pagination && (
            <span className="ml-auto text-sm text-gray-500">{pluralize(data.data.pagination.total, 'group')}</span>
          )}
        </div>
      </div>

      {error ? (
        <Alert>{getErrorMessage(error)}</Alert>
      ) : (
        <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : ''}>
          <GroupGrid
            groups={data?.data?.items}
            isLoading={isLoading}
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
  children: ReactNode;
}

function TabButton({ active, onClick, icon: Icon, badge = 0, children }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        active ? 'bg-white text-navy-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
      }`}
    >
      <Icon size={15} />
      {children}
      {badge > 0 && <span className="rounded-full bg-rose-500 px-1.5 py-px text-[11px] text-white">{badge}</span>}
    </button>
  );
}
