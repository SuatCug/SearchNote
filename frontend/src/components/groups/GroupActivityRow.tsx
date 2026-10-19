import { Link } from 'react-router-dom';
import { ChevronRight, Lock, Star } from 'lucide-react';
import GroupIcon from './GroupIcon';
import { formatCount } from '@/lib/format';
import { listTime } from '@/lib/chatTime';
import { groupTitle } from '@/lib/groupStyle';
import type { GroupActivity } from '@/types/api';

// Üyesi olduğum grubun satırı (mobil "My groups" ile aynı): renkli kod ikonu (köşesinde okunmamış sayısı), ad,
// üye/not sayısı, son hareket ("Latest note: …" ya da "Ayşe: …") ve saati. Okunmamış varsa sohbet sekmesi açılır.
export default function GroupActivityRow({ group }: { group: GroupActivity }) {
  const last = group.lastActivity;
  const unread = group.unreadCount > 0;
  const who = last ? (last.isMine ? 'You' : (last.userName?.split(' ')[0] ?? 'Someone')) : '';
  const preview = !last ? 'No activity yet' : last.type === 'note' ? `Latest note: ${last.text}` : `${who}: ${last.text}`;

  return (
    <Link
      to={`/groups/${group._id}${unread || last?.type === 'message' ? '?tab=chat' : ''}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
    >
      <span className="relative shrink-0">
        <GroupIcon name={group.name} color={group.color} courseCode={group.courseCode} />
        {unread && (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-navy-800 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white">
            {group.unreadCount}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className={`truncate text-[15px] ${unread ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
            {groupTitle(group.name, group.courseCode)}
          </span>
          {group.isPrivate && <Lock size={12} className="shrink-0 text-gray-400" aria-label="Private" />}
          {group.isFavorite && <Star size={13} className="shrink-0 fill-amber-400 text-amber-400" aria-label="Favorite" />}
        </span>
        <span className="block text-xs text-gray-400 truncate">
          {formatCount(group.membersCount)} members · {formatCount(group.notesCount)} notes
        </span>
        <span className={`block text-sm truncate ${unread ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>
          {preview}
          {last && <span className="text-gray-400 font-normal"> · {listTime(last.createdAt)}</span>}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-gray-300" />
    </Link>
  );
}
