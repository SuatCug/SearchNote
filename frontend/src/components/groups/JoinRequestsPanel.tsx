import { Link } from 'react-router-dom';
import { Check, Inbox, Send, X } from 'lucide-react';
import UserAvatar from '@/components/users/UserAvatar';
import EmptyState from '@/components/common/EmptyState';
import Spinner from '@/components/common/Spinner';
import GroupIcon from './GroupIcon';
import {
  useGetIncomingRequestsQuery,
  useGetSentRequestsQuery,
  useRespondJoinRequestMutation,
  useToggleMembershipMutation,
} from '@/services/groupsApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { groupTitle } from '@/lib/groupStyle';
import { timeAgo } from '@/lib/format';
import { useDialog } from '@/components/common/DialogProvider';

// Tüm gruplarımın katılma istekleri: kurucusu olduğum gruplara gelenler (onayla / reddet) ve
// benim gönderdiğim, hâlâ bekleyenler (geri çek). İstekle yazılan kısa mesaj da gösterilir.
export default function JoinRequestsPanel() {
  const incoming = useGetIncomingRequestsQuery();
  const sent = useGetSentRequestsQuery();
  const [respond, { isLoading: responding }] = useRespondJoinRequestMutation();
  const [toggleMembership, { isLoading: cancelling }] = useToggleMembershipMutation();
  const dialog = useDialog();

  if (incoming.isLoading || sent.isLoading) return <Spinner />;
  const received = incoming.data?.data?.requests ?? [];
  const mine = sent.data?.data?.requests ?? [];

  const handleRespond = async (groupId: string, userId: string, approve: boolean) => {
    try {
      await respond({ id: groupId, userId, approve }).unwrap();
    } catch (err) {
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  const handleCancel = async (groupId: string, name: string) => {
    const ok = await dialog.confirm({
      title: 'Cancel your join request?',
      message: `Your request to join ${name} will be withdrawn. You can send a new one later.`,
      confirmLabel: 'Cancel request',
      cancelLabel: 'Keep it',
    });
    if (!ok) return;
    try {
      await toggleMembership({ id: groupId, leave: true }).unwrap();
    } catch (err) {
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="incoming-title">
        <h2 id="incoming-title" className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900">
          <Inbox size={17} className="text-gray-400" /> Waiting for you
          {received.length > 0 && <span className="rounded-full bg-rose-500 px-1.5 py-px text-[11px] text-white">{received.length}</span>}
        </h2>
        {!received.length ? (
          <EmptyState icon={Inbox} title="No pending requests" text="Requests to join the private groups you founded show up here." />
        ) : (
          <ul className="card divide-y divide-gray-100">
            {received.map((r) => (
              <li key={`${r.group._id}-${r.user._id}`} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                <Link to={`/users/${r.user._id}`} className="flex min-w-0 flex-1 items-start gap-3 group">
                  <UserAvatar user={r.user} />
                  <span className="min-w-0">
                    <span className="block text-sm text-gray-700">
                      <span className="font-semibold text-gray-900 group-hover:text-navy-600">{r.user.fullName}</span> wants to
                      join <span className="font-semibold text-gray-900">{groupTitle(r.group.name, r.group.courseCode)}</span>
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {[r.user.university, r.user.department].filter(Boolean).join(' · ')}
                      {r.createdAt && ` · ${timeAgo(r.createdAt)}`}
                    </span>
                    {r.message && (
                      <span className="mt-1.5 block rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 break-words">
                        “{r.message}”
                      </span>
                    )}
                  </span>
                </Link>
                <div className="flex items-center gap-1.5 shrink-0 sm:self-center self-end">
                  <button
                    type="button"
                    disabled={responding}
                    onClick={() => handleRespond(r.group._id, r.user._id, true)}
                    className="btn-primary px-3 py-2"
                  >
                    <Check size={15} /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={responding}
                    onClick={() => handleRespond(r.group._id, r.user._id, false)}
                    className="btn-secondary px-3 py-2"
                    aria-label={`Reject ${r.user.fullName}`}
                  >
                    <X size={15} /> Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="sent-title">
        <h2 id="sent-title" className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900">
          <Send size={16} className="text-gray-400" /> Sent by you
        </h2>
        {!mine.length ? (
          <EmptyState icon={Send} title="No requests sent" text="When you ask to join a private group, it waits here until the founder decides." />
        ) : (
          <ul className="card divide-y divide-gray-100">
            {mine.map((r) => (
              <li key={r.group._id} className="flex items-center gap-3 p-4">
                <Link to={`/groups/${r.group._id}`} className="flex min-w-0 flex-1 items-center gap-3 group">
                  <GroupIcon name={r.group.name} color={r.group.color} courseCode={r.group.courseCode} avatarUrl={r.group.avatarUrl} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-900 group-hover:text-navy-600">
                      {groupTitle(r.group.name, r.group.courseCode)}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {r.group.membersCount !== undefined && `${r.group.membersCount} members · `}
                      {r.createdAt ? `Requested ${timeAgo(r.createdAt)}` : 'Waiting for approval'}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => handleCancel(r.group._id, r.group.name)}
                  className="btn-secondary shrink-0 px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
