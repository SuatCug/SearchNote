import { Link } from 'react-router-dom';
import { Crown, FileText, Lock, MessageCircle, ShieldCheck } from 'lucide-react';
import GroupIcon from './GroupIcon';
import FavoriteButton from './FavoriteButton';
import { formatCount } from '@/lib/format';
import { listTime } from '@/lib/chatTime';
import { groupTitle } from '@/lib/groupStyle';
import type { GroupActivity } from '@/types/api';

// "Gruplarım"ın geniş ekran kartı: Explore kartlarıyla aynı ızgara ve kart dili, ama içerik GroupActivityRow'daki
// gibi hareket odaklı: okunmamış sayısı ikonun köşesinde, son mesaj / son not ve saati kartın altında.
// Tıklayınca grubun Notes sekmesi açılır (okunmamış rozeti sohbet sekmesinde de görünür). Telefonda satır listesi kullanılır.
export default function GroupActivityCard({ group, index = 0 }: { group: GroupActivity; index?: number }) {
  const last = group.lastActivity;
  const unread = group.unreadCount > 0;
  const who = last ? (last.isMine ? 'You' : (last.userName?.split(' ')[0] ?? 'Someone')) : '';

  return (
    <article
      className={`card card-enter relative flex min-w-0 flex-col p-5 transition-all hover:shadow-md ${
        unread ? 'border-navy-200 hover:border-navy-300' : 'hover:border-navy-100'
      }`}
      style={{ animationDelay: `${Math.min(index, 12) * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="relative">
          <GroupIcon name={group.name} color={group.color} courseCode={group.courseCode} avatarUrl={group.avatarUrl} />
          {unread && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-navy-800 px-1 text-[11px] font-bold text-white ring-2 ring-white">
              {group.unreadCount}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          {group.isOwner && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
              <Crown size={11} /> Founder
            </span>
          )}
          {group.isAdmin && !group.isOwner && (
            <span className="inline-flex items-center gap-1 rounded-md bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-700">
              <ShieldCheck size={11} /> Admin
            </span>
          )}
          {group.isPrivate && (
            <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
              <Lock size={11} /> Private
            </span>
          )}
          <FavoriteButton groupId={group._id} isFavorite={Boolean(group.isFavorite)} className="-mr-1.5 -my-1" />
        </span>
      </div>

      <h3
        className={`mt-3 line-clamp-2 break-words text-base leading-snug ${
          unread ? 'font-bold text-gray-900' : 'font-semibold text-gray-900'
        }`}
      >
        {/* Kartın tamamını tıklanabilir yapan bağlantı */}
        <Link
          to={`/groups/${group._id}`}
          className="after:absolute after:inset-0 after:rounded-xl"
        >
          {groupTitle(group.name, group.courseCode)}
        </Link>
      </h3>
      <p className="mt-0.5 text-xs text-gray-400">
        {formatCount(group.membersCount)} members · {formatCount(group.notesCount)} notes
      </p>

      <div className="min-h-4 flex-1" />

      {/* Son hareket: mesajsa "Ayşe: …", notsa "Latest note: …" */}
      <div
        className={`mt-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
          unread ? 'bg-navy-50 font-semibold text-gray-800' : 'bg-gray-50 text-gray-500'
        }`}
      >
        {last?.type === 'note' ? (
          <FileText size={15} className="mt-0.5 shrink-0 text-gray-400" />
        ) : (
          <MessageCircle size={15} className="mt-0.5 shrink-0 text-gray-400" />
        )}
        <span className="min-w-0 flex-1 line-clamp-2 break-words">
          {!last ? 'No activity yet' : last.type === 'note' ? `Latest note: ${last.text}` : `${who}: ${last.text}`}
        </span>
        {last && <span className="shrink-0 text-xs font-normal text-gray-400">{listTime(last.createdAt)}</span>}
      </div>
    </article>
  );
}
