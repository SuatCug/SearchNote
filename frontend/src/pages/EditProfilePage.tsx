import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { Ban, Camera, ShieldCheck, Trash2, UserX } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import PasswordField from '@/components/auth/PasswordField';
import CodeForm from '@/components/auth/CodeForm';
import Alert, { type AlertVariant } from '@/components/common/Alert';
import SchoolFields from '@/components/common/SchoolFields';
import Spinner from '@/components/common/Spinner';
import UserAvatar from '@/components/users/UserAvatar';
import { useDialog } from '@/components/common/DialogProvider';
import {
  useChangePasswordMutation,
  useDeleteAccountMutation,
  useGetBlockedUsersQuery,
  useRemoveAvatarMutation,
  useSendDeleteCodeMutation,
  useToggleBlockMutation,
  useUpdateAvatarMutation,
  useUpdateProfileMutation,
} from '@/services/usersApi';
import { baseApi } from '@/services/baseApi';
import { logout } from '@/app/authSlice';
import { getErrorMessage } from '@/lib/getErrorMessage';
import type { AuthUser } from '@/types/api';

type Feedback = { type: AlertVariant | ''; text: string };

export default function EditProfilePage() {
  const user = useAppSelector((state) => state.auth.user);
  if (!user) return null;

  return (
    <PageLayout narrow>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <Link to={`/users/${user.id}`} className="text-sm font-semibold text-navy-600 hover:text-navy-700">
          View my profile →
        </Link>
      </div>

      <nav className="mt-4 flex flex-wrap gap-2 text-sm" aria-label="Settings sections">
        {[
          ['#profile', 'Profile'],
          ['#password', 'Password'],
          ['#blocked', 'Blocked accounts'],
          ['#delete', 'Delete account'],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border border-gray-200 bg-white px-3 py-1 font-medium text-gray-600 hover:border-navy-200 hover:text-navy-700">
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-6 space-y-6">
        <AvatarSection user={user} />
        <ProfileSection user={user} />
        <PasswordSection hasPassword={user.hasPassword !== false} />
        <BlockedSection />
        <DeleteAccountSection />
      </div>
    </PageLayout>
  );
}

function Section({ id, title, description, children }: { id?: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="card p-5 sm:p-7 scroll-mt-24">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function AvatarSection({ user }: { user: AuthUser }) {
  const [updateAvatar, { isLoading }] = useUpdateAvatarMutation();
  const [removeAvatar, { isLoading: removing }] = useRemoveAvatarMutation();
  const [feedback, setFeedback] = useState<Feedback>({ type: '', text: '' });
  const inputRef = useRef<HTMLInputElement>(null);
  const dialog = useDialog();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ type: 'error', text: 'Profile photo can be at most 2 MB.' });
      return;
    }
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      await updateAvatar(formData).unwrap();
      setFeedback({ type: 'success', text: 'Profile photo updated.' });
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err) });
    }
  };

  const handleRemove = async () => {
    const ok = await dialog.confirm({
      title: 'Remove profile photo?',
      message: 'Your initials will be shown instead.',
      confirmLabel: 'Remove',
      tone: 'danger',
      icon: Trash2,
    });
    if (!ok) return;
    try {
      await removeAvatar().unwrap();
      setFeedback({ type: 'success', text: 'Profile photo removed.' });
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err) });
    }
  };

  return (
    <Section title="Profile Photo">
      <div className="flex items-center gap-5">
        <UserAvatar user={user} size="lg" />
        <div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={isLoading} className="btn-secondary">
              <Camera size={16} /> {isLoading ? 'Uploading...' : 'Change Photo'}
            </button>
            {user.avatarUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className="btn-secondary text-rose-600 hover:bg-rose-50 hover:border-rose-200"
              >
                <Trash2 size={15} /> {removing ? 'Removing...' : 'Remove'}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">JPG or PNG, up to 2 MB.</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      <Alert variant={feedback.type || 'error'} className="mt-4">
        {feedback.text}
      </Alert>
    </Section>
  );
}

function ProfileSection({ user }: { user: AuthUser }) {
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();
  const [form, setForm] = useState({
    fullName: user.fullName,
    university: user.university,
    department: user.department,
    bio: user.bio ?? '',
  });
  const [feedback, setFeedback] = useState<Feedback>({ type: '', text: '' });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await updateProfile({ ...form, university: form.university.trim(), department: form.department.trim() }).unwrap();
      setFeedback({ type: 'success', text: 'Your profile has been updated.' });
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err) });
    }
  };

  return (
    <Section id="profile" title="Profile Information" description={`Email: ${user.email}`}>
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="fullName" className="form-label">Full Name</label>
          <input
            id="fullName"
            required
            maxLength={80}
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            className="form-input"
          />
        </div>
        <SchoolFields
          university={form.university}
          department={form.department}
          onUniversityChange={(university) => setForm((f) => ({ ...f, university }))}
          onDepartmentChange={(department) => setForm((f) => ({ ...f, department }))}
        />
        <div className="sm:col-span-2">
          <label htmlFor="bio" className="form-label">About Me</label>
          <textarea
            id="bio"
            rows={3}
            maxLength={500}
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            placeholder="e.g. 3rd-year CENG student, sharing algorithm notes."
            className="form-input resize-y"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{form.bio.length}/500</p>
        </div>
        <div className="sm:col-span-2 space-y-3">
          <Alert variant={feedback.type || 'error'}>{feedback.text}</Alert>
          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Section>
  );
}

// Google ile açılmış ve henüz şifresi olmayan hesapta (hasPassword=false) mevcut şifre sorulmaz: ilk şifre belirlenir.
function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const [changePassword, { isLoading }] = useChangePasswordMutation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [feedback, setFeedback] = useState<Feedback>({ type: '', text: '' });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await changePassword(hasPassword ? { currentPassword, newPassword } : { newPassword }).unwrap();
      setCurrentPassword('');
      setNewPassword('');
      setFeedback({
        type: 'success',
        text: hasPassword ? 'Your password has been updated.' : 'Password set. You can now log in with your email too.',
      });
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err) });
    }
  };

  return (
    <Section
      id="password"
      title={hasPassword ? 'Change Password' : 'Set a Password'}
      description={
        hasPassword
          ? undefined
          : 'You signed up with Google. Set a password to also log in with your email and password.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        {hasPassword && (
          <PasswordField
            id="currentPassword"
            label="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        )}
        <PasswordField
          id="newPassword"
          label="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          hint="At least 8 characters"
        />
        <Alert variant={feedback.type || 'error'}>{feedback.text}</Alert>
        <button type="submit" disabled={isLoading} className="btn-primary">
          {isLoading ? 'Saving...' : hasPassword ? 'Update Password' : 'Set Password'}
        </button>
      </form>
    </Section>
  );
}

// Engellediğim kişiler, en son engellenen önce. Engeli buradan kaldırılabilir.
function BlockedSection() {
  const { data, isLoading } = useGetBlockedUsersQuery();
  const [toggleBlock, { isLoading: unblocking }] = useToggleBlockMutation();
  const dialog = useDialog();
  const users = data?.data?.users;

  const handleUnblock = async (id: string, name: string) => {
    const ok = await dialog.confirm({
      title: `Unblock ${name}?`,
      message: 'You will be able to follow and message each other again.',
      confirmLabel: 'Unblock',
      icon: ShieldCheck,
    });
    if (!ok) return;
    try {
      await toggleBlock({ id, blocked: true }).unwrap();
    } catch (err) {
      dialog.alert({ message: getErrorMessage(err) });
    }
  };

  return (
    <Section
      id="blocked"
      title="Blocked Accounts"
      description="People you block can't message you, and any follows between you are removed."
    >
      {isLoading ? (
        <Spinner />
      ) : !users?.length ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Ban size={16} className="text-gray-400" /> You haven't blocked anyone.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {users.map((u) => (
            <li key={u._id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Link to={`/users/${u._id}`} className="flex min-w-0 flex-1 items-center gap-3 group">
                <UserAvatar user={u} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-gray-900 group-hover:text-navy-600">
                    {u.fullName}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {[u.university, u.department].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                disabled={unblocking}
                onClick={() => handleUnblock(u._id, u.fullName)}
                className="btn-secondary shrink-0 px-3 py-1.5 text-sm"
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// Hesabı kalıcı olarak silme: e-postaya gelen onay koduyla (mobil uygulamayla aynı kural).
function DeleteAccountSection() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const dialog = useDialog();
  const [sendCode, { isLoading: sending }] = useSendDeleteCodeMutation();
  const [deleteAccount] = useDeleteAccountMutation();
  const [sent, setSent] = useState<{ email: string; resendIn: number } | null>(null);
  const [error, setError] = useState('');

  const handleStart = async () => {
    const ok = await dialog.confirm({
      title: 'Delete your account?',
      message:
        'Your notes, comments, messages and group chats will be deleted permanently. Groups you founded are handed to the oldest member. This cannot be undone.',
      confirmLabel: 'Continue',
      tone: 'danger',
      icon: UserX,
    });
    if (!ok) return;
    setError('');
    try {
      const { data } = await sendCode().unwrap();
      setSent(data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Section
      id="delete"
      title="Delete Account"
      description="Permanently delete your SearchNote account and everything you shared."
    >
      {!sent ? (
        <>
          <Alert className="mb-3">{error}</Alert>
          <button
            type="button"
            onClick={handleStart}
            disabled={sending}
            className="btn-secondary text-rose-600 hover:bg-rose-50 hover:border-rose-200"
          >
            <Trash2 size={15} /> {sending ? 'Sending code...' : 'Delete my account'}
          </button>
        </>
      ) : (
        <div className="max-w-md">
          <p className="mb-4 text-sm text-gray-600">
            To confirm, enter the code we sent to <span className="font-semibold text-gray-900">{sent.email}</span>.
          </p>
          <CodeForm
            resendIn={sent.resendIn}
            submitLabel="Delete account permanently"
            submitClassName="btn-primary w-full bg-rose-600 hover:bg-rose-700"
            onVerify={async (code) => {
              await deleteAccount(code).unwrap();
              dispatch(logout());
              dispatch(baseApi.util.resetApiState());
              navigate('/', { replace: true });
              dialog.alert({ title: 'Account deleted', message: 'Your account has been deleted. We sent a confirmation to your email.' });
            }}
            onResend={async () => (await sendCode().unwrap()).data.resendIn}
          />
          <button type="button" onClick={() => setSent(null)} className="mt-3 text-sm font-semibold text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>
      )}
    </Section>
  );
}
