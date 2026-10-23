import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search } from 'lucide-react';
import ChatSheet from './ChatSheet';
import UserAvatar from '@/components/users/UserAvatar';
import Alert from '@/components/common/Alert';
import { useSearchUsersQuery } from '@/services/usersApi';
import { useStartConversationMutation } from '@/services/messagesApi';
import { useAppSelector } from '@/app/hooks';
import { getErrorMessage } from '@/lib/getErrorMessage';

const MIN_QUERY = 2;

// "Yeni mesaj": isimle kişi arayıp konuşmayı açar.
export default function NewMessageModal({ onClose }: { onClose: () => void }) {
  const me = useAppSelector((state) => state.auth.user);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [startConversation, { isLoading: starting, error: startError }] = useStartConversationMutation();

  // Her tuşta istek atmamak için kısa bir gecikme.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const search = useSearchUsersQuery({ q: debounced, limit: 20 }, { skip: debounced.length < MIN_QUERY });
  const users = search.data?.data?.users?.filter((u) => u._id !== me?.id);

  const open = async (userId: string) => {
    try {
      const { data } = await startConversation(userId).unwrap();
      onClose();
      navigate(`/messages/${data.conversationId}`);
    } catch {
      // Hata aşağıda gösterilir.
    }
  };

  return (
    <ChatSheet title="New message" onClose={onClose}>
      <div className="px-5 pb-3">
        <label className="relative block">
          <span className="sr-only">Search people</span>
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="search"
            autoComplete="off"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, university..."
            className="w-full h-11 rounded-xl border border-gray-300 bg-white pl-11 pr-4 text-[15px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
          />
        </label>
        {startError ? <Alert className="mt-3">{getErrorMessage(startError)}</Alert> : null}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-3 sm:min-h-[240px]">
        {debounced.length < MIN_QUERY ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">Type at least {MIN_QUERY} letters to find someone.</p>
        ) : search.isFetching && !users?.length ? (
          <div className="flex justify-center py-10 text-gray-400">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : search.error ? (
          <Alert className="mx-3">{getErrorMessage(search.error)}</Alert>
        ) : !users?.length ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">No people found.</p>
        ) : (
          <ul>
            {users.map((u) => (
              <li key={u._id}>
                <button
                  type="button"
                  disabled={starting}
                  onClick={() => open(u._id)}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-gray-50 active:bg-gray-100 disabled:opacity-60"
                >
                  <UserAvatar user={u} size="md" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-gray-900">{u.fullName}</span>
                    <span className="block truncate text-xs text-gray-500">
                      {[u.university, u.department].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ChatSheet>
  );
}
