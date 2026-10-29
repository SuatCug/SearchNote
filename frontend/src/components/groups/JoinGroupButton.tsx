import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { Clock, Lock, LogOut, UserPlus } from 'lucide-react';
import { useToggleMembershipMutation } from '@/services/groupsApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { useDialog } from '@/components/common/DialogProvider';
import Modal from '@/components/common/Modal';
import type { GroupCard } from '@/types/api';

const REQUEST_MESSAGE_MAX = 300;

// Üye değilse katıl (özel grupta kurucuya isteğe bağlı kısa notla istek gönder),
// bekleyen istek varsa geri çek, üyeyse ayrıl.
export default function JoinGroupButton({
  group,
}: {
  group: Pick<GroupCard, '_id' | 'isMember' | 'isPending' | 'isPrivate'> & { name?: string };
}) {
  const token = useAppSelector((state) => state.auth.token);
  const isVerified = useAppSelector((state) => state.auth.user?.isVerified);
  const navigate = useNavigate();
  const [toggleMembership, { isLoading }] = useToggleMembershipMutation();
  const [requestOpen, setRequestOpen] = useState(false);
  const dialog = useDialog();
  const { _id: id, isPrivate } = group;

  // Buton sunucuyu beklemeden değişir; grup verisi yenilenip yeni üyelik durumu gelince yerel durum bırakılır.
  const membership = `${group.isMember}-${group.isPending}`;
  const [optimistic, setOptimistic] = useState<{ isMember: boolean; isPending: boolean } | null>(null);
  const [prevMembership, setPrevMembership] = useState(membership);
  if (membership !== prevMembership) {
    setPrevMembership(membership);
    setOptimistic(null);
  }
  const isMember = optimistic?.isMember ?? group.isMember;
  const isPending = optimistic?.isPending ?? group.isPending;
  const leave = isMember || isPending;

  const handleClick = async () => {
    if (!token) return navigate('/login', { state: { from: `/groups/${id}` } });
    if (isLoading) return;
    if (isPrivate && !leave) return setRequestOpen(true);
    if (
      isMember &&
      !(await dialog.confirm({
        title: 'Leave this group?',
        message: isPrivate
          ? 'This is a private group, so you will need approval to join again.'
          : 'You can join again anytime.',
        confirmLabel: 'Leave group',
        tone: 'danger',
      }))
    ) {
      return;
    }
    if (
      isPending &&
      !(await dialog.confirm({
        title: 'Cancel your join request?',
        message: 'You can send a new request later.',
        confirmLabel: 'Cancel request',
        cancelLabel: 'Keep it',
      }))
    ) {
      return;
    }
    setOptimistic({ isMember: !leave, isPending: false });
    try {
      await toggleMembership({ id, leave }).unwrap();
    } catch (err) {
      setOptimistic(null);
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  const needsVerify = Boolean(token && !isVerified && !leave);

  let icon = <UserPlus size={16} />;
  let label = isPrivate ? 'Request to Join' : 'Join Group';
  if (isMember) {
    icon = <LogOut size={16} />;
    label = 'Leave Group';
  } else if (isPending) {
    icon = <Clock size={16} />;
    label = 'Request Sent';
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={needsVerify}
        title={needsVerify ? 'Verify your email to join groups' : isPending ? 'Click to cancel your request' : undefined}
        className={leave ? 'btn-secondary' : 'btn-primary'}
      >
        {icon}
        {label}
      </button>
      {requestOpen && (
        <JoinRequestModal
          groupName={group.name}
          onClose={() => setRequestOpen(false)}
          onSend={async (message) => {
            setRequestOpen(false);
            setOptimistic({ isMember: false, isPending: true });
            try {
              await toggleMembership({ id, leave: false, message }).unwrap();
            } catch (err) {
              setOptimistic(null);
              dialog.alert({ message: getErrorMessage(err) });
            }
          }}
        />
      )}
    </>
  );
}

// Özel gruba katılma isteği: kurucuya isteğe bağlı kısa bir not ("CENG213'ü bu dönem alıyorum").
function JoinRequestModal({
  groupName,
  onClose,
  onSend,
}: {
  groupName?: string;
  onClose: () => void;
  onSend: (message?: string) => void;
}) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSend(message.trim() || undefined);
  };

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title={
        <>
          <Lock size={16} className="text-gray-400" /> Request to join
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <p className="text-sm text-gray-600">
          {groupName ? <span className="font-semibold text-gray-900">{groupName}</span> : 'This group'} is private. The founder
          will review your request.
        </p>
        <div>
          <label htmlFor="join-message" className="form-label">
            Message to the founder <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            id="join-message"
            rows={3}
            maxLength={REQUEST_MESSAGE_MAX}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. I'm taking this course this semester."
            className="form-input resize-none"
          />
          <p className="mt-1 text-right text-xs text-gray-400">
            {message.length}/{REQUEST_MESSAGE_MAX}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Send request
          </button>
        </div>
      </form>
    </Modal>
  );
}
