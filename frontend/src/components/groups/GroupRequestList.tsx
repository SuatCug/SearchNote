import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserPlus } from 'lucide-react';
import UserAvatar from '@/components/users/UserAvatar';
import EmptyState from '@/components/common/EmptyState';
import Spinner from '@/components/common/Spinner';
import { useGetIncomingRequestsQuery, useRespondJoinRequestMutation } from '@/services/groupsApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { normalize } from '@/lib/schoolSearch';
import { timeAgo } from '@/lib/format';
import { useDialog } from '@/components/common/DialogProvider';

// Özel grubun bekleyen katılma istekleri (sadece kurucuya / yöneticilere gösterilir), istekle yazılan kısa notla birlikte.
// Kurucunun tüm gruplarına gelen istekler tek listede gelir; burada bu grubunkiler ayıklanır.
// Görünüm Members sekmesiyle aynı: tek panel, başlık + arama, altında satırlar.
export default function GroupRequestList({ groupId }: { groupId: string }) {
  const { data, isLoading } = useGetIncomingRequestsQuery();
  const [respond] = useRespondJoinRequestMutation();
  const requests = data?.data?.requests.filter((r) => r.group._id === groupId);
  const dialog = useDialog();
  const [query, setQuery] = useState('');

  if (isLoading) return <Spinner />;
  if (!requests?.length) {
    return <EmptyState icon={UserPlus} title="No pending requests" text="New join requests will show up here." />;
  }

  const handle = async (userId: string, approve: boolean) => {
    try {
      await respond({ id: groupId, userId, approve }).unwrap();
    } catch (err) {
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  const q = normalize(query.trim());
  const shown = q
    ? requests.filter(({ user: u }) =>
        [u.fullName, u.university, u.department].some((field) => field && normalize(field).includes(q))
      )
    : requests;

  return (
    <div className="card">
      <div className="px-4 pt-4 pb-3 sm:px-5">
        <h2 className="text-[17px] font-bold text-gray-900">
          Requests <span className="font-normal text-gray-500">· {requests.length}</span>
        </h2>
        <label className="mt-3 flex items-center gap-2 rounded-full bg-gray-100 px-3.5 py-2 focus-within:ring-2 focus-within:ring-navy-500">
          <Search size={16} className="shrink-0 text-gray-500" />
          <input
            id="group-request-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a request"
            className="w-full min-w-0 bg-transparent text-[15px] text-gray-900 placeholder-gray-500 focus:outline-none"
          />
        </label>
      </div>

      {shown.length ? (
        <section className="border-t border-gray-200 px-2 pt-3 pb-2 sm:px-3">
          {!q && (
            <div className="px-2 pb-1">
              <h3 className="text-[15px] font-semibold text-gray-900">Waiting for approval</h3>
              <p className="text-[13px] text-gray-500">Approved people join the group right away.</p>
            </div>
          )}
          <ul>
            {shown.map(({ user: u, message, createdAt }) => (
              <li key={u._id} className="rounded-lg px-2 py-2 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <Link to={`/users/${u._id}`} className="group flex min-w-0 flex-1 items-center gap-3">
                    <UserAvatar user={u} size="chat" />
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold text-gray-900 group-hover:underline">
                        {u.fullName}
                      </span>
                      <span className="block truncate text-[13px] text-gray-500">
                        {[u.university, u.department].filter(Boolean).join(' · ')}
                        {createdAt && ` · ${timeAgo(createdAt)}`}
                      </span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handle(u._id, true)}
                    className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-navy-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-navy-700"
                    aria-label={`Approve ${u.fullName}`}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handle(u._id, false)}
                    className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 px-4 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-200"
                    aria-label={`Decline ${u.fullName}`}
                  >
                    Decline
                  </button>
                </div>
                {message && (
                  <p className="mt-1.5 ml-16 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700 break-words">
                    “{message}”
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="border-t border-gray-200 px-5 py-8 text-center text-sm text-gray-500">
          No requests match “{query.trim()}”.
        </p>
      )}
    </div>
  );
}
