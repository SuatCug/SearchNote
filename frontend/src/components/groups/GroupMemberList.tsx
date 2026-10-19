import { Link } from 'react-router-dom';
import { Crown, UserMinus, Users } from 'lucide-react';
import UserAvatar from '@/components/users/UserAvatar';
import EmptyState from '@/components/common/EmptyState';
import Spinner from '@/components/common/Spinner';
import { useRemoveGroupMemberMutation, useTransferGroupOwnershipMutation } from '@/services/groupsApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { useDialog, type ConfirmOptions } from '@/components/common/DialogProvider';
import type { UserCard } from '@/types/api';

interface GroupMemberListProps {
  groupId: string;
  users?: UserCard[];
  isLoading?: boolean;
  canManage?: boolean;
}

// Grup üyeleri. Kurucu en üstte işaretlenir; kurucuya üye çıkarma ve kuruculuğu devretme seçenekleri gösterilir.
export default function GroupMemberList({ groupId, users, isLoading, canManage }: GroupMemberListProps) {
  const [removeMember, { isLoading: removing }] = useRemoveGroupMemberMutation();
  const [transferOwnership, { isLoading: transferring }] = useTransferGroupOwnershipMutation();
  const busy = removing || transferring;
  const dialog = useDialog();

  if (isLoading) return <Spinner />;
  if (!users?.length) return <EmptyState icon={Users} title="No members yet" />;

  const run = async (action: () => { unwrap: () => Promise<unknown> }, options: ConfirmOptions) => {
    if (!(await dialog.confirm(options))) return;
    try {
      await action().unwrap();
    } catch (err) {
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {users.map((u) => (
        <li key={u._id} className="card flex items-center gap-3 p-4">
          <Link to={`/users/${u._id}`} className="flex items-center gap-3 min-w-0 flex-1 group">
            <UserAvatar user={u} />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 group-hover:text-navy-600">
                <span className="truncate">{u.fullName}</span>
                {u.isOwner && (
                  <span className="inline-flex items-center gap-1 shrink-0 rounded-md bg-amber-50 px-1.5 py-px text-[11px] font-semibold text-amber-700">
                    <Crown size={11} /> Founder
                  </span>
                )}
              </span>
              <span className="block text-xs text-gray-500 truncate">
                {u.university} · {u.department}
              </span>
            </span>
          </Link>

          {canManage && !u.isOwner && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => transferOwnership({ id: groupId, userId: u._id }),
                    {
                      title: `Make ${u.fullName} the founder?`,
                      message: 'They will manage the group. You will stay in it as a regular member.',
                      confirmLabel: 'Make founder',
                    }
                  )
                }
                className="p-2 rounded-md text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                title="Make founder"
                aria-label={`Make ${u.fullName} the founder`}
              >
                <Crown size={16} />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(() => removeMember({ id: groupId, userId: u._id }), {
                    title: `Remove ${u.fullName}?`,
                    message: 'They will no longer be a member of this group.',
                    confirmLabel: 'Remove',
                    tone: 'danger',
                  })
                }
                className="p-2 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                title="Remove from group"
                aria-label={`Remove ${u.fullName} from the group`}
              >
                <UserMinus size={16} />
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
