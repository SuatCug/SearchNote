import { useEffect, useState } from 'react';
import { Check, Link as LinkIcon, Loader2, Search, UserPlus } from 'lucide-react';
import Modal from '@/components/common/Modal';
import UserAvatar from '@/components/users/UserAvatar';
import { useAppSelector } from '@/app/hooks';
import { useSearchUsersQuery } from '@/services/usersApi';
import { useGetConversationsQuery, useSendDirectMessageMutation, useStartConversationMutation } from '@/services/messagesApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { groupTitle } from '@/lib/groupStyle';
import type { GroupDetail, UserCard } from '@/types/api';

const MIN_QUERY = 2;

// Gruba davet (mobildeki "Invite"): grubun bağlantısı kişilere birebir mesaj olarak gönderilir.
// Arama yoksa son konuşulan kişiler listelenir; ayrıca bağlantı kopyalanabilir.
export default function InviteModal({ group, onClose }: { group: GroupDetail; onClose: () => void }) {
  const me = useAppSelector((state) => state.auth.user);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/groups/${group._id}`;
  const text = `Join "${groupTitle(group.name, group.courseCode)}" on SearchNote\n${url}`;

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const search = useSearchUsersQuery({ q: debounced, limit: 20 }, { skip: debounced.length < MIN_QUERY });
  const conversations = useGetConversationsQuery();
  const recent = (conversations.data?.data?.conversations ?? [])
    .map((c) => c.otherUser)
    .filter((u): u is UserCard => Boolean(u));
  const searching = debounced.length >= MIN_QUERY;
  const people = (searching ? (search.data?.data?.users ?? []) : recent).filter((u) => u._id !== me?.id);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  return (
    <Modal
      title={
        <>
          <UserPlus size={17} className="text-navy-600" /> Invite to {group.name}
        </>
      }
      onClose={onClose}
      footer={
        <button type="button" onClick={copyLink} className="btn-secondary w-full">
          {copied ? <Check size={16} className="text-emerald-600" /> : <LinkIcon size={16} />}
          {copied ? 'Link copied' : 'Copy group link'}
        </button>
      }
    >
      <div className="px-5 pt-4 pb-2">
        <label className="relative block">
          <span className="sr-only">Search people</span>
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, university..."
            className="form-input pl-11"
          />
        </label>
        {!searching && recent.length > 0 && (
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Recent</p>
        )}
      </div>
      <div className="px-2 pb-3 min-h-[200px]">
        {searching && search.isFetching && !people.length ? (
          <div className="flex justify-center py-10 text-gray-400">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : !people.length ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">
            {searching ? 'No people found.' : `Type at least ${MIN_QUERY} letters to find someone.`}
          </p>
        ) : (
          <ul>
            {people.map((u) => (
              <InviteRow key={u._id} user={u} text={text} />
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

// Tek kişi: "Send" → konuşmayı açar (yoksa oluşturur) ve davet mesajını gönderir; sonra "Sent" olur.
function InviteRow({ user, text }: { user: UserCard; text: string }) {
  const [startConversation] = useStartConversationMutation();
  const [sendMessage] = useSendDirectMessageMutation();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  const send = async () => {
    setState('sending');
    setError('');
    try {
      const { data } = await startConversation(user._id).unwrap();
      await sendMessage({ id: data.conversationId, text }).unwrap();
      setState('sent');
    } catch (err) {
      setError(getErrorMessage(err));
      setState('idle');
    }
  };

  return (
    <li className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50">
      <UserAvatar user={user} size="md" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-gray-900">{user.fullName}</span>
        <span className={`block truncate text-xs ${error ? 'text-rose-600' : 'text-gray-500'}`}>
          {error || [user.university, user.department].filter(Boolean).join(' · ')}
        </span>
      </span>
      <button
        type="button"
        onClick={send}
        disabled={state !== 'idle'}
        className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
          state === 'sent' ? 'bg-gray-100 text-gray-500' : 'bg-navy-900 text-white hover:bg-navy-950 disabled:opacity-60'
        }`}
      >
        {state === 'sent' ? 'Sent' : state === 'sending' ? 'Sending...' : 'Send'}
      </button>
    </li>
  );
}
