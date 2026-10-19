import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import AuthLayout from '@/components/auth/AuthLayout';
import useFinishAuth from '@/components/auth/useFinishAuth';
import Alert from '@/components/common/Alert';
import SchoolFields from '@/components/common/SchoolFields';
import UserAvatar from '@/components/users/UserAvatar';
import { useCompleteGoogleSignupMutation, type GoogleSignupProfile } from '@/services/authApi';
import { getErrorMessage } from '@/lib/getErrorMessage';

// "Continue with Google" ile gelen yeni kullanıcı: e-posta Google'dan doğrulanmış gelir,
// sadece ad ve okul bilgisi istenir. Şifre yoktur; isterse sonra Ayarlar'dan belirler.
export default function GoogleSignupPage() {
  const location = useLocation();
  const state = location.state as { signupToken?: string; profile?: GoogleSignupProfile } | null;
  const finishAuth = useFinishAuth();
  const [completeSignup, { isLoading }] = useCompleteGoogleSignupMutation();
  const [form, setForm] = useState({ fullName: state?.profile?.fullName ?? '', university: '', department: '' });
  const [error, setError] = useState('');

  // Sayfa yenilenirse (state kaybolur) Google adımı baştan yapılır.
  if (!state?.signupToken || !state.profile) return <Navigate to="/register" replace />;
  const { signupToken, profile } = state;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await completeSignup({
        signupToken,
        fullName: form.fullName.trim(),
        university: form.university.trim(),
        department: form.department.trim(),
      }).unwrap();
      finishAuth(data, '/');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <AuthLayout>
      <div className="flex flex-col items-center text-center">
        <UserAvatar user={{ fullName: form.fullName || profile.email, avatarUrl: profile.avatarUrl }} size="lg" />
        <h1 className="mt-4 text-3xl font-bold text-gray-900">Where do you study?</h1>
        <p className="text-sm text-gray-500 mt-2">
          Signing up as <span className="font-semibold text-gray-800">{profile.email}</span>. Your university and
          department help classmates find your notes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="fullName" className="form-label">
            Full Name
          </label>
          <input
            id="fullName"
            required
            maxLength={80}
            autoComplete="name"
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

        <Alert>{error}</Alert>

        <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5 text-[15px]">
          {isLoading ? 'Creating your account...' : 'Sign Up'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Not you?{' '}
        <Link to="/register" replace className="text-navy-600 hover:text-navy-700 font-semibold">
          Use another email
        </Link>
      </p>
    </AuthLayout>
  );
}
