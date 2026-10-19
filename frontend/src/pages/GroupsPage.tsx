import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { Compass, Inbox, Plus, Search, UserRound, Users, type LucideIcon } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import GroupGrid from '@/components/groups/GroupGrid';
import GroupActivityRow from '@/components/groups/GroupActivityRow';
import JoinRequestsPanel from '@/components/groups/JoinRequestsPanel';
import Pagination from '@/components/common/Pagination';
import Alert from '@/components/common/Alert';
import EmptyState from '@/components/common/EmptyState';
import Spinner from '@/components/common/Spinner';
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

const GROUP_SORTS = [
  { value: 'popular', label: 'Most popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'notes', label: 'Most notes' },
];

// Keşfet filtreleri URL'de tutulur (paylaşılabilir, geri tuşuyla korunur). Değer '' ise varsayılan.
const FILTERS: { key: 'scope' | 'privacy' | 'show'; label: string; options: { value: string; label: string }[] }[] = [
  {
    key: 'scope',
    label: 'University',
    options: [
      { value: '', label: 'Everywhere' },
      { value: 'university', label: 'My university' },
    ],
  },
  {
    key: 'privacy',
    label: 'Who can join',
    options: [
      { value: '', label: 'All' },
      { value: 'public', label: 'Open to everyone' },
      { value: 'private', label: 'Approval needed' },
    ],
  },
  {
    key: 'show',
    label: 'Show',
    options: [
      { value: '', label: 'All groups' },
      { value: 'notJoined', label: 'Not joined yet' },
    ],
  },
];

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

function ExploreTab() {
  const token = useAppSelector((state) => state.auth.token);
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;
  const q = searchParams.get('q') ?? '';
  const sort = searchParams.get('sort') || 'popular';
  const course = searchParams.get('course') ?? '';
  const scope = token && searchParams.get('scope') === 'university' ? 'university' : undefined;
  const privacyParam = searchParams.get('privacy');
  const privacy = privacyParam === 'public' || privacyParam === 'private' ? privacyParam : undefined;
  const notJoined = Boolean(token && searchParams.get('show') === 'notJoined');

  const [search, setSearch] = useState(q);
  const [courseInput, setCourseInput] = useState(course);
  // URL'deki arama değişirse (örn. geri tuşu) kutuları senkronla.
  const [prev, setPrev] = useState({ q, course });
  if (prev.q !== q || prev.course !== course) {
    setPrev({ q, course });
    setSearch(q);
    setCourseInput(course);
  }

  const params: GroupListParams = { q, sort, page, course, scope, privacy, exclude: notJoined ? 'mine' : undefined };
  const { data, isLoading, isFetching, error } = useGetGroupsQuery(params);
  const filterCount = [scope, privacy, notJoined, course].filter(Boolean).length;

  const updateParams = (changes: Record<string, string>, { keepPage = false } = {}) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'explore');
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!keepPage) next.delete('page');
    setSearchParams(next);
  };

  const setPage = (p: number) => {
    updateParams({ page: p > 1 ? String(p) : '' }, { keepPage: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updateParams({ q: search.trim(), course: courseInput.trim().toLocaleUpperCase('tr') });
  };

  const clearFilters = () => updateParams({ scope: '', privacy: '', show: '', course: '' });
  const current: Record<string, string> = { scope: scope ?? '', privacy: privacy ?? '', show: notJoined ? 'notJoined' : '' };

  return (
    <>
      <div className="card p-4 mb-6 space-y-4">
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3" role="search">
          <label className="relative block flex-1 min-w-[200px]">
            <span className="sr-only">Search groups</span>
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search groups..."
              className="form-input pl-10"
            />
          </label>
          <label className="w-36">
            <span className="sr-only">Course code</span>
            <input
              value={courseInput}
              onChange={(e) => setCourseInput(e.target.value.replace(/[^\p{L}\d]/gu, '').toLocaleUpperCase('tr'))}
              maxLength={12}
              placeholder="Course (CENG)"
              className="form-input"
            />
          </label>
          <select
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value === 'popular' ? '' : e.target.value })}
            className="form-input w-auto"
            aria-label="Sort groups"
          >
            {GROUP_SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary">
            Search
          </button>
        </form>

        {token && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {FILTERS.map((f) => (
              <div key={f.key} className="flex flex-wrap items-center gap-1.5" role="group" aria-label={f.label}>
                <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{f.label}</span>
                {f.options.map((o) => (
                  <Chip key={o.value} selected={current[f.key] === o.value} onClick={() => updateParams({ [f.key]: o.value })}>
                    {o.label}
                  </Chip>
                ))}
              </div>
            ))}
            {filterCount > 0 && (
              <button type="button" onClick={clearFilters} className="text-sm font-semibold text-navy-600 hover:text-navy-700">
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {error ? (
        <Alert>{getErrorMessage(error)}</Alert>
      ) : (
        <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : ''}>
          {data?.data?.pagination && (
            <p className="mb-3 text-sm text-gray-500">{pluralize(data.data.pagination.total, 'group')} found</p>
          )}
          <GroupGrid
            groups={data?.data?.items}
            isLoading={isLoading}
            emptyTitle={q || filterCount ? 'No groups found' : 'No groups yet'}
            emptyText={
              q || filterCount ? 'Try another course code or clear the filters.' : 'Start one for your course and invite your classmates.'
            }
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
    </>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
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
