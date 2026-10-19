import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '@/components/auth/AuthLayout';
import BackButton from '@/components/auth/BackButton';
import CodeForm, { CODE_LENGTH } from '@/components/auth/CodeForm';
import PasswordField from '@/components/auth/PasswordField';
import useFinishAuth from '@/components/auth/useFinishAuth';
import Alert from '@/components/common/Alert';
import TextField from '@/components/common/TextField';
import UserAvatar from '@/components/users/UserAvatar';
import {
  useFindResetAccountMutation,
  useResetPasswordMutation,
  useSendResetCodeMutation,
  useVerifyResetCodeMutation,
  type ResetAccount,
} from '@/services/authApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { EMAIL_PLACEHOLDER } from '@/lib/constants';
import { validateEmail, validateNewPassword } from '@/lib/validation';

// "Forgot password?" (mobil uygulamayla aynı akış): e-postayla hesabı bul → hesabı onayla ve kod gönder →
// kodu doğrula → yeni şifre. Sonunda kullanıcı doğrudan giriş yapmış olur.
type Step = 'email' | 'confirm' | 'code' | 'password';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const finishAuth = useFinishAuth();
  const [findAccount, { isLoading: finding }] = useFindResetAccountMutation();
  const [sendCode, { isLoading: sending }] = useSendResetCodeMutation();
  const [verifyCode] = useVerifyResetCodeMutation();
  const [resetPassword, { isLoading: resetting }] = useResetPasswordMutation();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [account, setAccount] = useState<ResetAccount | null>(null);
  const [resendIn, setResendIn] = useState(60);
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  // Mobildeki gibi: e-posta ve yeni şifre adımlarında hata alanın altında (doğrulama ya da "hesap bulunamadı")
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');

  const goTo = (next: Step) => {
    setError('');
    setFieldError('');
    setStep(next);
  };

  const handleFind = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const invalid = validateEmail(email);
    setFieldError(invalid ?? '');
    if (invalid) return;
    const clean = email.trim().toLowerCase();
    try {
      const { data } = await findAccount(clean).unwrap();
      setEmail(clean);
      setAccount(data.account);
      goTo('confirm');
    } catch (err) {
      setFieldError(getErrorMessage(err));
    }
  };

  const handleSendCode = async () => {
    setError('');
    try {
      const { data } = await sendCode(email).unwrap();
      setResendIn(data.resendIn);
      goTo('code');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleReset = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const invalid = validateNewPassword(password);
    setFieldError(invalid ?? '');
    if (invalid) return;
    try {
      const { data } = await resetPassword({ resetToken, password }).unwrap();
      finishAuth(data, '/');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const back = { email: () => navigate('/login'), confirm: () => goTo('email'), code: () => goTo('confirm'), password: () => goTo('email') }[step];

  return (
    <AuthLayout>
      <BackButton onClick={back} />

      {step === 'email' && (
        <>
          <h1 className="text-3xl font-bold text-gray-900 text-center">Find your account</h1>
          <p className="text-sm text-gray-500 mt-2 text-center">Enter the email address you signed up with.</p>
          <form onSubmit={handleFind} noValidate className="mt-6 space-y-4">
            <TextField
              id="email"
              label="Email"
              type="email"
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(v) => {
                setEmail(v);
                setFieldError('');
              }}
              placeholder={EMAIL_PLACEHOLDER}
              error={fieldError}
            />
            <Alert>{error}</Alert>
            <button type="submit" disabled={finding} className="btn-primary w-full py-2.5 text-[15px]">
              {finding ? 'Searching...' : 'Find account'}
            </button>
          </form>
        </>
      )}

      {step === 'confirm' && account && (
        <>
          <div className="flex flex-col items-center text-center">
            <UserAvatar user={account} size="xl" />
            <h1 className="mt-4 text-2xl font-bold text-gray-900">{account.fullName}</h1>
            <p className="text-sm text-gray-500 mt-1">
              We'll send a {CODE_LENGTH}-digit code to <span className="font-semibold text-gray-800">{account.maskedEmail}</span>.
            </p>
          </div>
          <div className="mt-6 space-y-3">
            <Alert>{error}</Alert>
            <button type="button" onClick={handleSendCode} disabled={sending} className="btn-primary w-full py-2.5 text-[15px]">
              {sending ? 'Sending...' : 'Send code'}
            </button>
            <button type="button" onClick={() => goTo('email')} className="btn-secondary w-full py-2.5 text-[15px]">
              This isn't me
            </button>
          </div>
        </>
      )}

      {step === 'code' && account && (
        <>
          <h1 className="text-3xl font-bold text-gray-900 text-center">Enter the code</h1>
          <p className="text-sm text-gray-500 mt-2 text-center">
            We sent a {CODE_LENGTH}-digit code to <span className="font-semibold text-gray-800">{account.maskedEmail}</span>.
          </p>
          <div className="mt-6">
            <CodeForm
              resendIn={resendIn}
              onVerify={async (code) => {
                const { data } = await verifyCode({ email, code }).unwrap();
                setResetToken(data.resetToken);
                goTo('password');
              }}
              onResend={async () => (await sendCode(email).unwrap()).data.resendIn}
            />
          </div>
        </>
      )}

      {step === 'password' && (
        <>
          <h1 className="text-3xl font-bold text-gray-900 text-center">Create a new password</h1>
          <p className="text-sm text-gray-500 mt-2 text-center">
            Use at least 8 characters. You'll be logged in right after.
          </p>
          <form onSubmit={handleReset} noValidate className="mt-6 space-y-4">
            <PasswordField
              id="newPassword"
              label="New password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldError('');
              }}
              autoComplete="new-password"
              minLength={8}
              placeholder="At least 8 characters"
              error={fieldError}
            />
            <Alert>{error}</Alert>
            <button type="submit" disabled={resetting} className="btn-primary w-full py-2.5 text-[15px]">
              {resetting ? 'Saving...' : 'Save and log in'}
            </button>
          </form>
        </>
      )}

      <p className="text-center text-sm text-gray-500 mt-6">
        Remembered it?{' '}
        <Link to="/login" className="text-navy-600 hover:text-navy-700 font-semibold">
          Log In
        </Link>
      </p>
    </AuthLayout>
  );
}
