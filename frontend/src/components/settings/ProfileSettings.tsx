import { useRef, useState, type FormEvent } from 'react';
import Alert from '@/components/common/Alert';
import SchoolFields from '@/components/common/SchoolFields';
import TextField from '@/components/common/TextField';
import UserAvatar from '@/components/users/UserAvatar';
import { useDialog } from '@/components/common/DialogProvider';
import { useRemoveAvatarMutation, useUpdateAvatarMutation, useUpdateProfileMutation } from '@/services/usersApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { compactErrors, serverFieldErrors, validateRequired } from '@/lib/validation';
import type { AuthUser } from '@/types/api';
import type { Feedback } from './SettingsCard';
import SettingsCard from './SettingsCard';

type ProfileField = 'fullName' | 'university' | 'department';

// Ayarlar > Edit profile: üstte Instagram'daki gibi fotoğraf satırı, altında profil bilgileri formu.
export default function ProfileSettings({ user }: { user: AuthUser }) {
  return (
    <div className="space-y-4">
      <PhotoRow user={user} />
      <ProfileForm user={user} />
    </div>
  );
}

function PhotoRow({ user }: { user: AuthUser }) {
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
    <SettingsCard>
      <div className="flex items-center gap-4">
        <UserAvatar user={user} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-gray-900">{user.fullName}</p>
          <p className="truncate text-sm text-gray-500">{user.email}</p>
          {user.avatarUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className="mt-0.5 text-sm font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-60"
            >
              {removing ? 'Removing...' : 'Remove photo'}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
          className="inline-flex h-9 shrink-0 items-center rounded-lg bg-navy-600 px-4 text-[13px] font-bold text-white hover:bg-navy-700 disabled:opacity-60"
        >
          {isLoading ? 'Uploading...' : 'Change photo'}
        </button>
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
      <p className="mt-3 text-xs text-gray-400">JPG or PNG, up to 2 MB.</p>
      <Alert variant={feedback.type || 'error'} className="mt-3">
        {feedback.text}
      </Alert>
    </SettingsCard>
  );
}

function ProfileForm({ user }: { user: AuthUser }) {
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();
  const [form, setForm] = useState({
    fullName: user.fullName,
    university: user.university,
    department: user.department,
    bio: user.bio ?? '',
  });
  const [feedback, setFeedback] = useState<Feedback>({ type: '', text: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ProfileField, string>>>({});

  const setField = (field: ProfileField | 'bio', value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFeedback({ type: '', text: '' });
    // Mobildeki Ayarlar > Edit profile ile aynı kurallar
    const errors = compactErrors({
      fullName: validateRequired(form.fullName, 'Full name'),
      university: validateRequired(form.university, 'University'),
      department: validateRequired(form.department, 'Department'),
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    try {
      await updateProfile({
        fullName: form.fullName.trim(),
        university: form.university.trim(),
        department: form.department.trim(),
        bio: form.bio.trim(),
      }).unwrap();
      setFeedback({ type: 'success', text: 'Your profile has been updated.' });
    } catch (err) {
      const fields = serverFieldErrors(err);
      if (Object.keys(fields).length) setFieldErrors(fields);
      else setFeedback({ type: 'error', text: getErrorMessage(err) });
    }
  };

  return (
    <SettingsCard>
      <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="fullName"
          label="Full name"
          maxLength={80}
          value={form.fullName}
          onChange={(v) => setField('fullName', v)}
          error={fieldErrors.fullName}
          className="sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <label htmlFor="bio" className="form-label">
            Bio
          </label>
          <textarea
            id="bio"
            rows={3}
            maxLength={500}
            value={form.bio}
            onChange={(e) => setField('bio', e.target.value)}
            placeholder="e.g. 3rd-year CENG student, sharing algorithm notes."
            className="form-input resize-y"
          />
          <p className="mt-1 text-right text-xs text-gray-400">{form.bio.length}/500</p>
        </div>
        <SchoolFields
          university={form.university}
          department={form.department}
          onUniversityChange={(university) => setField('university', university)}
          onDepartmentChange={(department) => setField('department', department)}
          universityError={fieldErrors.university}
          departmentError={fieldErrors.department}
        />
        <div className="space-y-3 sm:col-span-2">
          <Alert variant={feedback.type || 'error'}>{feedback.text}</Alert>
          <div className="flex justify-end">
            <button type="submit" disabled={isLoading} className="btn-primary w-full sm:w-auto sm:px-8">
              {isLoading ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>
    </SettingsCard>
  );
}
