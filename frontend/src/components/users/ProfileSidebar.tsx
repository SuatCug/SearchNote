import { Link } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Heart, Pencil, Upload, Users, type LucideIcon } from 'lucide-react';
import UserAvatar from './UserAvatar';
import FollowButton from './FollowButton';
import MessageButton from '@/components/messages/MessageButton';
import { formatCount, formatDate } from '@/lib/format';
import type { ProfileData } from '@/types/api';

// Kullanıcının alt sayfalarındaki (tüm notlar, takipçiler, takip edilenler) sol panel.
// profile: GET /users/:id cevabındaki data ({ user, stats, isFollowing, isMe }).
export default function ProfileSidebar({ profile }: { profile: ProfileData }) {
  const { user, stats, isFollowing, isBlocked, isMe } = profile;

  return (
    <aside className="card p-6 lg:sticky lg:top-24">
      <div className="flex flex-col items-center text-center">
        <UserAvatar user={user} size="card" square />
        <h1 className="mt-4 text-lg font-bold text-gray-900 break-words">{user.fullName}</h1>
        <p className="mt-0.5 text-sm text-gray-600">{user.university}</p>
        <p className="text-sm text-gray-600">{user.department}</p>
        {user.bio && <p className="mt-3 text-sm text-gray-700 whitespace-pre-line break-words">{user.bio}</p>}
        <p className="mt-2 text-xs text-gray-400">Member since {formatDate(user.createdAt)}</p>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-2">
        <SideStat icon={FileText} label="Notes" value={stats.notesCount} to={`/users/${user.id}/notes`} />
        <SideStat icon={Heart} label="Likes" value={stats.totalLikes} />
        <SideStat icon={Users} label="Followers" value={user.followersCount} to={`/users/${user.id}/followers`} />
        <SideStat icon={Users} label="Following" value={user.followingCount} to={`/users/${user.id}/following`} />
        <SideStat icon={Download} label="Downloads" value={stats.totalDownloads} wide />
      </dl>

      <div className="mt-5 grid gap-2">
        {isMe ? (
          <>
            <Link to="/upload" className="btn-primary">
              <Upload size={16} /> Upload a note
            </Link>
            <Link to="/settings/profile" className="btn-secondary">
              <Pencil size={15} /> Edit Profile
            </Link>
          </>
        ) : (
          !isBlocked && (
            <div className="grid grid-cols-2 gap-2">
              <FollowButton userId={user.id} isFollowing={isFollowing} name={user.fullName} />
              <MessageButton userId={user.id} />
            </div>
          )
        )}
        <Link
          to={`/users/${user.id}`}
          className="inline-flex items-center justify-center gap-1.5 py-2 text-sm font-semibold text-navy-600 hover:text-navy-800"
        >
          <ArrowLeft size={15} /> Back to profile
        </Link>
      </div>
    </aside>
  );
}

// to verilirse istatistik kutusu ilgili alt sayfaya bağlantı olur.
interface SideStatProps {
  icon: LucideIcon;
  label: string;
  value: number;
  to?: string;
  wide?: boolean;
}

function SideStat({ icon: Icon, label, value, to, wide = false }: SideStatProps) {
  const content = (
    <>
      <dt className="flex items-center gap-1 text-[11px] text-gray-500">
        <Icon size={12} /> {label}
      </dt>
      <dd className="text-base font-bold text-gray-900">{formatCount(value)}</dd>
    </>
  );
  const className = `rounded-lg bg-gray-50 px-3 py-2.5 ${wide ? 'col-span-2' : ''}`;

  return to ? (
    <Link to={to} className={`${className} block hover:bg-navy-50 transition-colors`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
