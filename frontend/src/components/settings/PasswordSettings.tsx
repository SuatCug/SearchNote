import { useState, type FormEvent } from 'react';
import PasswordField from '@/components/auth/PasswordField';
import Alert from '@/components/common/Alert';
import { useChangePasswordMutation } from '@/services/usersApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { compactErrors, MIN_PASSWORD_LENGTH, validateNewPassword, validateRequired } from '@/lib/validation';
import type { Feedback } from './SettingsCard';
import SettingsCard from './SettingsCard';

// Google ile açılmış ve henüz şifresi olmayan hesapta (hasPassword=false) mevcut şifre sorulmaz: ilk şifre belirlenir.
export default function PasswordSettings({ hasPassword }: { hasPassword: boolean }) {
  const [changePassword, { isLoading }] = useChangePasswordMutation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback] = useState<Feedback>({ type: '', text: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'current' | 'next' | 'confirm', string>>>({});
  const clearField = (field: 'current' | 'next' | 'confirm') => setFieldErrors((prev) => ({ ...prev, [field]: undefined }));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFeedback({ type: '', text: '' });
    // Mobildeki Ayarlar > Password ile aynı kurallar: yeni şifre eskisiyle aynı olamaz, tekrarı eşleşmeli
    const errors = compactErrors({
      current: hasPassword ? validateRequired(currentPassword, 'Current password') : undefined,
      next:
        validateNewPassword(newPassword) ??
        (hasPassword && newPassword === currentPassword ? 'New password must be different from the current one.' : undefined),
      confirm: !confirmPassword
        ? 'Please repeat the new password.'
        : confirmPassword !== newPassword
          ? 'Passwords do not match.'
          : undefined,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    try {
      await changePassword(hasPassword ? { currentPassword, newPassword } : { newPassword }).unwrap();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFeedback({
        type: 'success',
        text: hasPassword ? 'Your password has been updated.' : 'Password set. You can now log in with your email too.',
      });
    } catch (err) {
      setFeedback({ type: 'error', text: getErrorMessage(err) });
    }
  };

  return (
    <SettingsCard>
      <p className="mb-5 text-sm text-gray-500">
        {hasPassword
          ? `Your password must be at least ${MIN_PASSWORD_LENGTH} characters.`
          : 'You signed up with Google. Set a password to also log in with your email and password.'}
      </p>
      <form onSubmit={handleSubmit} noValidate className="max-w-md space-y-4">
        {hasPassword && (
          <PasswordField
            id="currentPassword"
            label="Current password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              clearField('current');
            }}
            autoComplete="current-password"
            error={fieldErrors.current}
          />
        )}
        <PasswordField
          id="newPassword"
          label="New password"
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            clearField('next');
          }}
          autoComplete="new-password"
          minLength={8}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
          error={fieldErrors.next}
        />
        <PasswordField
          id="confirmPassword"
          label="Re-type new password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            clearField('confirm');
          }}
          autoComplete="new-password"
          error={fieldErrors.confirm}
        />
        <Alert variant={feedback.type || 'error'}>{feedback.text}</Alert>
        <button type="submit" disabled={isLoading} className="btn-primary w-full sm:w-auto sm:px-8">
          {isLoading ? 'Saving...' : hasPassword ? 'Change password' : 'Set password'}
        </button>
      </form>
    </SettingsCard>
  );
}
