import { Link } from 'react-router-dom';
import { Check, UserPlus, X } from 'lucide-react';
import UserAvatar from '@/components/users/UserAvatar';
import EmptyState from '@/components/common/EmptyState';
import Spinner from '@/components/common/Spinner';
import { useGetIncomingRequestsQuery, useRespondJoinRequestMutation } from '@/services/groupsApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { timeAgo } from '@/lib/format';
import { useDialog } from '@/components/common/DialogProvider';

// Özel grubun bekleyen katılma istekleri (sadece kurucuya gösterilir), istekle yazılan kısa notla birlikte.
// Kurucunun tüm gruplarına gelen istekler tek listede gelir; burada bu grubunkiler ayıklanır.
export default function GroupRequestList({ groupId }: { groupId: string }) {
  const { data, isLoading } = useGetIncomingRequestsQuery();
  const [respond, { isLoading: responding }] = useRespondJoinRequestMutation();
  const requests = data?.data?.requests.filter((r) => r.group._id === groupId);
  const dialog = useDialog();

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

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {requests.map(({ user: u, message, createdAt }) => (
        <li key={u._id} className="card flex flex-col gap-3 p-4">
          <div className="flex items-center gap-3">
            <Link to={`/users/${u._id}`} className="flex items-center gap-3 min-w-0 flex-1 group">
              <UserAvatar user={u} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900 group-hover:text-navy-600 truncate">
                  {u.fullName}
                </span>
                <span className="block text-xs text-gray-500 truncate">
                  {[u.university, u.department].filter(Boolean).join(' · ')}
                  {createdAt && ` · ${timeAgo(createdAt)}`}
                </span>
              </span>
            </Link>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={responding}
                onClick={() => handle(u._id, true)}
                className="btn-primary px-3 py-2"
                aria-label={`Approve ${u.fullName}`}
              >
                <Check size={15} /> Approve
              </button>
              <button
                type="button"
                disabled={responding}
                onClick={() => handle(u._id, false)}
                className="p-2 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                title="Reject"
                aria-label={`Reject ${u.fullName}`}
              >
                <X size={16} />
              </button>
            </div>
          </div>
          {message && <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 break-words">“{message}”</p>}
        </li>
      ))}
    </ul>
  );
}
