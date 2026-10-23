import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import {
  Award,
  Calendar,
  Camera,
  Check,
  Download,
  FileText,
  Flag,
  Heart,
  Link as LinkIcon,
  Monitor,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Share2,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Spinner from '@/components/common/Spinner';
import EmptyState from '@/components/common/EmptyState';
import Pagination from '@/components/common/Pagination';
import Modal from '@/components/common/Modal';
import NoteGridCard from '@/components/notes/NoteGridCard';
import UserAvatar from '@/components/users/UserAvatar';
import FollowButton from '@/components/users/FollowButton';
import BlockButton from '@/components/users/BlockButton';
import MessageButton from '@/components/messages/MessageButton';
import MutualFollowers from '@/components/users/MutualFollowers';
import ReportModal from '@/components/users/ReportModal';
import ConnectionsModal from '@/components/users/ConnectionsModal';
import GroupActivityRow from '@/components/groups/GroupActivityRow';
import GroupIcon from '@/components/groups/GroupIcon';
import {
  useGetProfileQuery,
  useGetUserCoursesQuery,
  useGetUserNotesQuery,
  type ConnectionType,
} from '@/services/usersApi';
import { useGetSavedNotesQuery } from '@/services/notesApi';
import { useGetMyGroupActivityQuery, useGetMyGroupsQuery } from '@/services/groupsApi';
import { FILE_TYPES } from '@/lib/constants';
import { DESKTOP_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import { useKeepInViewOnChange } from '@/hooks/useKeepInViewOnChange';
import logo from '@/assets/logo.png';
import { formatCount, formatDate, pluralize } from '@/lib/format';
import type { NoteCard, ProfileData, UserCourse } from '@/types/api';

// Profil sayfası, mobil uygulamadaki profil ekranının aynısı: lacivert bant, bandın üzerine taşan ortalanmış avatar,
// sayaçlar, ad / okul / biyografi, ortak takipçiler, eşit genişlikte aksiyon butonları, ortalanmış sekme çipleri
// (All / Notes, kendi profilimde Saved / Groups) ve not kartı ızgarası. "All" = "At a glance" kartı + son notlar.
// Sekme, sıralama, ders filtresi ve sayfa adreste tutulur. /users/:id/followers | following | mutual adresinde
// profilin üstünde Instagram'daki gibi kişi listesi penceresi açılır (list).
type ProfileTab = 'all' | 'notes' | 'saved' | 'groups';

const SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'popular', label: 'Most liked' },
  { key: 'downloads', label: 'Most downloaded' },
];

// 3 sütunlu (telefonda 2) ızgarada satırlar dolsun diye 6'nın katı.
const PAGE_SIZE = 12;
// "All" sekmesinde son notlar: 2 satır (telefonda 4, geniş ekranda 6).
const PREVIEW_COUNT = 6;

const GRID = 'grid grid-cols-2 sm:grid-cols-3 gap-3';
// Mobildeki ikincil buton (navy-100 zemin).
const SOFT_BUTTON =
  'inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-navy-100 px-3 text-[13px] font-bold text-gray-900 hover:bg-navy-200 transition-colors disabled:opacity-60';
const SQUARE_BUTTON = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-100 text-gray-900 hover:bg-navy-200 transition-colors';

export default function ProfilePage({ list }: { list?: ConnectionType }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading, error } = useGetProfileQuery(id);
  const [aboutOpen, setAboutOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  // "My notes" kısayollarından gelindiyse (state.scrollTo) profil yüklenince notların olduğu bölüme inilir.
  const scrollToNotes = location.state?.scrollTo === 'notes';
  const loaded = Boolean(data);
  useEffect(() => {
    if (loaded && scrollToNotes) contentRef.current?.scrollIntoView({ block: 'start' });
  }, [loaded, scrollToNotes]);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  const isMe = data?.data?.isMe ?? false;
  const requested = searchParams.get('tab');
  const tab: ProfileTab =
    requested === 'notes' || (isMe && (requested === 'saved' || requested === 'groups')) ? requested : 'all';
  // Aşağıdayken sekme değişirse notların / sekmenin başı en üste gelir (kısa sekmede sayfa dibine sıkışmasın).
  useKeepInViewOnChange(tab, contentRef);

  if (isLoading) return <PageLayout><Spinner /></PageLayout>;
  if (error || !data) {
    return (
      <PageLayout narrow>
        <EmptyState title="User not found" action={<Link to="/" className="btn-primary">Back to home</Link>} />
      </PageLayout>
    );
  }

  const { user } = data.data;
  // Facebook'taki gibi ilk sekme "All": geniş ekranda soldaki Intro sütunu + son notlar.
  const tabs: { key: ProfileTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'notes', label: 'Notes' },
    ...(isMe
      ? [
          { key: 'saved' as const, label: 'Saved' },
          { key: 'groups' as const, label: 'Groups' },
        ]
      : []),
  ];
  // Varsayılan sekme (All) adreste yazılmaz.
  const changeTab = (next: ProfileTab) => setSearchParams(next === 'all' ? {} : { tab: next });
  // Soldaki "Courses shared" kartından: Notes sekmesi o dersle filtrelenmiş açılır.
  const openCourse = (code: string) => setSearchParams({ tab: 'notes', course: code });
  // Başlıktaki "Notes" sayacı: Notes sekmesini açar ve notların olduğu bölüme kaydırır (yeni sekme çizilsin diye bir kare beklenir).
  const showNotes = () => {
    changeTab('notes');
    requestAnimationFrame(() => contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // Telefon: mobil uygulamadaki gibi çipler.
  const tabChips = (
    <div className="flex w-max min-w-full justify-center gap-2 py-5" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={tab === t.key}
          onClick={() => changeTab(t.key)}
          className={`h-[38px] rounded-full border bg-navy-100 px-4 text-sm transition-colors hover:bg-navy-200 ${
            tab === t.key ? 'border-gray-300 font-extrabold text-gray-900' : 'border-transparent font-semibold text-gray-600'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
  // Geniş ekran (Facebook profil sekmeleri gibi): düz yazı; seçili sekme lacivert ve altında kartın
  // alt kenarına oturan kalın çizgi, diğerlerinde üzerine gelince gri zemin.
  const tabStrip = (
    <div className="flex gap-1" role="tablist">
      {tabs.map((t) => {
        const selected = tab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => changeTab(t.key)}
            className={`relative py-1 text-[15px] font-semibold ${selected ? 'text-navy-700' : 'text-gray-600'}`}
          >
            <span className={`block rounded-lg px-4 py-3 transition-colors ${selected ? '' : 'hover:bg-gray-100'}`}>{t.label}</span>
            {selected && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-full bg-navy-700" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );

  return (
    <PageLayout>
      {/* Telefon / tablet: mobil uygulamadaki düzen. Geniş ekran (lg): Facebook tarzı geniş başlık + solda "Intro" sütunu. */}
      <div className="mx-auto max-w-[720px] lg:max-w-none">
        <div className="lg:hidden">
          <ProfileHeader profile={data.data} onNotes={showNotes} />
          {/* Telefonda kaydırma hedefi sekme satırı: sekmeler de görünür kalır. */}
          <div ref={isDesktop ? undefined : contentRef} className="no-scrollbar -mx-4 scroll-mt-16 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {tabChips}
          </div>
          <div className="-mx-4 mb-5 border-t border-gray-200 sm:mx-0" />
        </div>
        <DesktopHeader profile={data.data} onNotes={showNotes} tabs={tabStrip} />

        <div className="lg:mt-6 lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-6">
          <aside className="hidden lg:block space-y-4">
            <IntroCard profile={data.data} />
            <CoursesCard userId={user.id} onCourse={openCourse} />
            {isMe ? <GroupsCard onSeeAll={() => changeTab('groups')} /> : <PopularNotesCard userId={user.id} />}
          </aside>

          <div ref={isDesktop ? contentRef : undefined} className="min-h-[calc(100vh-10rem)] min-w-0 scroll-mt-24">
            {tab === 'all' && (
              <AllTab
                profile={data.data}
                onSeeAbout={() => setAboutOpen(true)}
                onNotes={() => changeTab('notes')}
                onCourse={openCourse}
                onGroups={() => changeTab('groups')}
              />
            )}
            {tab === 'notes' && <NotesTab userId={user.id} isMe={isMe} total={data.data.stats.notesCount} />}
            {tab === 'saved' && <SavedTab />}
            {tab === 'groups' && <GroupsTab />}
          </div>
        </div>
      </div>

      {aboutOpen && (
        <AboutModal
          profile={data.data}
          onCourse={(code) => {
            setAboutOpen(false);
            openCourse(code);
          }}
          onClose={() => setAboutOpen(false)}
        />
      )}
      {list && (
        <ConnectionsModal
          key={list}
          userId={user.id}
          type={list}
          isMe={isMe}
          // Profilden açıldıysa geri dön (adres ve sekme eski haline gelir); doğrudan bağlantıyla gelindiyse profile git.
          onClose={() => (location.state?.fromProfile ? navigate(-1) : navigate(`/users/${user.id}`, { replace: true }))}
        />
      )}
    </PageLayout>
  );
}

/* ----------------------------------------------------------------- Başlık */

function ProfileHeader({ profile, onNotes }: { profile: ProfileData; onNotes: () => void }) {
  const token = useAppSelector((state) => state.auth.token);
  const { user, stats, isFollowing, isBlocked, isMe } = profile;

  return (
    <header>
      {/* Sade lacivert bant; avatarın üst yarısı bandın üzerine taşar. Telefonda kenardan kenara. */}
      <div className="-mx-4 -mt-6 h-[86px] bg-navy-800 sm:mx-0 sm:mt-0 sm:h-[100px] sm:rounded-2xl" />

      <div className="flex flex-col items-center text-center">
        <div className="relative -mt-[58px] sm:-mt-[66px]">
          <UserAvatar user={user} size="profile" className="ring-4 ring-gray-100" />
          {isMe && (
            <Link
              to="/settings/profile"
              aria-label="Change profile photo"
              className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-100 bg-white text-gray-900 shadow hover:bg-gray-50"
            >
              <Camera size={15} />
            </Link>
          )}
        </div>

        <div className="mt-3 flex justify-center gap-10">
          <Stat value={stats.notesCount} label="Notes" onClick={onNotes} />
          <Stat value={user.followersCount} label="Followers" to={`/users/${user.id}/followers`} />
          <Stat value={user.followingCount} label="Following" to={`/users/${user.id}/following`} />
        </div>

        <h1 className="mt-4 line-clamp-2 break-words text-[22px] min-[360px]:text-[26px] font-extrabold leading-tight text-gray-900">
          {user.fullName}
        </h1>
        {(user.university || user.department) && (
          <p className="mt-1 text-sm text-gray-500">{[user.university, user.department].filter(Boolean).join(' · ')}</p>
        )}
        {user.bio ? (
          <p className="mt-2 whitespace-pre-line break-words text-sm leading-5 text-gray-700">{user.bio}</p>
        ) : (
          isMe && (
            <Link to="/settings/profile" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-navy-700 hover:text-navy-800">
              <Plus size={16} /> Add a short bio
            </Link>
          )
        )}
      </div>

      {token && !isMe && !isBlocked && user.followersCount > 0 && (
        <div className="mt-4">
          <MutualFollowers userId={user.id} />
        </div>
      )}

      {isBlocked && !isMe ? (
        <div className="mt-4 space-y-2">
          <p className="text-center text-sm text-gray-500">You blocked this user.</p>
          {/* ⋯ menüsü engelliyken de açılır (şikâyet edebilmek için) */}
          <div className="flex items-center gap-2">
            <BlockButton userId={user.id} isBlocked name={user.fullName} variant="button" className="flex-1 h-9 text-[13px]" />
            <ProfileMenu userId={user.id} name={user.fullName} isBlocked={isBlocked} />
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2">
          {isMe ? (
            <>
              <Link to="/settings/profile" className={SOFT_BUTTON}>
                <Pencil size={14} /> Edit profile
              </Link>
              <ShareProfileButton userId={user.id} name={user.fullName} />
            </>
          ) : (
            <>
              <FollowButton userId={user.id} isFollowing={isFollowing} name={user.fullName} variant="profile" />
              <MessageButton userId={user.id} className={SOFT_BUTTON} />
              {token && <ProfileMenu userId={user.id} name={user.fullName} isBlocked={isBlocked} />}
            </>
          )}
        </div>
      )}
    </header>
  );
}

// Geniş ekran başlığı (Facebook gibi): geniş lacivert bant, solda bandın alt kenarına taşan avatar,
// yanında ad / okul / satır içi sayaçlar, sağda butonlar; altta ince çizgiyle ayrılmış, alt çizgili sekmeler.
function DesktopHeader({ profile, onNotes, tabs }: { profile: ProfileData; onNotes: () => void; tabs: ReactNode }) {
  const token = useAppSelector((state) => state.auth.token);
  const { user, stats, isFollowing, isBlocked, isMe } = profile;
  const button = 'flex-none px-5';

  return (
    // overflow-hidden yalnızca bantta: başlıkta olsaydı "⋯" menüsü kartın altına taşınca kesilirdi.
    <header className="hidden lg:block rounded-2xl border border-gray-200 bg-white">
      {/* Kapak fotoğrafı yok: soluk nokta deseni ve sağ altta soluk logo, bant boş görünmesin. */}
      <div className="relative h-[140px] overflow-hidden rounded-t-2xl bg-gradient-to-br from-navy-800 via-navy-700 to-navy-900">
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1.5px)', backgroundSize: '18px 18px' }}
          aria-hidden="true"
        />
        <img src={logo} alt="" className="absolute -bottom-10 -right-6 h-48 w-48 rotate-[-12deg] opacity-[0.08] grayscale invert" aria-hidden="true" />
      </div>
      <div className="flex items-end gap-6 px-8">
        {/* pb: fotoğraf alttaki sekme çizgisine yapışmasın */}
        <div className="relative -mt-[60px] shrink-0 pb-4">
          <UserAvatar user={user} className="!h-[168px] !w-[168px] !text-5xl ring-4 ring-white" />
          {isMe && (
            <Link
              to="/settings/profile"
              aria-label="Change profile photo"
              className="absolute bottom-7 right-3 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-gray-900 shadow hover:bg-gray-200"
            >
              <Camera size={17} />
            </Link>
          )}
        </div>

        <div className="min-w-0 flex-1 pb-5 pt-4">
          <h1 className="break-words text-[32px] font-extrabold leading-tight text-gray-900">{user.fullName}</h1>
          {(user.university || user.department) && (
            <p className="mt-0.5 text-[15px] text-gray-500">{[user.university, user.department].filter(Boolean).join(' · ')}</p>
          )}
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[17px] text-gray-500">
            <InlineStat value={stats.notesCount} label={stats.notesCount === 1 ? 'note' : 'notes'} onClick={onNotes} />
            <span aria-hidden="true">·</span>
            <InlineStat value={user.followersCount} label="followers" to={`/users/${user.id}/followers`} />
            <span aria-hidden="true">·</span>
            <InlineStat value={user.followingCount} label="following" to={`/users/${user.id}/following`} />
          </p>
          {token && !isMe && !isBlocked && user.followersCount > 0 && (
            <div className="mt-2">
              <MutualFollowers userId={user.id} />
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 pb-6">
          {isMe ? (
            <>
              <Link to="/settings/profile" className={`${SOFT_BUTTON} ${button}`}>
                <Pencil size={14} /> Edit profile
              </Link>
              <ShareProfileButton userId={user.id} name={user.fullName} className={button} />
            </>
          ) : isBlocked ? (
            <>
              <BlockButton userId={user.id} isBlocked name={user.fullName} variant="button" className="h-9 text-[13px]" />
              <ProfileMenu userId={user.id} name={user.fullName} isBlocked={isBlocked} />
            </>
          ) : (
            <>
              {/* Follow ve Message aynı genişlikte. */}
              <span className="flex w-36">
                <FollowButton userId={user.id} isFollowing={isFollowing} name={user.fullName} variant="profile" />
              </span>
              <span className="flex w-36">
                <MessageButton userId={user.id} className={SOFT_BUTTON} />
              </span>
              {token && <ProfileMenu userId={user.id} name={user.fullName} isBlocked={isBlocked} />}
            </>
          )}
        </div>
      </div>
      <div className="mx-8 border-t border-gray-200">{tabs}</div>
    </header>
  );
}

function InlineStat({ value, label, to, onClick }: { value: number; label: string; to?: string; onClick?: () => void }) {
  const { search } = useLocation();
  const content = (
    <>
      <b className="text-[19px] font-extrabold text-gray-900">{formatCount(value)}</b> {label}
    </>
  );
  return to ? (
    <Link to={`${to}${search}`} state={{ fromProfile: true }} className="hover:underline">
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className="hover:underline">
      {content}
    </button>
  );
}

/* ----------------------------------------------------------------- Geniş ekran sol sütun */

function SideCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-extrabold text-gray-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// "Intro": biyografi, okul, bölüm, katılma tarihi, toplam beğeni / indirme.
function IntroCard({ profile }: { profile: ProfileData }) {
  const { user, stats, isMe } = profile;
  return (
    <SideCard title="Intro">
      {user.bio ? (
        <p className="mb-2 whitespace-pre-line break-words border-b border-gray-200 pb-3 text-center text-sm leading-5 text-gray-700">
          {user.bio}
        </p>
      ) : (
        isMe && (
          <Link
            to="/settings/profile"
            className="mb-2 flex h-9 items-center justify-center gap-1.5 rounded-lg bg-navy-100 text-[13px] font-bold text-gray-900 hover:bg-navy-200"
          >
            <Plus size={15} /> Add a short bio
          </Link>
        )
      )}
      <IntroRow icon={Award} label="Studies at" value={user.university} />
      <IntroRow icon={Monitor} label="Department" value={user.department} />
      <IntroRow icon={Calendar} label="Joined" value={formatDate(user.createdAt)} />
      <IntroRow icon={Heart} label="Likes received" value={formatCount(stats.totalLikes)} />
      <IntroRow icon={Download} label="Downloads" value={formatCount(stats.totalDownloads)} />
    </SideCard>
  );
}

function IntroRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon size={18} className="shrink-0 text-gray-400" />
      <p className="min-w-0 text-sm text-gray-600 break-words">
        {label} {value ? <b className="font-bold text-gray-900">{value}</b> : <span className="text-gray-400">—</span>}
      </p>
    </div>
  );
}

const SIDE_COURSES = 6;

// Paylaşılan dersler; satıra basınca Notes sekmesi o dersle açılır.
function CoursesCard({ userId, onCourse }: { userId: string; onCourse: (code: string) => void }) {
  const courses = useGetUserCoursesQuery(userId).data?.data?.courses ?? [];
  const [expanded, setExpanded] = useState(false);
  if (!courses.length) return null;
  const visible = expanded ? courses : courses.slice(0, SIDE_COURSES);
  return (
    <SideCard
      title="Courses shared"
      action={
        courses.length > SIDE_COURSES && (
          <button type="button" onClick={() => setExpanded((e) => !e)} className="text-sm font-bold text-navy-700 hover:text-navy-800">
            {expanded ? 'Show less' : 'See all'}
          </button>
        )
      }
    >
      <ul className="-mx-2">
        {visible.map((c) => (
          <li key={c.code}>
            <button
              type="button"
              onClick={() => onCourse(c.code)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
                <FileText size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-gray-900">{c.code}</span>
                {c.name && c.name !== c.code && <span className="block truncate text-xs text-gray-500">{c.name}</span>}
              </span>
              <span className="shrink-0 text-xs text-gray-500">
                {c.count} {c.count === 1 ? 'note' : 'notes'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </SideCard>
  );
}

const SIDE_GROUPS = 5;

// Kendi profilimde üyesi olduğum gruplar (ilk 5); "See all" Groups sekmesini açar.
// Başkasının grupları için sunucuda uç nokta yok, bu yüzden kart sadece kendi profilimde görünür.
function GroupsCard({ onSeeAll }: { onSeeAll: () => void }) {
  const { data } = useGetMyGroupsQuery({ limit: SIDE_GROUPS });
  const groups = data?.data?.items ?? [];
  const total = data?.data?.pagination?.total ?? groups.length;
  if (!groups.length) return null;
  return (
    <SideCard
      title="Groups"
      action={
        total > SIDE_GROUPS && (
          <button type="button" onClick={onSeeAll} className="text-sm font-bold text-navy-700 hover:text-navy-800">
            See all
          </button>
        )
      }
    >
      <p className="-mt-2 mb-2 text-sm text-gray-500">{pluralize(total, 'group')}</p>
      <ul className="-mx-2">
        {groups.map((g) => (
          <li key={g._id}>
            <Link to={`/groups/${g._id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
              <GroupIcon name={g.name} color={g.color} courseCode={g.courseCode} avatarUrl={g.avatarUrl} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-gray-900">{g.name}</span>
                <span className="block truncate text-xs text-gray-500">
                  {pluralize(g.membersCount, 'member')} · {pluralize(g.notesCount, 'note')}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </SideCard>
  );
}

const SIDE_POPULAR = 3;

// Başkasının profilinde: en çok beğenilen notları (sağ sütun en yeniden sıralı; burada "en iyileri").
// Hiç beğeni almış notu yoksa kart görünmez.
function PopularNotesCard({ userId }: { userId: string }) {
  const { data } = useGetUserNotesQuery({ id: userId, sort: 'popular', page: 1, limit: SIDE_POPULAR });
  const notes = (data?.data?.items ?? []).filter((n) => n.likesCount > 0);
  if (!notes.length) return null;
  return (
    <SideCard title="Popular notes">
      <ul className="-mx-2">
        {notes.map((n) => {
          const { icon: Icon, badge } = FILE_TYPES[n.fileType] ?? FILE_TYPES.pdf;
          return (
            <li key={n._id}>
              <Link to={`/notes/${n._id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${badge}`}>
                  <Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-gray-900">{n.title}</span>
                  <span className="flex items-center gap-2.5 text-xs text-gray-500">
                    {n.courseCode && <span className="truncate font-semibold">{n.courseCode}</span>}
                    <span className="inline-flex shrink-0 items-center gap-1">
                      <Heart size={12} /> {formatCount(n.likesCount)}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1">
                      <Download size={12} /> {formatCount(n.downloadsCount)}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </SideCard>
  );
}

// Sayı üstte kalın, etiket altta gri. to: takipçi / takip edilen listesi; onClick: Notes sekmesi.
function Stat({ value, label, to, onClick }: { value: number; label: string; to?: string; onClick?: () => void }) {
  // Açık sekme (?tab=...) korunur: pencere kapanınca profil aynı yerde kalır.
  const { search } = useLocation();
  const className = 'flex min-w-[60px] flex-col items-center hover:opacity-70 transition-opacity';
  const content = (
    <>
      <span className="text-[22px] font-extrabold leading-tight text-gray-900">{formatCount(value)}</span>
      <span className="text-sm text-gray-500">{label}</span>
    </>
  );
  return to ? (
    <Link to={`${to}${search}`} state={{ fromProfile: true }} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

// Kendi profilimde: telefonda paylaşım penceresi, masaüstünde bağlantıyı kopyalar.
function ShareProfileButton({ userId, name, className = '' }: { userId: string; name: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}/users/${userId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} on SearchNote`, url });
      } catch {
        // Kullanıcı paylaşım penceresini kapattı.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };
  return (
    <button type="button" onClick={share} className={`${SOFT_BUTTON} ${className}`}>
      {copied ? <Check size={14} className="text-emerald-600" /> : <Share2 size={14} />}
      {copied ? 'Link copied' : 'Share profile'}
    </button>
  );
}

// Başka birinin profilindeki "⋯" menüsü: profil bağlantısını kopyala, şikâyet et, engelle / engeli kaldır.
function ProfileMenu({ userId, name, isBlocked }: { userId: string; name: string; isBlocked: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/users/${userId}`);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1000);
    } catch {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="More options" className={SQUARE_BUTTON}>
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="sheet-up absolute right-0 top-full mt-1.5 z-20 w-60 rounded-2xl bg-white shadow-xl ring-1 ring-black/5 py-1.5">
            <button
              type="button"
              onClick={copyLink}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              {copied ? <Check size={15} className="text-emerald-600" /> : <LinkIcon size={15} />}
              {copied ? 'Link copied' : 'Copy profile link'}
            </button>
            <div className="my-1 border-t border-gray-100" />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setReportOpen(true);
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              <Flag size={15} className="shrink-0" />
              <span className="truncate">Report {name}</span>
            </button>
            <BlockButton userId={userId} isBlocked={isBlocked} name={name} variant="menu" onDone={() => setOpen(false)} />
          </div>
        </>
      )}
      {reportOpen && (
        <ReportModal user={{ id: userId, fullName: name }} isBlocked={isBlocked} onClose={() => setReportOpen(false)} />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- "About" penceresi */

// "At a glance" → "See all": istatistikler, okul bilgileri ve paylaşılan derslerin tam listesi.
// Derse basınca pencere kapanır ve Notes sekmesi o dersle açılır.
function AboutModal({ profile, onCourse, onClose }: { profile: ProfileData; onCourse: (code: string) => void; onClose: () => void }) {
  const { user, stats } = profile;
  const courses = useGetUserCoursesQuery(user.id).data?.data?.courses ?? [];
  return (
    <Modal title={`About ${user.fullName}`} onClose={onClose}>
      <div className="space-y-5 p-5">
        <div className="grid grid-cols-3 gap-2.5">
          <StatTile icon={FileText} value={stats.notesCount} label="Notes" />
          <StatTile icon={Heart} value={stats.totalLikes} label="Likes" />
          <StatTile icon={Download} value={stats.totalDownloads} label="Downloads" />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4">
          <InfoRow icon={Award} label="Studies at" value={user.university} />
          <InfoRow icon={Monitor} label="Department" value={user.department} />
          <InfoRow icon={Calendar} label="Joined" value={formatDate(user.createdAt)} last />
        </div>
        <div>
          <h3 className="text-[15px] font-extrabold text-gray-900">Courses shared</h3>
          <p className="mt-0.5 text-xs text-gray-500">Courses with at least one note shared. Updated automatically.</p>
          {courses.length ? (
            <ul className="mt-3 rounded-xl border border-gray-200 bg-white px-4">
              {courses.map((c, i) => (
                <CourseRow key={c.code} course={c} last={i === courses.length - 1} onClick={() => onCourse(c.code)} />
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-gray-500">No notes shared yet.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function StatTile({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white py-3">
      <Icon size={17} className="text-navy-600" />
      <span className="mt-1 text-lg font-extrabold text-gray-900">{formatCount(value)}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, last }: { icon: LucideIcon; label: string; value?: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-3 ${last ? '' : 'border-b border-gray-200'}`}>
      <Icon size={17} className="shrink-0 text-gray-500" />
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`ml-auto min-w-0 text-right text-sm break-words ${value ? 'font-bold text-gray-900' : 'text-gray-400'}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function CourseRow({ course, last, onClick }: { course: UserCourse; last: boolean; onClick: () => void }) {
  return (
    <li className={last ? '' : 'border-b border-gray-200'}>
      <button type="button" onClick={onClick} className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-gray-900">{course.code}</span>
          {course.name && course.name !== course.code && <span className="block truncate text-xs text-gray-500">{course.name}</span>}
        </span>
        <span className="shrink-0 rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-semibold text-navy-700">
          {course.count} {course.count === 1 ? 'note' : 'notes'}
        </span>
      </button>
    </li>
  );
}

/* ----------------------------------------------------------------- Sekmeler */

function NoteCards({ notes, isLoading, empty, preview = false }: { notes?: NoteCard[]; isLoading: boolean; empty: ReactNode; preview?: boolean }) {
  if (isLoading) return <Spinner />;
  if (!notes?.length) return <>{empty}</>;
  return (
    <div className={GRID}>
      {notes.map((n, i) => (
        // "All" önizlemesinde telefonda 2 satır = 4 kart
        <div key={n._id} className={`flex ${preview && i >= 4 ? 'max-sm:hidden' : ''}`}>
          <NoteGridCard note={n} />
        </div>
      ))}
    </div>
  );
}

// "All": "At a glance" kartı (beğeni / indirme, okul, bölüm, katılma tarihi, dersler) + son notlar.
// Telefonda geniş ekranın sol sütunundaki kartların (Intro, Courses shared, Groups / Popular notes) hepsi burada.
function AllTab({
  profile,
  onSeeAbout,
  onNotes,
  onCourse,
  onGroups,
}: {
  profile: ProfileData;
  onSeeAbout: () => void;
  onNotes: () => void;
  onCourse: (code: string) => void;
  onGroups: () => void;
}) {
  const { user, stats, isMe } = profile;
  const courses = useGetUserCoursesQuery(user.id).data?.data?.courses ?? [];
  const notes = useGetUserNotesQuery({ id: user.id, sort: 'newest', page: 1, limit: PREVIEW_COUNT });

  return (
    <>
      {/* Geniş ekranda bu bilgiler soldaki "Intro" ve "Courses shared" kartlarında. */}
      <section className="rounded-2xl border border-gray-200 bg-white px-4 pt-4 pb-1 lg:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold text-gray-900">At a glance</h2>
          <button type="button" onClick={onSeeAbout} className="text-sm font-bold text-navy-700 hover:text-navy-800">
            See all
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <GlanceTile icon={Heart} value={stats.totalLikes} label="Likes received" />
          <GlanceTile icon={Download} value={stats.totalDownloads} label="Downloads" />
        </div>
        <GlanceRow icon={Award} label="Studies at" value={user.university} />
        <GlanceRow icon={Monitor} label="Department" value={user.department} />
        <GlanceRow icon={Calendar} label="Joined" value={formatDate(user.createdAt)} last={!courses.length} />
        {courses.length > 0 && (
          <div className="py-3">
            <p className="flex items-center gap-3 text-sm text-gray-600">
              <FileText size={17} className="shrink-0 text-gray-500" /> Courses shared
            </p>
            {/* Derse basınca Notes sekmesi o dersle açılır (geniş ekrandaki "Courses shared" kartı gibi). */}
            <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4">
              {courses.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => onCourse(c.code)}
                  className="h-[30px] shrink-0 whitespace-nowrap rounded-full bg-navy-50 px-3 text-[13px] font-bold text-navy-700 hover:bg-navy-100"
                >
                  {c.code} <span className="font-semibold text-navy-500">· {c.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="mt-6 mb-3 flex items-center justify-between lg:mt-0">
        <h2 className="text-[17px] font-extrabold text-gray-900">Notes</h2>
        {stats.notesCount > 0 && (
          <button type="button" onClick={onNotes} className="text-sm font-bold text-navy-700 hover:text-navy-800">
            See all
          </button>
        )}
      </div>
      <NoteCards notes={notes.data?.data?.items} isLoading={notes.isLoading} empty={<NotesEmpty isMe={isMe} />} preview />

      {/* Geniş ekranın sol sütunundaki son kart: kendi profilimde gruplarım, başkasınınkinde en beğenilen notları. */}
      <div className="mt-6 lg:hidden">
        {isMe ? <GroupsCard onSeeAll={onGroups} /> : <PopularNotesCard userId={user.id} />}
      </div>
    </>
  );
}

function GlanceTile({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-navy-50/60 px-3 py-2.5">
      <Icon size={17} className="shrink-0 text-navy-600" />
      <span className="min-w-0">
        <span className="block text-[17px] font-extrabold leading-tight text-gray-900">{formatCount(value)}</span>
        <span className="block truncate text-xs text-gray-500">{label}</span>
      </span>
    </div>
  );
}

function GlanceRow({ icon: Icon, label, value, last }: { icon: LucideIcon; label: string; value?: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-3 ${last ? '' : 'border-b border-gray-200'}`}>
      <Icon size={17} className="shrink-0 text-gray-500" />
      <p className="min-w-0 text-sm text-gray-600 break-words">
        {label}: {value ? <b className="font-bold text-gray-900">{value}</b> : <span className="text-gray-400">—</span>}
      </p>
    </div>
  );
}

function NotesEmpty({ isMe, course }: { isMe: boolean; course?: string }) {
  if (course) return <EmptyState icon={FileText} title="No notes for this course" />;
  return (
    <EmptyState
      icon={FileText}
      title="No notes yet"
      text={isMe ? 'Notes you upload will show up here.' : "This user hasn't shared any notes yet."}
      action={
        isMe && (
          <Link to="/upload" className="btn-primary">
            <Upload size={16} /> Upload a note
          </Link>
        )
      }
    />
  );
}

// Notes: arama + sıralama + (birden fazla ders varsa) ders filtresi + sayfalı not kartları.
function NotesTab({ userId, isMe, total }: { userId: string; isMe: boolean; total: number }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const sort = searchParams.get('sort') || 'newest';
  const course = searchParams.get('course') ?? '';
  const q = searchParams.get('q') ?? '';
  const page = Number(searchParams.get('page')) || 1;
  // Sunucudaki arama kelime bazlı (her kelime bir alanda geçmeli): ders kodu aramaya bir kelime olarak eklenir.
  const query = [course, q].filter(Boolean).join(' ');
  const notes = useGetUserNotesQuery({ id: userId, sort, page, limit: PAGE_SIZE, q: query || undefined });
  const courseCodes = useGetUserCoursesQuery(userId).data?.data?.courses.map((c) => c.code) ?? [];

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'notes');
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes)) next.delete('page');
    setSearchParams(next);
  };

  return (
    <>
      {total > 1 && (
        <div className="-mt-2 mb-4 space-y-2">
          <NotesSearch value={q} onSearch={(value) => update({ q: value })} />
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Sort notes">
            {SORTS.map((s) => (
              <FilterPill key={s.key} active={sort === s.key} onClick={() => update({ sort: s.key === 'newest' ? '' : s.key })}>
                {s.label}
              </FilterPill>
            ))}
          </div>
          {courseCodes.length > 1 && (
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Filter by course">
              <FilterPill active={!course} onClick={() => update({ course: '' })}>
                All courses
              </FilterPill>
              {courseCodes.map((c) => (
                <FilterPill key={c} active={course === c} onClick={() => update({ course: course === c ? '' : c })}>
                  {c}
                </FilterPill>
              ))}
            </div>
          )}
        </div>
      )}
      <NoteCards
        notes={notes.data?.data?.items}
        isLoading={notes.isLoading}
        empty={q ? <EmptyState icon={Search} title="No matching notes" text="Try a different keyword." /> : <NotesEmpty isMe={isMe} course={course} />}
      />
      <Pagination
        pagination={notes.data?.data?.pagination}
        onPageChange={(p) => {
          update({ page: p > 1 ? String(p) : '' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </>
  );
}

// Başlık / ders / hoca adında arama; Enter ile uygulanır, adresteki q değişirse (geri tuşu) kutu senkronlanır.
function NotesSearch({ value, onSearch }: { value: string; onSearch: (value: string) => void }) {
  const [text, setText] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText(value);
  }
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(text.trim());
      }}
    >
      <label className="relative block">
        <span className="sr-only">Search notes</span>
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // Kutudaki çarpıyla temizlenince arama da kalkar.
            if (!e.target.value && value) onSearch('');
          }}
          placeholder="Search by title, course or instructor..."
          className="h-10 w-full rounded-full border border-gray-200 bg-white pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100"
        />
      </label>
    </form>
  );
}

function SavedTab() {
  const [page, setPage] = useState(1);
  const saved = useGetSavedNotesQuery({ page, limit: PAGE_SIZE });
  return (
    <>
      <NoteCards
        notes={saved.data?.data?.items}
        isLoading={saved.isLoading}
        empty={<EmptyState icon={FileText} title="No saved notes" text="Tap the bookmark icon on any note to keep it here for later." />}
      />
      <Pagination pagination={saved.data?.data?.pagination} onPageChange={setPage} />
    </>
  );
}

function GroupsTab() {
  const activity = useGetMyGroupActivityQuery();
  const groups = activity.data?.data?.groups;
  if (activity.isLoading) return <Spinner />;
  if (!groups?.length) {
    return (
      <EmptyState
        icon={Users}
        title="No groups yet"
        text="Groups you join or create will show up here."
        action={
          <Link to="/groups?tab=explore" className="btn-primary">
            Discover groups
          </Link>
        }
      />
    );
  }
  return (
    <div className="card divide-y divide-gray-100 overflow-hidden">
      {groups.map((g) => (
        <GroupActivityRow key={g._id} group={g} />
      ))}
    </div>
  );
}

// Küçük filtre hapı: seçili olan lacivert yazı + ince lacivert çerçeve (mobildeki gibi).
function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-[30px] shrink-0 whitespace-nowrap rounded-full border bg-white px-3 text-[13px] transition-colors ${
        active ? 'border-navy-700 font-bold text-navy-700' : 'border-gray-200 font-semibold text-gray-600 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}
