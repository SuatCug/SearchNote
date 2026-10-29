import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import GroupIcon from '@/components/groups/GroupIcon';
import { useGetGroupQuery } from '@/services/groupsApi';
import { formatCount } from '@/lib/format';
import { groupTitle } from '@/lib/groupStyle';

// Mesajdaki grup bağlantısının önizlemesi (davetler, mobildeki GroupInviteCard gibi): grubun ikonu, adı,
// üye sayısı ve "View group". Tıklayınca grup sayfası açılır.
// inert: basılı tutma menüsündeki kopyada kart tıklanmaz.
export default function GroupInviteCard({ groupId, mine, inert = false }: { groupId: string; mine: boolean; inert?: boolean }) {
  const { data, isError } = useGetGroupQuery(groupId);
  const group = data?.data?.group;

  return (
    <Link
      to={`/groups/${groupId}`}
      tabIndex={inert ? -1 : undefined}
      onClick={(e) => (inert || isError) && e.preventDefault()}
      className={`mt-1.5 flex min-w-[230px] items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors ${
        mine ? 'bg-white/12 hover:bg-white/18' : 'bg-white hover:bg-navy-50'
      }`}
    >
      {group ? (
        <GroupIcon name={group.name} color={group.color} courseCode={group.courseCode} avatarUrl={group.avatarUrl} size="sm" />
      ) : (
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${mine ? 'bg-white/15 text-white' : 'bg-navy-50 text-navy-600'}`}
        >
          <Users size={17} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-semibold ${mine ? 'text-white' : 'text-gray-900'}`}>
          {group ? groupTitle(group.name, group.courseCode) : isError ? 'Group not available' : 'Loading group…'}
        </span>
        {group && (
          <span className={`block truncate text-xs ${mine ? 'text-white/70' : 'text-gray-500'}`}>
            {formatCount(group.membersCount)} members · {group.isPrivate ? 'Approval needed' : 'Open to everyone'}
          </span>
        )}
      </span>
      {group && (
        <span className={`shrink-0 text-[13px] font-bold ${mine ? 'text-white' : 'text-navy-600'}`}>
          {group.isMember ? 'Open' : 'View group'}
        </span>
      )}
    </Link>
  );
}
