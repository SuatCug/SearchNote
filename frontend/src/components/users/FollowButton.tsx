import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { UserCheck, UserPlus } from 'lucide-react';
import { useToggleFollowMutation } from '@/services/usersApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { useDialog } from '@/components/common/DialogProvider';

// compact: yan panel listeleri için küçük boyut.
// name: takipten çıkarken onay penceresinde gösterilir.
// variant: 'profile' profil başlığındaki geniş buton (Message ile eşit genişlik ve renkte, mobildeki gibi),
//          'list' takipçi / takip edilen penceresindeki ikonsuz alçak buton (Instagram gibi).
interface FollowButtonProps {
  userId: string;
  isFollowing: boolean;
  name?: string;
  compact?: boolean;
  variant?: 'default' | 'profile' | 'list';
  // Takip durumu değişince (örn. karşılama ekranı listeyi kendisi tutar, sunucudan yenilemez).
  onChange?: (isFollowing: boolean) => void;
}

const VARIANT_CLASS = {
  profile: {
    base: 'inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-bold transition-colors disabled:opacity-60',
    follow: 'bg-navy-600 text-white hover:bg-navy-700',
    following: 'bg-navy-100 text-gray-900 hover:bg-navy-200',
  },
  list: {
    base: 'inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors disabled:opacity-60',
    follow: 'bg-navy-600 text-white hover:bg-navy-700',
    following: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
  },
};

export default function FollowButton({ userId, isFollowing, name, compact = false, variant = 'default', onChange }: FollowButtonProps) {
  const token = useAppSelector((state) => state.auth.token);
  const isVerified = useAppSelector((state) => state.auth.user?.isVerified);
  const navigate = useNavigate();
  const [toggleFollow, { isLoading }] = useToggleFollowMutation();
  const dialog = useDialog();

  const handleClick = async () => {
    if (!token) return navigate('/login');
    if (
      isFollowing &&
      !(await dialog.confirm({
        title: name ? `Unfollow ${name}?` : 'Unfollow this user?',
        message: "Their new notes won't show up in your Following feed anymore.",
        confirmLabel: 'Unfollow',
        tone: 'danger',
      }))
    ) {
      return;
    }
    try {
      await toggleFollow({ id: userId, following: isFollowing }).unwrap();
      onChange?.(!isFollowing);
    } catch (err) {
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  const custom = variant === 'default' ? null : VARIANT_CLASS[variant];

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading || Boolean(token && !isVerified)}
      title={token && !isVerified ? 'Verify your email to follow' : undefined}
      className={
        custom
          ? `${custom.base} ${isFollowing ? custom.following : custom.follow}`
          : `${isFollowing ? 'btn-secondary' : 'btn-primary'} ${compact ? 'px-2.5 py-1.5 text-xs gap-1' : ''}`
      }
    >
      {variant !== 'list' &&
        (isFollowing ? <UserCheck size={compact ? 14 : 16} /> : <UserPlus size={compact ? 14 : 16} />)}
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  );
}
