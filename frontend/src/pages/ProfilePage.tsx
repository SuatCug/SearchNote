import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { ArrowRight, Ban, Check, Flag, Link as LinkIcon, MoreHorizontal, Pencil, Upload } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Spinner from '@/components/common/Spinner';
import EmptyState from '@/components/common/EmptyState';
import NoteGrid from '@/components/notes/NoteGrid';
import UserAvatar from '@/components/users/UserAvatar';
import FollowButton from '@/components/users/FollowButton';
import BlockButton from '@/components/users/BlockButton';
import MessageButton from '@/components/messages/MessageButton';
import UserList from '@/components/users/UserList';
import MutualFollowers from '@/components/users/MutualFollowers';
import CoursesShared from '@/components/users/CoursesShared';
import ReportModal from '@/components/users/ReportModal';
import {
  useGetFollowersQuery,
  useGetFollowingQuery,
  useGetProfileQuery,
  useGetUserNotesQuery,
} from '@/services/usersApi';
import { formatCount, formatDate } from '@/lib/format';

// Notlar sekmesinde bu kadar not gösterilir; fazlası "See all" ile kullanıcının not sayfasında (/users/:id/notes) listelenir.
const NOTES_PREVIEW = 3;
// Takipçi / takip edilen listelerinde gösterilen kişi sayısı; fazlası /users/:id/followers|following sayfasında.
const USERS_PREVIEW = 5;

export default function ProfilePage() {
  const { id = '' } = useParams();
  const token = useAppSelector((state) => state.auth.token);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'notes';

  const { data, isLoading, error } = useGetProfileQuery(id);
  const notes = useGetUserNotesQuery({ id, limit: NOTES_PREVIEW }, { skip: tab !== 'notes' });
  const notesTotal = notes.data?.data?.pagination?.total ?? 0;
  const followers = useGetFollowersQuery(id, { skip: tab !== 'followers' });
  const following = useGetFollowingQuery(id, { skip: tab !== 'following' });

  if (isLoading) return <PageLayout><Spinner /></PageLayout>;
  if (error || !data) {
    return (
      <PageLayout narrow>
        <EmptyState title="User not found" action={<Link to="/" className="btn-primary">Back to home</Link>} />
      </PageLayout>
    );
  }

  const { user, stats, isFollowing, isBlocked, isMe } = data.data;

  const tabs = [
    { key: 'notes', label: 'Notes', count: stats.notesCount },
    { key: 'followers', label: 'Followers', count: user.followersCount },
    { key: 'following', label: 'Following', count: user.followingCount },
  ];

  return (
    <PageLayout>
      <section className="card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <UserAvatar user={user} size="xl" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900 break-words">{user.fullName}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {user.university} · {user.department}
            </p>
            {user.bio && <p className="mt-3 text-[15px] text-gray-700 whitespace-pre-line break-words">{user.bio}</p>}
            <p className="mt-2 text-xs text-gray-400">Member since {formatDate(user.createdAt)}</p>
            {token && !isMe && <MutualFollowers userId={user.id} />}
          </div>
          <div className="shrink-0">
            {isMe ? (
              <Link to="/profile/edit" className="btn-secondary">
                <Pencil size={15} /> Edit Profile
              </Link>
            ) : (
              // Telefonda Follow / Message satırı tam genişlik kaplar, "⋯" sağda sabit kalır.
              <div className="flex items-center justify-end gap-2">
                {!isBlocked && (
                  <div className="grid flex-1 grid-cols-2 gap-2 sm:flex sm:flex-none">
                    <FollowButton userId={user.id} isFollowing={isFollowing} name={user.fullName} />
                    <MessageButton userId={user.id} />
                  </div>
                )}
                {token && <ProfileMenu userId={user.id} name={user.fullName} isBlocked={isBlocked} />}
              </div>
            )}
          </div>
        </div>

        {isBlocked && !isMe && (
          // Telefonda ikon + yazı üstte, "Unblock" altta tam genişlik; geniş ekranda hepsi tek satır.
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-rose-100 bg-rose-50/70 px-4 py-3.5">
            <div className="flex min-w-0 flex-1 items-start sm:items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <Ban size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 break-words">You blocked {user.fullName}</p>
                <p className="text-[13px] text-gray-600">
                  You can't follow or message each other. Unblock to interact again.
                </p>
              </div>
            </div>
            <BlockButton userId={user.id} isBlocked name={user.fullName} variant="button" className="w-full sm:w-auto shrink-0" />
          </div>
        )}

        <dl className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <ProfileStat label="Notes" value={stats.notesCount} />
          <ProfileStat label="Total likes" value={stats.totalLikes} />
          <ProfileStat label="Total downloads" value={stats.totalDownloads} wideOnMobile />
          <ProfileStat label="Followers" value={user.followersCount} to={`/users/${user.id}/followers`} />
          <ProfileStat label="Following" value={user.followingCount} to={`/users/${user.id}/following`} />
        </dl>

        <CoursesShared userId={user.id} />
      </section>

      <div className="mt-8 border-b border-gray-200 flex gap-6 overflow-x-auto" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setSearchParams(t.key === 'notes' ? {} : { tab: t.key })}
            className={`pb-3 -mb-px border-b-2 text-sm font-semibold whitespace-nowrap transition-colors ${
              tab === t.key ? 'border-navy-600 text-navy-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label} <span className="font-normal text-gray-400">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'notes' && (
          <>
            <NoteGrid
              notes={notes.data?.data?.items}
              isLoading={notes.isLoading}
              emptyTitle={isMe ? "You haven't shared any notes yet" : 'No notes shared yet'}
              emptyAction={
                isMe && (
                  <Link to="/upload" className="btn-primary">
                    <Upload size={16} /> Upload your first note
                  </Link>
                )
              }
            />
            {notesTotal > NOTES_PREVIEW && (
              <div className="mt-6 flex justify-center">
                <Link to={`/users/${id}/notes`} className="btn-secondary">
                  See all {notesTotal} notes <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </>
        )}
        {tab === 'followers' && (
          <UserList
            users={followers.data?.data?.users}
            isLoading={followers.isLoading}
            emptyTitle="No followers yet"
            previewCount={USERS_PREVIEW}
            seeAll={{ to: `/users/${id}/followers`, label: `See all ${user.followersCount} followers` }}
          />
        )}
        {tab === 'following' && (
          <UserList
            users={following.data?.data?.users}
            isLoading={following.isLoading}
            emptyTitle="Not following anyone yet"
            previewCount={USERS_PREVIEW}
            seeAll={{ to: `/users/${id}/following`, label: `See all ${user.followingCount} following` }}
          />
        )}
      </div>
    </PageLayout>
  );
}

// Başka birinin profilindeki "⋯" menüsü: profil bağlantısını kopyala, engelle / engeli kaldır.
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
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="More options"
        className="btn-secondary px-2.5"
      >
        <MoreHorizontal size={18} />
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

// to verilirse kutu ilgili listeye (takipçiler / takip edilenler) bağlantı olur.
// wideOnMobile: 2 sütunlu mobil ızgarada tam satır kaplar (5 kutu tek kalan olmadan dizilsin diye).
interface ProfileStatProps {
  label: string;
  value: number;
  to?: string;
  wideOnMobile?: boolean;
}

function ProfileStat({ label, value, to, wideOnMobile = false }: ProfileStatProps) {
  const className = `rounded-xl bg-gray-50 px-4 py-3 flex flex-col-reverse ${wideOnMobile ? 'col-span-2 sm:col-span-1' : ''}`;
  const content = (
    <>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-xl font-bold text-gray-900">{formatCount(value)}</dd>
    </>
  );

  return to ? (
    <Link to={to} className={`${className} hover:bg-navy-50 transition-colors`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
