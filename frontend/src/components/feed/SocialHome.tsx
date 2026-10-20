import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { Bookmark, Compass, FileUp, Flame, Loader2, UserPlus, type LucideIcon } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import BrowseNotes from '@/components/notes/BrowseNotes';
import Alert from '@/components/common/Alert';
import EmptyState from '@/components/common/EmptyState';
import UserAvatar from '@/components/users/UserAvatar';
import NotePostCard from './NotePostCard';
import FeedSidebar from './FeedSidebar';
import FeedRightRail from './FeedRightRail';
import { ActiveNowStrip, CourseChips, MobileShortcuts, SuggestionsCarousel } from './MobileFeedExtras';
import { useGetFeedQuery, useGetNotesQuery, useGetSavedNotesQuery } from '@/services/notesApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { useKeepInViewOnChange } from '@/hooks/useKeepInViewOnChange';

const FEED_PAGE_SIZE = 10;

type FeedTab = 'all' | 'popular' | 'following' | 'saved';

const TABS: { id: FeedTab; label: string; icon: LucideIcon }[] = [
  { id: 'all', label: 'All', icon: Compass },
  { id: 'popular', label: 'Popular', icon: Flame },
  { id: 'following', label: 'Following', icon: UserPlus },
  { id: 'saved', label: 'Saved', icon: Bookmark },
];

const isFeedTab = (value: string | null): value is FeedTab => TABS.some((t) => t.id === value);

const EMPTY: Record<FeedTab, { title: string; text: string }> = {
  all: { title: 'No notes shared yet', text: 'Be the first to share a note with the community!' },
  popular: { title: 'No popular notes yet', text: 'Notes with the most likes will show up here.' },
  following: {
    title: 'Your feed is empty',
    text: 'Notes from people you follow will show up here. Find students to follow on the right or in Explore.',
  },
  saved: { title: 'No saved notes', text: 'Tap the bookmark icon on any note to keep it here for later.' },
};

// Giriş yapmış kullanıcının ana sayfası: sosyal medya düzeni (sol menü, ortada akış, sağda öneriler).
// Arama/filtre ya da "?all=1" varsa orta sütunda Explore (BrowseNotes) görünümü açılır.
export default function SocialHome() {
  const [searchParams] = useSearchParams();
  const exploring = [...searchParams.keys()].some((k) => k !== 'tab');
  const tabParam = searchParams.get('tab');
  const tab = isFeedTab(tabParam) ? tabParam : 'all';

  // Akış ↔ Explore geçişinde adres yolu (/) değişmediği için ScrollToTop çalışmaz: sayfa başına burada dönülür.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [exploring]);

  return (
    <PageLayout>
      <div className="lg:grid lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_290px] gap-6 xl:gap-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <FeedSidebar />
          </div>
        </aside>

        <div className="min-w-0">
          {exploring ? <BrowseNotes gridClassName="grid gap-4 sm:grid-cols-2" /> : <Feed tab={tab} />}
        </div>

        <aside className="hidden xl:block">
          <FeedRightRail />
        </aside>
      </div>
    </PageLayout>
  );
}

function Feed({ tab }: { tab: FeedTab }) {
  const [, setSearchParams] = useSearchParams();
  const tabsRef = useRef<HTMLDivElement>(null);
  // Aşağıdayken sekme değişirse sekme çubuğu en üste gelir (kısa listede sayfa dibine sıkışmasın).
  useKeepInViewOnChange(tab, tabsRef);

  return (
    <div className="mx-auto max-w-2xl">
      <Composer />
      <MobileShortcuts />
      <ActiveNowStrip />
      <CourseChips />

      <div
        ref={tabsRef}
        role="tablist"
        aria-label="Feed"
        className="mt-4 mb-4 flex scroll-mt-20 gap-1 overflow-x-auto rounded-xl bg-gray-200/70 p-1"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setSearchParams(id === 'all' ? {} : { tab: id })}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              tab === id ? 'bg-white text-navy-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon size={15} className="hidden sm:block" />
            {label}
          </button>
        ))}
      </div>

      {/* Sekme değişince sayfa sayısı sıfırlansın diye key */}
      <FeedList key={tab} tab={tab} />
    </div>
  );
}

// Sosyal medyadaki "ne düşünüyorsun?" kutusu: not yükleme sayfasına götürür.
function Composer() {
  const user = useAppSelector((state) => state.auth.user);
  const firstName = user?.fullName?.split(' ')[0];

  return (
    <Link to="/upload" className="card flex items-center gap-3 p-3 sm:p-4 hover:border-navy-200 transition-colors">
      <UserAvatar user={user} size="md" />
      <span className="min-w-0 flex-1 truncate rounded-full bg-gray-100 px-4 py-2.5 text-sm text-gray-500">
        Share a note with the community{firstName ? `, ${firstName}` : ''}...
      </span>
      <span className="hidden sm:inline-flex btn-primary py-2">
        <FileUp size={16} /> Upload
      </span>
    </Link>
  );
}

// Sekmeye göre doğru listeyi çeker; kullanılmayan sorgular atlanır (skip).
function useFeedPage(tab: FeedTab, page: number) {
  const args = { page, limit: FEED_PAGE_SIZE };
  const notes = useGetNotesQuery(
    { ...args, sort: tab === 'popular' ? 'popular' : 'newest' },
    { skip: tab === 'following' || tab === 'saved' }
  );
  const feed = useGetFeedQuery(args, { skip: tab !== 'following' });
  const saved = useGetSavedNotesQuery(args, { skip: tab !== 'saved' });
  return tab === 'following' ? feed : tab === 'saved' ? saved : notes;
}

// "Load more" ile sayfalar alt alta eklenir; her sayfa kendi sorgusunu yapar (RTK Query önbelleği paylaşılır).
function FeedList({ tab }: { tab: FeedTab }) {
  const [pageCount, setPageCount] = useState(1);
  const last = useFeedPage(tab, pageCount);
  const totalPages = last.data?.data?.pagination?.totalPages ?? 0;

  return (
    // En az ekran boyu: liste kısa olsa da (Saved'da 1-2 not) sekme çubuğu ekranın üstüne gelebilsin.
    <div className="min-h-[calc(100vh-10rem)] space-y-4">
      {Array.from({ length: pageCount }, (_, i) => (
        <FeedPage key={i} tab={tab} page={i + 1} />
      ))}

      {pageCount < totalPages && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setPageCount((n) => n + 1)}
            disabled={last.isFetching}
            className="btn-secondary px-6"
          >
            {last.isFetching && <Loader2 size={16} className="animate-spin" />}
            Load more
          </button>
        </div>
      )}
      {totalPages > 1 && pageCount >= totalPages && !last.isFetching && (
        <p className="py-4 text-center text-sm text-gray-400">You're all caught up ✨</p>
      )}
    </div>
  );
}

function FeedPage({ tab, page }: { tab: FeedTab; page: number }) {
  const { data, isLoading, error } = useFeedPage(tab, page);

  if (isLoading) {
    return Array.from({ length: page === 1 ? 3 : 2 }, (_, i) => <PostSkeleton key={i} />);
  }
  if (error) return <Alert>{getErrorMessage(error)}</Alert>;

  const items = data?.data?.items ?? [];
  if (page === 1 && !items.length) {
    const empty = EMPTY[tab];
    return (
      <EmptyState
        title={empty.title}
        text={empty.text}
        action={
          tab === 'following' || tab === 'saved' ? (
            <Link to="/?all=1" className="btn-primary">
              <Compass size={16} /> Explore notes
            </Link>
          ) : (
            <Link to="/upload" className="btn-primary">
              <FileUp size={16} /> Upload Note
            </Link>
          )
        }
      />
    );
  }

  // Yan panel gizliyken takip önerileri ilk sayfada 3. gönderiden sonra akışın arasına girer.
  const showSuggestions = page === 1 && (tab === 'all' || tab === 'popular') && items.length > 3;

  return items.map((note, i) => (
    <Fragment key={note._id}>
      <NotePostCard note={note} index={i} />
      {showSuggestions && i === 2 && <SuggestionsCarousel />}
    </Fragment>
  ));
}

function PostSkeleton() {
  return (
    <div className="card p-5 space-y-3" aria-hidden="true">
      <div className="flex items-center gap-3">
        <div className="skeleton-box h-10 w-10 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <div className="skeleton-box h-3.5 w-32 rounded" />
          <div className="skeleton-box h-3 w-48 rounded" />
        </div>
      </div>
      <div className="skeleton-box h-5 w-3/4 rounded" />
      <div className="skeleton-box h-3.5 w-full rounded" />
      <div className="skeleton-box h-14 w-full rounded-xl" />
      <div className="skeleton-box h-4 w-40 rounded" />
    </div>
  );
}
