import { Link } from 'react-router-dom';
import { Crown, FileText, Lock, Users } from 'lucide-react';
import UserAvatar from '@/components/users/UserAvatar';
import GroupIcon from './GroupIcon';
import FavoriteButton from './FavoriteButton';
import FollowedMembers from './FollowedMembers';
import { formatCount } from '@/lib/format';
import { lastSeenLabel } from '@/lib/chatTime';
import { groupTitle } from '@/lib/groupStyle';
import type { GroupCard as GroupCardData } from '@/types/api';

export default function GroupCard({ group, index = 0 }: { group: GroupCardData; index?: number }) {
  // "Orta Doğu Teknik Üniversitesi · Active 2 h ago"
  const meta = [group.university, group.lastActivityAt && lastSeenLabel(group.lastActivityAt)].filter(Boolean).join(' · ');
  return (
    <article
      className="card card-enter relative flex flex-col min-w-0 p-5 hover:shadow-md hover:border-navy-100 transition-all"
      style={{ animationDelay: `${Math.min(index, 12) * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <GroupIcon name={group.name} color={group.color} courseCode={group.courseCode} />
        <span className="flex items-center gap-1.5">
          {group.isPrivate && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md px-2 py-0.5">
              <Lock size={11} /> Private
            </span>
          )}
          {group.isMember && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-md px-2 py-0.5">Joined</span>
          )}
          {group.isPending && (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 rounded-md px-2 py-0.5">Requested</span>
          )}
          <FavoriteButton groupId={group._id} isFavorite={Boolean(group.isFavorite)} className="-mr-1.5 -my-1" />
        </span>
      </div>

      <h3 className="mt-3 text-base font-semibold text-gray-900 leading-snug line-clamp-2 break-words">
        {/* Kartın tamamını tıklanabilir yapan bağlantı */}
        <Link to={`/groups/${group._id}`} className="after:absolute after:inset-0 after:rounded-xl">
          {groupTitle(group.name, group.courseCode)}
        </Link>
      </h3>
      {meta && <p className="mt-0.5 text-xs text-gray-400 truncate">{meta}</p>}
      {group.description && <p className="mt-1 text-sm text-gray-500 line-clamp-2 break-words">{group.description}</p>}
      {group.lastNote && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 min-w-0">
          <FileText size={12} className="shrink-0 text-gray-400" />
          <span className="truncate">Latest: {group.lastNote.title}</span>
        </p>
      )}
      <FollowedMembers users={group.followedMembers} count={group.followedMembersCount} className="mt-3" />

      <div className="flex-1 min-h-4" />

      <div className="pt-4 flex items-center justify-between gap-2 border-t border-gray-100">
        <span className="flex items-center gap-2 min-w-0 text-gray-600" title="Founder">
          <UserAvatar user={group.owner} size="xs" />
          <span className="text-xs font-medium truncate">{group.owner?.fullName}</span>
          <Crown size={12} className="text-amber-500 shrink-0" />
        </span>

        <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
          <span className="flex items-center gap-1" title="Members">
            <Users size={14} />
            {formatCount(group.membersCount)}
          </span>
          <span className="flex items-center gap-1" title="Notes">
            <FileText size={14} />
            {formatCount(group.notesCount)}
          </span>
        </div>
      </div>
    </article>
  );
}
