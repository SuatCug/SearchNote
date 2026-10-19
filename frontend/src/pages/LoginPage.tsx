import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '@/components/auth/AuthLayout';
import PasswordField from '@/components/auth/PasswordField';
import GoogleButton, { OrDivider } from '@/components/auth/GoogleButton';
import useFinishAuth from '@/components/auth/useFinishAuth';
import Alert from '@/components/common/Alert';
import { useLoginMutation } from '@/services/authApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { EMAIL_PLACEHOLDER } from '@/lib/constants';

export default function LoginPage() {
  const finishAuth = useFinishAuth();
  const [login, { isLoading }] = useLoginMutation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    try {
      const data = await login({ email, password }).unwrap();
      finishAuth(data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-3xl font-bold text-gray-900 text-center">Log In</h1>
      <p className="text-sm text-gray-500 mt-2 text-center">Log in with your email and password.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="form-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={EMAIL_PLACEHOLDER}
            className="form-input"
          />
        </div>

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          autoComplete="current-password"
        />
        <p className="-mt-2 text-right text-sm">
          <Link to="/forgot-password" className="font-semibold text-navy-600 hover:text-navy-700">
            Forgot password?
          </Link>
        </p>

        <Alert>{error}</Alert>

        <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5 text-[15px]">
          {isLoading ? 'Logging in...' : 'Log In'}
        </button>
      </form>

      <div className="mt-5 space-y-5">
        <OrDivider />
        <GoogleButton onError={setError} />
      </div>

      <p className="text-center text-sm text-gray-500 mt-6">
        Don't have an account?{' '}
        <Link to="/register" className="text-navy-600 hover:text-navy-700 font-semibold">
          Sign Up
        </Link>
      </p>
    </AuthLayout>
  );
}
