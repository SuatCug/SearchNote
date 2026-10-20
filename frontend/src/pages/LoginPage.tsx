import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '@/components/auth/AuthLayout';
import PasswordField from '@/components/auth/PasswordField';
import GoogleButton, { OrDivider } from '@/components/auth/GoogleButton';
import SlowHint from '@/components/auth/SlowHint';
import useFinishAuth from '@/components/auth/useFinishAuth';
import Alert from '@/components/common/Alert';
import TextField from '@/components/common/TextField';
import { useLoginMutation } from '@/services/authApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { compactErrors, validateEmail, validateRequired } from '@/lib/validation';
import { EMAIL_PLACEHOLDER } from '@/lib/constants';

type Field = 'email' | 'password';

export default function LoginPage() {
  const finishAuth = useFinishAuth();
  const [login, { isLoading }] = useLoginMutation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Alan hataları alanın altında, sunucu hatası (yanlış şifre vb.) formun altında (mobil uygulamayla aynı)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState('');

  const clearField = (field: Field) => setFieldErrors((prev) => ({ ...prev, [field]: undefined }));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errors = compactErrors({ email: validateEmail(email), password: validateRequired(password, 'Password') });
    setFieldErrors(errors);
    setError('');
    if (Object.keys(errors).length) return;
    try {
      const data = await login({ email: email.trim(), password }).unwrap();
      finishAuth(data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-3xl font-bold text-gray-900 text-center">Log In</h1>
      <p className="text-sm text-gray-500 mt-2 text-center">Log in with your email and password.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(v) => {
            setEmail(v);
            clearField('email');
          }}
          placeholder={EMAIL_PLACEHOLDER}
          error={fieldErrors.email}
        />

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearField('password');
          }}
          placeholder="Your password"
          autoComplete="current-password"
          error={fieldErrors.password}
        />
        <Alert>{error}</Alert>

        <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5 text-[15px]">
          {isLoading ? 'Logging in...' : 'Log In'}
        </button>
      </form>
      <SlowHint loading={isLoading} />

      {/* Mobildeki gibi: yazılmış e-posta şifre sıfırlama ekranına hazır geçer */}
      <p className="mt-3 text-center text-sm">
        <Link to="/forgot-password" state={{ email: email.trim() }} className="font-semibold text-navy-600 hover:text-navy-700">
          Forgot password?
        </Link>
      </p>

      <div className="mt-5 space-y-5">
        <OrDivider />
        <GoogleButton onError={setError} />
      </div>

      {/* Mobildeki gibi en altta çerçeveli "Create new account" */}
      <div className="mt-8 border-t border-gray-100 pt-6">
        <Link
          to="/register"
          className="flex h-11 w-full items-center justify-center rounded-full border border-navy-300 text-[15px] font-semibold text-navy-700 hover:bg-navy-50 transition-colors"
        >
          Create new account
        </Link>
      </div>
    </AuthLayout>
  );
}
