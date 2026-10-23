import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Check, CheckCheck, FileText, Lock, MessagesSquare, Search, SquarePen, Users } from 'lucide-react';
import ChatAvatar from './ChatAvatar';
import NewMessageModal from './NewMessageModal';
import Spinner from '@/components/common/Spinner';
import Alert from '@/components/common/Alert';
import { useGetMyGroupsQuery } from '@/services/groupsApi';
import { assetUrl } from '@/lib/assetUrl';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { listTime } from '@/lib/chatTime';
import { useTypingConversations } from '@/lib/socket';
import type { ConversationSummary, GroupCard } from '@/types/api';

type Filter = 'all' | 'unread' | 'groups';

interface ConversationListProps {
  conversations?: ConversationSummary[];
  isLoading: boolean;
  error?: unknown;
}

// Mesajlar sayfasının listesi: başlık + yeni mesaj, isimde arama, All / Unread / Groups filtreleri.
// Telefonda sayfanın kendisiyle birlikte kayar; büyük ekranda sol panelde kendi içinde kayar.
export default function ConversationList({ conversations, isLoading, error }: ConversationListProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [composeOpen, setComposeOpen] = useState(false);
  const typing = useTypingConversations();

  const term = search.trim().toLocaleLowerCase('tr');
  const unreadTotal = conversations?.filter((c) => c.unreadCount > 0).length ?? 0;
  const filtered = conversations?.filter(
    (c) =>
      (filter !== 'unread' || c.unreadCount > 0) &&
      (!term || c.otherUser?.fullName.toLocaleLowerCase('tr').includes(term))
  );

  const chips: { key: Filter; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread', count: unreadTotal },
    { key: 'groups', label: 'Groups' },
  ];

  return (
    <div className="flex flex-col lg:h-full lg:min-h-0">
      <div className="px-4 lg:px-5 pt-5 pb-3 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[28px] lg:text-2xl font-extrabold tracking-tight text-gray-900">Messages</h1>
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="w-11 h-11 rounded-xl bg-navy-50 text-navy-800 hover:bg-navy-100 active:bg-navy-100 flex items-center justify-center transition-colors"
            aria-label="New message"
            title="New message"
          >
            <SquarePen size={20} />
          </button>
        </div>

        <label className="relative block">
          <span className="sr-only">{filter === 'groups' ? 'Search groups' : 'Search conversations'}</span>
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="search"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            className="w-full h-11 rounded-xl border border-gray-300 bg-white pl-11 pr-4 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
          />
        </label>

        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0" role="tablist">
          {chips.map((chip) => {
            const active = filter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(chip.key)}
                className={`shrink-0 h-11 rounded-full px-5 text-sm font-semibold flex items-center gap-2 border transition-colors ${
                  active
                    ? 'bg-navy-800 border-navy-800 text-white'
                    : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
                }`}
              >
                {chip.label}
                {chip.count ? (
                  <span
                    className={`min-w-5 h-5 rounded-full px-1.5 text-xs font-semibold flex items-center justify-center ${
                      active ? 'bg-white/20 text-white' : 'bg-navy-50 text-navy-800'
                    }`}
                  >
                    {chip.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="lg:flex-1 lg:overflow-y-auto pb-4">
        {filter === 'groups' ? (
          <GroupChatList term={term} />
        ) : isLoading ? (
          <Spinner />
        ) : error ? (
          <Alert className="m-4">{getErrorMessage(error)}</Alert>
        ) : !filtered?.length ? (
          <EmptyList
            text={
              term
                ? 'No conversations match that name.'
                : filter === 'unread'
                  ? "You're all caught up."
                  : 'No messages yet. Tap the pen icon to start a conversation.'
            }
          />
        ) : (
          <ul>
            {filtered.map((c) => (
              <li key={c._id}>
                <ConversationItem conversation={c} typing={typing.has(c._id)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {composeOpen && <NewMessageModal onClose={() => setComposeOpen(false)} />}
    </div>
  );
}

function EmptyList({ text }: { text: string }) {
  return (
    <div className="px-6 py-14 text-center text-gray-400">
      <MessagesSquare size={28} className="mx-auto" />
      <p className="mt-2 text-sm">{text}</p>
    </div>
  );
}

function ConversationItem({ conversation: c, typing }: { conversation: ConversationSummary; typing: boolean }) {
  const unread = c.unreadCount > 0;
  const deleted = !c.otherUser;
  const preview = c.lastMessage.hasNote && !c.lastMessage.text ? 'Shared a note' : c.lastMessage.text;

  return (
    <NavLink
      to={`/messages/${c._id}`}
      className={({ isActive }) =>
        `flex items-center gap-3.5 px-4 lg:px-5 py-3 transition-colors ${
          isActive ? 'bg-navy-50' : 'hover:bg-gray-50 active:bg-gray-50'
        }`
      }
    >
      <ChatAvatar user={c.otherUser} online={c.isOnline} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-[15px] ${deleted ? 'text-gray-500 font-medium' : 'font-semibold text-gray-900'}`}>
            {c.otherUser?.fullName ?? 'Deleted user'}
          </span>
          <span className={`shrink-0 text-xs ${unread ? 'font-semibold text-navy-800' : 'text-gray-500'}`}>
            {listTime(c.lastMessage.createdAt)}
          </span>
        </span>
        <span className="mt-1 flex items-center justify-between gap-2">
          {typing ? (
            <span className="truncate text-sm font-semibold text-sky-700">typing...</span>
          ) : (
            <span
              className={`flex min-w-0 items-center gap-1 text-sm ${unread ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
            >
              {c.lastMessage.isMine &&
                (c.lastMessage.isRead ? (
                  <CheckCheck size={16} className="shrink-0 text-sky-600" aria-label="Seen" />
                ) : (
                  <Check size={16} className="shrink-0 text-gray-400" aria-label="Sent" />
                ))}
              {c.lastMessage.hasNote && <FileText size={14} className="shrink-0 text-gray-400" />}
              <span className="truncate">
                {c.lastMessage.isMine && 'You: '}
                {preview}
              </span>
            </span>
          )}
          {unread && (
            <span className="shrink-0 min-w-5 h-5 rounded-full bg-navy-800 px-1.5 text-[11px] font-bold text-white flex items-center justify-center">
              {c.unreadCount > 99 ? '99+' : c.unreadCount}
            </span>
          )}
        </span>
      </span>
    </NavLink>
  );
}

// "Groups" filtresi: üye olunan gruplar; tıklayınca grubun sohbet sekmesi açılır.
function GroupChatList({ term }: { term: string }) {
  const { data, isLoading, error } = useGetMyGroupsQuery({ limit: 50 });
  const groups = data?.data?.items?.filter((g) => !term || g.name.toLocaleLowerCase('tr').includes(term));

  if (isLoading) return <Spinner />;
  if (error) return <Alert className="m-4">{getErrorMessage(error)}</Alert>;
  if (!groups?.length) {
    return (
      <div className="px-6 py-14 text-center text-gray-400">
        <Users size={28} className="mx-auto" />
        <p className="mt-2 text-sm">{term ? 'No groups match that name.' : "You haven't joined any study groups yet."}</p>
        {!term && (
          <Link to="/groups" className="btn-secondary mt-4">
            Browse groups
          </Link>
        )}
      </div>
    );
  }

  return (
    <ul>
      {groups.map((g) => (
        <li key={g._id}>
          <GroupItem group={g} />
        </li>
      ))}
    </ul>
  );
}

function GroupItem({ group }: { group: GroupCard }) {
  const initials = group.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toLocaleUpperCase('tr'))
    .join('');

  return (
    <Link
      to={`/groups/${group._id}?tab=chat`}
      className="flex items-center gap-3.5 px-4 lg:px-5 py-3 hover:bg-gray-50 active:bg-gray-50 transition-colors"
    >
      {group.avatarUrl ? (
        <img src={assetUrl(group.avatarUrl)} alt="" className="w-[52px] h-[52px] shrink-0 rounded-2xl object-cover bg-gray-100" />
      ) : (
        <span className="w-[52px] h-[52px] shrink-0 rounded-2xl bg-navy-100 text-navy-800 font-bold flex items-center justify-center">
          {initials || <Users size={20} />}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[15px] font-semibold text-gray-900">
          <span className="truncate">{group.name}</span>
          {group.isPrivate && <Lock size={13} className="shrink-0 text-gray-400" aria-label="Private group" />}
        </span>
        <span className="mt-1 block truncate text-sm text-gray-600">
          {group.membersCount} {group.membersCount === 1 ? 'member' : 'members'} · Open group chat
        </span>
      </span>
    </Link>
  );
}
