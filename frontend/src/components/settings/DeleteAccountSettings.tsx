import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { Trash2 } from 'lucide-react';
import CodeForm from '@/components/auth/CodeForm';
import Alert from '@/components/common/Alert';
import { useDialog } from '@/components/common/DialogProvider';
import { useDeleteAccountMutation, useSendDeleteCodeMutation } from '@/services/usersApi';
import { baseApi } from '@/services/baseApi';
import { logout } from '@/app/authSlice';
import { getErrorMessage } from '@/lib/getErrorMessage';
import SettingsCard from './SettingsCard';

// Hesabı kalıcı olarak silme: e-postaya gelen onay koduyla (mobil uygulamayla aynı kural).
export default function DeleteAccountSettings() {
  const dispatch = useAppDispatch();
  const email = useAppSelector((state) => state.auth.user?.email);
  const navigate = useNavigate();
  const dialog = useDialog();
  const [sendCode, { isLoading: sending }] = useSendDeleteCodeMutation();
  const [deleteAccount] = useDeleteAccountMutation();
  const [sent, setSent] = useState<{ email: string; resendIn: number } | null>(null);
  const [error, setError] = useState('');

  const handleStart = async () => {
    const ok = await dialog.confirm({
      title: 'Delete your account?',
      message: 'This cannot be undone. We will email you a code to confirm.',
      confirmLabel: 'Continue',
      tone: 'danger',
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
    <SettingsCard>
      {!sent ? (
        <>
          {/* Metinler mobildeki "Delete account" ekranıyla aynı. */}
          <p className="text-sm leading-relaxed text-gray-600">
            Deleting your account is permanent. When you delete <b className="font-semibold text-gray-900">{email}</b>, your
            profile, notes, messages, comments, likes and followers will be removed and can't be recovered.
          </p>
          <p className="mt-3 text-sm text-gray-500">
            Groups you founded will be handed over to their oldest member, or deleted if you're the only one in them.
          </p>
          <Alert className="mt-4">{error}</Alert>
          <button
            type="button"
            onClick={handleStart}
            disabled={sending}
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-6 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60 sm:w-auto"
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
    </SettingsCard>
  );
}
