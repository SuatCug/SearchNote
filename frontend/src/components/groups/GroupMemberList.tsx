import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, MoreHorizontal, Search, ShieldCheck, ShieldOff, UserMinus, Users } from 'lucide-react';
import { useAppSelector } from '@/app/hooks';
import UserAvatar from '@/components/users/UserAvatar';
import FollowButton from '@/components/users/FollowButton';
import EmptyState from '@/components/common/EmptyState';
import Spinner from '@/components/common/Spinner';
import {
  useRemoveGroupMemberMutation,
  useSetGroupAdminMutation,
  useTransferGroupOwnershipMutation,
} from '@/services/groupsApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { normalize } from '@/lib/schoolSearch';
import { useDialog, type ConfirmOptions } from '@/components/common/DialogProvider';
import type { UserCard } from '@/types/api';

interface GroupMemberListProps {
  groupId: string;
  users?: UserCard[];
  isLoading?: boolean;
  // Kurucu: her şey; yönetici: normal üyeleri çıkarabilir ve kendi yöneticiliğini bırakabilir.
  isOwner?: boolean;
  isAdmin?: boolean;
}

type RunAction = (action: () => { unwrap: () => Promise<unknown> }, options: ConfirmOptions) => Promise<void>;

const PAGE_SIZE = 20;
const FOLLOWED_PREVIEW = 5;

// Grup üyeleri (Facebook grup üyeleri sayfası gibi): tek panelde başlık + arama, altında
// "Founder", "Admins", "People you follow" ve geri kalan üyeler bölümleri. Satırda takip butonu;
// yönetebilen kişiye ayrıca bir "⋯" menüsü (yönetici yapma, kuruculuğu devretme, gruptan çıkarma).
export default function GroupMemberList({ groupId, users, isLoading, isOwner, isAdmin }: GroupMemberListProps) {
  const [removeMember, { isLoading: removing }] = useRemoveGroupMemberMutation();
  const [setAdmin, { isLoading: settingAdmin }] = useSetGroupAdminMutation();
  const [transferOwnership, { isLoading: transferring }] = useTransferGroupOwnershipMutation();
  const busy = removing || settingAdmin || transferring;
  const dialog = useDialog();
  const myId = useAppSelector((state) => state.auth.user?.id);
  const [query, setQuery] = useState('');

  if (isLoading) return <Spinner />;
  if (!users?.length) return <EmptyState icon={Users} title="No members yet" />;

  const run: RunAction = async (action, options) => {
    if (!(await dialog.confirm(options))) return;
    try {
      await action().unwrap();
    } catch (err) {
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  const rowProps = {
    groupId,
    myId,
    viewerIsOwner: isOwner,
    viewerIsAdmin: isAdmin,
    busy,
    run,
    transferOwnership,
    removeMember,
    setAdmin,
  };
  const q = normalize(query.trim());
  const matches = q
    ? users.filter((u) =>
        [u.fullName, u.university, u.department].some((field) => field && normalize(field).includes(q))
      )
    : [];

  const owner = users.filter((u) => u.isOwner);
  const admins = users.filter((u) => u.isAdmin && !u.isOwner);
  const rest = users.filter((u) => !u.isOwner && !u.isAdmin);
  const followed = rest.filter((u) => u.isFollowing && u._id !== myId);
  const others = rest.filter((u) => !(u.isFollowing && u._id !== myId));

  return (
    // overflow-hidden yok: satırdaki "⋯" menüsü kartın dışına taşabilmeli (yoksa alt satırlarda kesiliyordu).
    <div className="card">
      <div className="px-4 pt-4 pb-3 sm:px-5">
        <h2 className="text-[17px] font-bold text-gray-900">
          Members <span className="font-normal text-gray-500">· {users.length}</span>
        </h2>
        <label className="mt-3 flex items-center gap-2 rounded-full bg-gray-100 px-3.5 py-2 focus-within:ring-2 focus-within:ring-navy-500">
          <Search size={16} className="shrink-0 text-gray-500" />
          <input
            id="group-member-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a member"
            className="w-full min-w-0 bg-transparent text-[15px] text-gray-900 placeholder-gray-500 focus:outline-none"
          />
        </label>
      </div>

      {q ? (
        matches.length ? (
          <MemberSection key={q} users={matches} rowProps={rowProps} />
        ) : (
          <p className="border-t border-gray-200 px-5 py-8 text-center text-sm text-gray-500">
            No members match “{query.trim()}”.
          </p>
        )
      ) : (
        <>
          {owner.length > 0 && (
            <MemberSection title="Founder" note="Created and manages this group." users={owner} rowProps={rowProps} />
          )}
          {admins.length > 0 && (
            <MemberSection
              title="Admins"
              count={admins.length}
              note="Help the founder manage members and join requests."
              users={admins}
              rowProps={rowProps}
            />
          )}
          {followed.length > 0 && (
            <MemberSection
              title="People you follow"
              count={followed.length}
              users={followed}
              rowProps={rowProps}
              initial={FOLLOWED_PREVIEW}
              expandAll
            />
          )}
          {others.length > 0 && (
            <MemberSection
              title={followed.length ? 'Other members' : 'Members'}
              count={others.length}
              note="Newest members first."
              users={others}
              rowProps={rowProps}
            />
          )}
        </>
      )}
    </div>
  );
}

type RowProps = Omit<MemberRowProps, 'user'>;

interface MemberSectionProps {
  title?: string;
  count?: number;
  note?: string;
  users: UserCard[];
  rowProps: RowProps;
  initial?: number;
  // true: "See all" tek seferde hepsini açar; false: her basışta PAGE_SIZE kişi daha.
  expandAll?: boolean;
}

// Kalabalık grupta yüzlerce satır birden çizilmesin: ilk PAGE_SIZE kişi, altında "See more members".
function MemberSection({ title, count, note, users, rowProps, initial = PAGE_SIZE, expandAll = false }: MemberSectionProps) {
  const [visible, setVisible] = useState(initial);
  const hidden = users.length - visible;

  return (
    <section className="border-t border-gray-200 px-2 pt-3 pb-2 sm:px-3">
      {title && (
        <div className="px-2 pb-1">
          <h3 className="text-[15px] font-semibold text-gray-900">
            {title}
            {count !== undefined && <span className="font-normal text-gray-500"> · {count}</span>}
          </h3>
          {note && <p className="text-[13px] text-gray-500">{note}</p>}
        </div>
      )}
      <ul>
        {users.slice(0, visible).map((u) => (
          <MemberRow key={u._id} user={u} {...rowProps} />
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setVisible(expandAll ? users.length : visible + PAGE_SIZE)}
          className="mt-1 w-full rounded-lg bg-gray-100 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-200"
        >
          {expandAll ? `See all ${users.length}` : `See more members (${hidden})`}
        </button>
      )}
    </section>
  );
}

interface MemberRowProps {
  groupId: string;
  user: UserCard;
  myId?: string;
  viewerIsOwner?: boolean;
  viewerIsAdmin?: boolean;
  busy: boolean;
  run: RunAction;
  transferOwnership: ReturnType<typeof useTransferGroupOwnershipMutation>[0];
  removeMember: ReturnType<typeof useRemoveGroupMemberMutation>[0];
  setAdmin: ReturnType<typeof useSetGroupAdminMutation>[0];
}

// Tek üye satırı: büyük avatar, kalın ad, altında okul ve bölüm; sağda takip butonu ve (yönetebilene) yönetim menüsü.
function MemberRow({
  groupId,
  user: u,
  myId,
  viewerIsOwner,
  viewerIsAdmin,
  busy,
  run,
  transferOwnership,
  removeMember,
  setAdmin,
}: MemberRowProps) {
  const [open, setOpen] = useState(false);
  const isMe = u._id === myId;
  // Kurucu kendisi dışında herkesi, yönetici sadece normal üyeleri çıkarabilir; yönetici kendi yöneticiliğini bırakabilir.
  const canRemove = !u.isOwner && !isMe && (viewerIsOwner || (viewerIsAdmin && !u.isAdmin));
  const canStepDown = isMe && u.isAdmin;
  const hasMenu = (viewerIsOwner && !u.isOwner) || canRemove || canStepDown;

  const act = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
      <Link to={`/users/${u._id}`} className="group flex min-w-0 flex-1 items-center gap-3">
        <span className="relative shrink-0">
          <UserAvatar user={u} size="chat" />
          {u.isOwner && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-white ring-2 ring-white">
              <Crown size={11} />
            </span>
          )}
          {u.isAdmin && !u.isOwner && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-navy-600 text-white ring-2 ring-white">
              <ShieldCheck size={11} />
            </span>
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-gray-900 group-hover:underline">
            {u.fullName}
            {isMe && <span className="font-normal text-gray-500"> (you)</span>}
          </span>
          {(u.university || u.department) && (
            <span className="block truncate text-[13px] text-gray-500">
              {[u.university, u.department].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
      </Link>

      {!isMe && <FollowButton userId={u._id} isFollowing={Boolean(u.isFollowing)} name={u.fullName} variant="list" />}

      {hasMenu && (
        <div className="relative shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={`Manage ${u.fullName}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            <MoreHorizontal size={16} />
          </button>
          {open && (
            <>
              {/* Telefonda alttan açılan sayfa (karartılmış zemin, alt sekme çubuğunun üstünde); sm+ butonun altında açılır menü. */}
              <div className="fixed inset-0 z-[60] bg-black/40 sm:z-10 sm:bg-transparent" onClick={() => setOpen(false)} />
              <div
                role="menu"
                className="sheet-up fixed inset-x-0 bottom-0 z-[61] rounded-t-2xl bg-white pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:z-20 sm:mt-1.5 sm:w-56 sm:rounded-2xl sm:py-1.5 sm:ring-1 sm:ring-black/5"
              >
                <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-gray-300 sm:hidden" aria-hidden="true" />
                <p className="truncate border-b border-gray-100 px-4 pt-1 pb-2.5 text-sm font-semibold text-gray-900 sm:hidden">{u.fullName}</p>
                {viewerIsOwner && !u.isOwner && (
                  <>
                    {u.isAdmin ? (
                      <button
                        type="button"
                        onClick={() =>
                          act(() =>
                            run(() => setAdmin({ id: groupId, userId: u._id, isAdmin: false }), {
                              title: `Remove ${u.fullName} as admin?`,
                              message: 'They will stay in the group as a regular member.',
                              confirmLabel: 'Remove admin',
                            })
                          )
                        }
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-gray-800 hover:bg-gray-50"
                      >
                        <ShieldOff size={15} className="text-gray-500" /> Remove as admin
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          act(() =>
                            run(() => setAdmin({ id: groupId, userId: u._id, isAdmin: true }), {
                              title: `Make ${u.fullName} an admin?`,
                              message: 'Admins can remove members, approve join requests and delete chat messages.',
                              confirmLabel: 'Make admin',
                            })
                          )
                        }
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-gray-800 hover:bg-gray-50"
                      >
                        <ShieldCheck size={15} className="text-navy-600" /> Make admin
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        act(() =>
                          run(() => transferOwnership({ id: groupId, userId: u._id }), {
                            title: `Make ${u.fullName} the founder?`,
                            message: 'They will manage the group. You will stay in it as a regular member.',
                            confirmLabel: 'Make founder',
                          })
                        )
                      }
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-gray-800 hover:bg-gray-50"
                    >
                      <Crown size={15} className="text-amber-600" /> Make founder
                    </button>
                  </>
                )}
                {canStepDown && (
                  <button
                    type="button"
                    onClick={() =>
                      act(() =>
                        run(() => setAdmin({ id: groupId, userId: u._id, isAdmin: false }), {
                          title: 'Step down as admin?',
                          message: 'You will stay in the group as a regular member.',
                          confirmLabel: 'Step down',
                        })
                      )
                    }
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    <ShieldOff size={15} className="text-gray-500" /> Step down as admin
                  </button>
                )}
                {canRemove && (
                  <>
                    {viewerIsOwner && <div className="my-1 border-t border-gray-100" />}
                    <button
                      type="button"
                      onClick={() =>
                        act(() =>
                          run(() => removeMember({ id: groupId, userId: u._id }), {
                            title: `Remove ${u.fullName}?`,
                            message: 'They will no longer be a member of this group.',
                            confirmLabel: 'Remove',
                            tone: 'danger',
                          })
                        )
                      }
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                    >
                      <UserMinus size={15} /> Remove from group
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}
