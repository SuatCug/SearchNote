import { Link } from 'react-router-dom';
import { Ban } from 'lucide-react';
import Spinner from '@/components/common/Spinner';
import UserAvatar from '@/components/users/UserAvatar';
import { useDialog } from '@/components/common/DialogProvider';
import { useGetBlockedUsersQuery, useToggleBlockMutation } from '@/services/usersApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import SettingsCard from './SettingsCard';

// Engellediğim kişiler, en son engellenen önce. Engeli buradan kaldırılabilir.
export default function BlockedSettings() {
  const { data, isLoading } = useGetBlockedUsersQuery();
  const [toggleBlock, { isLoading: unblocking }] = useToggleBlockMutation();
  const dialog = useDialog();
  const users = data?.data?.users;

  const handleUnblock = async (id: string, name: string) => {
    const ok = await dialog.confirm({
      title: `Unblock ${name}?`,
      message: 'They will be able to find you, follow you and message you again.',
      confirmLabel: 'Unblock',
    });
    if (!ok) return;
    try {
      await toggleBlock({ id, blocked: true }).unwrap();
    } catch (err) {
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  if (isLoading) return <Spinner />;
  if (!users?.length) {
    return (
      <SettingsCard className="py-10 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <Ban size={22} />
        </span>
        <p className="mt-3 font-semibold text-gray-900">No blocked accounts</p>
        <p className="mt-1 text-sm text-gray-500">You can block someone from the ⋯ menu on their profile.</p>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard className="!p-2">
      <ul>
        {users.map((u) => (
          <li key={u._id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <Link to={`/users/${u._id}`} className="group flex min-w-0 flex-1 items-center gap-3">
              <UserAvatar user={u} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-gray-900 group-hover:text-navy-600">{u.fullName}</span>
                <span className="block truncate text-xs text-gray-500">{[u.university, u.department].filter(Boolean).join(' · ')}</span>
              </span>
            </Link>
            <button
              type="button"
              disabled={unblocking}
              onClick={() => handleUnblock(u._id, u.fullName)}
              className="inline-flex h-8 shrink-0 items-center rounded-lg bg-gray-100 px-4 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-60"
            >
              Unblock
            </button>
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}
