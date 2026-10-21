import { useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Check,
  Crown,
  Globe,
  GraduationCap,
  Lock,
  LogOut,
  MoreHorizontal,
  Pencil,
  Share2,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Spinner from '@/components/common/Spinner';
import EmptyState from '@/components/common/EmptyState';
import Pagination from '@/components/common/Pagination';
import { useDialog } from '@/components/common/DialogProvider';
import NoteGrid from '@/components/notes/NoteGrid';
import UserAvatar from '@/components/users/UserAvatar';
import PeopleModal from '@/components/users/PeopleModal';
import GroupIcon from '@/components/groups/GroupIcon';
import FavoriteButton from '@/components/groups/FavoriteButton';
import FollowedMembers from '@/components/groups/FollowedMembers';
import JoinGroupButton from '@/components/groups/JoinGroupButton';
import GroupMemberList from '@/components/groups/GroupMemberList';
import GroupRequestList from '@/components/groups/GroupRequestList';
import GroupChat from '@/components/groups/GroupChat';
import InviteModal from '@/components/groups/InviteModal';
import {
  useDeleteGroupMutation,
  useGetGroupFollowedMembersQuery,
  useGetGroupMembersQuery,
  useGetGroupNotesQuery,
  useGetGroupQuery,
  useGetMyGroupActivityQuery,
  useToggleMembershipMutation,
} from '@/services/groupsApi';
import { getErrorMessage, isNotFound } from '@/lib/getErrorMessage';
import { formatCount, formatDate } from '@/lib/format';
import { compact } from '@/lib/compact';
import { groupTitle } from '@/lib/groupStyle';
import type { FileType, GroupDetail } from '@/types/api';
import { useKeepInViewOnChange } from '@/hooks/useKeepInViewOnChange';

type GroupTab = { key: 'notes' | 'members' | 'chat' | 'requests'; label: string; count?: number; badge?: number };

// Grup notlarında dosya türü filtresi (mobildeki "PDF / Word / Images / Archives" çipleri).
const FILE_FILTERS: { value: FileType | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'Word' },
  { value: 'image', label: 'Images' },
  { value: 'archive', label: 'Archives' },
];

export default function GroupDetailPage() {
  const { id = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') || 'notes';
  const page = Number(searchParams.get('page')) || 1;
  const fileParam = searchParams.get('type') ?? '';
  const fileType = FILE_FILTERS.some((f) => f.value === fileParam) ? (fileParam as FileType | '') : '';
  const [followedOpen, setFollowedOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data, isLoading, error } = useGetGroupQuery(id);
  const group = data?.data?.group;
  const activity = useGetMyGroupActivityQuery(undefined, { skip: !group?.isMember });
  const unread = activity.data?.data?.groups.find((g) => g._id === id)?.unreadCount ?? 0;

  // Grup notları ve sohbet her grupta sadece üyelere açık; özel grubun üye listesi de öyle. İstekler sadece kurucuya.
  const canView = Boolean(group && (!group.isPrivate || group.isMember));
  const tabs = group
    ? compact<GroupTab>([
        { key: 'notes', label: 'Notes', count: group.notesCount },
        { key: 'members', label: 'Members', count: group.membersCount },
        group.isMember && { key: 'chat', label: 'Chat', badge: unread },
        group.isOwner && (group.isPrivate || (group.pendingCount ?? 0) > 0) && {
          key: 'requests',
          label: 'Requests',
          count: group.pendingCount,
        },
      ])
    : [];
  const tab = tabs.some((t) => t.key === requestedTab) ? requestedTab : 'notes';
  const tabsRef = useRef<HTMLDivElement>(null);
  // Aşağıdayken sekme değişirse sekme çubuğu en üste gelir; kısa sekmede sayfa dibine sıkışmasın.
  useKeepInViewOnChange(tab, tabsRef);

  const notes = useGetGroupNotesQuery({ id, page, fileType }, { skip: !group?.isMember || tab !== 'notes' });
  const members = useGetGroupMembersQuery(id, { skip: !canView || tab !== 'members' });
  const followed = useGetGroupFollowedMembersQuery(id, { skip: !followedOpen });

  if (isLoading) return <PageLayout><Spinner /></PageLayout>;
  if (error || !group) {
    return (
      <PageLayout narrow>
        <EmptyState
          icon={Users}
          title={isNotFound(error) ? 'Group not found' : 'Could not load group'}
          text={isNotFound(error) ? 'This group may have been deleted.' : getErrorMessage(error)}
          action={<Link to="/groups" className="btn-primary">Back to groups</Link>}
        />
      </PageLayout>
    );
  }

  const shareLink = (
    <Link to={`/upload?group=${group._id}`} className="btn-primary">
      <Upload size={16} /> Share a Note
    </Link>
  );

  const setFileType = (value: string) => setSearchParams(value ? { type: value } : {});

  return (
    <PageLayout>
      <section className="card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <GroupIcon name={group.name} color={group.color} courseCode={group.courseCode} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 break-words">{groupTitle(group.name, group.courseCode)}</h1>
              <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                {group.isPrivate ? <Lock size={11} /> : <Globe size={11} />}
                {group.isPrivate ? 'Approval needed' : 'Open to everyone'}
              </span>
            </div>
            {group.university && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                <GraduationCap size={15} className="shrink-0 text-gray-400" /> {group.university}
              </p>
            )}
            <Link
              to={`/users/${group.owner?._id}`}
              className="mt-2 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-navy-600"
            >
              <UserAvatar user={group.owner} size="xs" />
              <span className="font-medium">{group.owner?.fullName}</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-px text-[11px] font-semibold text-amber-700">
                <Crown size={11} /> Founder
              </span>
            </Link>
            {group.description && (
              <p className="mt-3 text-[15px] text-gray-700 whitespace-pre-line break-words">{group.description}</p>
            )}
            <FollowedMembers
              users={group.followedMembers}
              count={group.followedMembersCount}
              onClick={() => setFollowedOpen(true)}
              className="mt-3"
            />
            <p className="mt-2 text-xs text-gray-400">
              Created {formatDate(group.createdAt)} · {formatCount(group.membersCount)} members ·{' '}
              {formatCount(group.notesCount)} notes
            </p>
          </div>
          <div className="shrink-0 flex flex-wrap items-center gap-2">
            {group.isMember && shareLink}
            {group.isMember && (
              <button type="button" onClick={() => setInviteOpen(true)} className="btn-secondary">
                <UserPlus size={16} /> Invite
              </button>
            )}
            {group.isOwner ? (
              <Link to={`/groups/${group._id}/edit`} className="btn-secondary">
                <Pencil size={15} /> Edit Group
              </Link>
            ) : (
              !group.isMember && <JoinGroupButton group={group} />
            )}
            <FavoriteButton groupId={group._id} isFavorite={Boolean(group.isFavorite)} variant="button" />
            <GroupMenu group={group} onInvite={() => setInviteOpen(true)} />
          </div>
        </div>
      </section>

      {!canView ? (
        <div className="mt-8">
          <LockedNotice group={group} />
        </div>
      ) : (
        <>
          <div ref={tabsRef} className="mt-8 flex scroll-mt-20 gap-6 overflow-x-auto border-b border-gray-200" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setSearchParams(t.key === 'notes' ? {} : { tab: t.key })}
                className={`pb-3 -mb-px border-b-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                  tab === t.key ? 'border-navy-600 text-navy-700' : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {t.label}{' '}
                {t.count !== undefined && (
                  <span
                    className={
                      t.key === 'requests' && t.count > 0
                        ? 'ml-0.5 rounded-full bg-rose-500 text-white text-[11px] px-1.5 py-px'
                        : 'font-normal text-gray-400'
                    }
                  >
                    {formatCount(t.count)}
                  </span>
                )}
                {!!t.badge && <span className="ml-0.5 rounded-full bg-rose-500 text-white text-[11px] px-1.5 py-px">{t.badge}</span>}
              </button>
            ))}
          </div>

          {/* Sohbetin kendi yüksekliği var; diğer sekmelerde en az ekran boyu (bkz. useKeepInViewOnChange). */}
          <div className={`mt-6 ${tab === 'chat' ? '' : 'min-h-[calc(100vh-12rem)]'}`}>
            {tab === 'notes' && !group.isMember && <LockedNotice group={group} />}
            {tab === 'notes' && group.isMember && (
              <>
                {group.notesCount > 0 && (
                  <div className="mb-4 flex gap-2 overflow-x-auto" role="group" aria-label="Filter by file type">
                    {FILE_FILTERS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        aria-pressed={fileType === f.value}
                        onClick={() => setFileType(f.value)}
                        className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                          fileType === f.value ? 'bg-navy-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
                <NoteGrid
                  notes={notes.data?.data?.items}
                  isLoading={notes.isLoading}
                  emptyTitle={fileType ? 'No notes of this type yet' : 'No notes in this group yet'}
                  emptyText={fileType ? 'Try another file type.' : 'Share the first one with your classmates.'}
                  emptyAction={!fileType && shareLink}
                />
                <Pagination
                  pagination={notes.data?.data?.pagination}
                  onPageChange={(p) => {
                    const next: Record<string, string> = fileType ? { type: fileType } : {};
                    if (p > 1) next.page = String(p);
                    setSearchParams(next);
                  }}
                />
              </>
            )}
            {tab === 'members' && (
              <GroupMemberList
                groupId={group._id}
                users={members.data?.data?.users}
                isLoading={members.isLoading}
                canManage={group.isOwner}
              />
            )}
            {tab === 'chat' && <GroupChat groupId={group._id} isOwner={group.isOwner} />}
            {tab === 'requests' && <GroupRequestList groupId={group._id} />}
          </div>
        </>
      )}

      {followedOpen && (
        <PeopleModal
          title={`Members you follow · ${formatCount(group.followedMembersCount)}`}
          users={followed.data?.data?.users}
          isLoading={followed.isLoading}
          onClose={() => setFollowedOpen(false)}
        />
      )}
      {inviteOpen && <InviteModal group={group} onClose={() => setInviteOpen(false)} />}
    </PageLayout>
  );
}

// Üye olmayan: notlar kilitli, neden göremediği yazar (mobildeki metinler).
function LockedNotice({ group }: { group: GroupDetail }) {
  const ownerFirst = group.owner?.fullName.split(' ')[0] ?? 'the founder';
  return (
    <EmptyState
      icon={Lock}
      title={group.isPending ? 'Request sent' : group.isPrivate ? 'Approval needed' : 'Members only'}
      text={
        group.isPending
          ? `You'll get a notification when ${ownerFirst} accepts your request.`
          : group.isPrivate
            ? `Once ${ownerFirst} accepts your request, you'll see the chat and all ${group.notesCount} notes.`
            : `Join to see the chat and the ${group.notesCount} notes shared here.`
      }
      action={!group.isMember && !group.isPending && <JoinGroupButton group={group} />}
    />
  );
}

// "⋯" menüsü: grubu paylaş, davet et, (üye) gruptan ayrıl, (kurucu) grubu sil.
function GroupMenu({ group, onInvite }: { group: GroupDetail; onInvite: () => void }) {
  const navigate = useNavigate();
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toggleMembership] = useToggleMembershipMutation();
  const [deleteGroup] = useDeleteGroupMutation();

  const share = async () => {
    const url = `${window.location.origin}/groups/${group._id}`;
    if (navigator.share) {
      setOpen(false);
      try {
        await navigator.share({ title: group.name, url });
      } catch {
        // Kullanıcı paylaşım penceresini kapattı.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  const leave = async () => {
    setOpen(false);
    const ok = await dialog.confirm({
      title: `Leave "${group.name}"?`,
      message: group.isPrivate ? 'This is a private group, so you will need approval to join again.' : 'You can join again anytime.',
      confirmLabel: 'Leave group',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await toggleMembership({ id: group._id, leave: true }).unwrap();
    } catch (err) {
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  const remove = async () => {
    setOpen(false);
    const ok = await dialog.confirm({
      title: `Delete "${group.name}"?`,
      message: "This group, its chat and all notes shared in it will be deleted permanently. This cannot be undone.",
      confirmLabel: 'Delete group',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteGroup(group._id).unwrap();
      navigate('/groups', { replace: true });
    } catch (err) {
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  const item = 'w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium hover:bg-gray-50';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Group options"
        className="btn-secondary px-2.5"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="sheet-up absolute right-0 top-full z-20 mt-1.5 w-56 rounded-2xl bg-white py-1.5 shadow-xl ring-1 ring-black/5">
            <button type="button" onClick={share} className={`${item} text-gray-800`}>
              {copied ? <Check size={16} className="text-emerald-600" /> : <Share2 size={16} />}
              {copied ? 'Link copied' : 'Share group'}
            </button>
            {group.isMember && (
              <button type="button" onClick={() => (setOpen(false), onInvite())} className={`${item} text-gray-800`}>
                <UserPlus size={16} /> Invite people
              </button>
            )}
            {group.isMember && !group.isOwner && (
              <>
                <div className="my-1 border-t border-gray-100" />
                <button type="button" onClick={leave} className={`${item} text-rose-600 hover:bg-rose-50`}>
                  <LogOut size={16} /> Leave group
                </button>
              </>
            )}
            {group.isOwner && (
              <>
                <div className="my-1 border-t border-gray-100" />
                <button type="button" onClick={remove} className={`${item} text-rose-600 hover:bg-rose-50`}>
                  <Trash2 size={16} /> Delete group
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
