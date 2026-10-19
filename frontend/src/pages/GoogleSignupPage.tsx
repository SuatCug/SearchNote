import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import AuthLayout from '@/components/auth/AuthLayout';
import useFinishAuth from '@/components/auth/useFinishAuth';
import Alert from '@/components/common/Alert';
import SchoolFields from '@/components/common/SchoolFields';
import TextField from '@/components/common/TextField';
import UserAvatar from '@/components/users/UserAvatar';
import { useCompleteGoogleSignupMutation, type GoogleSignupProfile } from '@/services/authApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { compactErrors, serverFieldErrors, validateRequired } from '@/lib/validation';

type Field = 'fullName' | 'university' | 'department';

// "Continue with Google" ile gelen yeni kullanıcı: e-posta Google'dan doğrulanmış gelir,
// sadece ad ve okul bilgisi istenir. Şifre yoktur; isterse sonra Ayarlar'dan belirler.
export default function GoogleSignupPage() {
  const location = useLocation();
  const state = location.state as { signupToken?: string; profile?: GoogleSignupProfile } | null;
  const finishAuth = useFinishAuth();
  const [completeSignup, { isLoading }] = useCompleteGoogleSignupMutation();
  const [form, setForm] = useState({ fullName: state?.profile?.fullName ?? '', university: '', department: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState('');

  // Sayfa yenilenirse (state kaybolur) Google adımı baştan yapılır.
  if (!state?.signupToken || !state.profile) return <Navigate to="/register" replace />;
  const { signupToken, profile } = state;

  const setField = (field: Field, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const errors = compactErrors({
      fullName: validateRequired(form.fullName, 'Full name'),
      university: validateRequired(form.university, 'University'),
      department: validateRequired(form.department, 'Department'),
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    try {
      const { data } = await completeSignup({
        signupToken,
        fullName: form.fullName.trim(),
        university: form.university.trim(),
        department: form.department.trim(),
      }).unwrap();
      finishAuth(data, '/');
    } catch (err) {
      const fields = serverFieldErrors(err);
      if (Object.keys(fields).length) setFieldErrors(fields);
      else setError(getErrorMessage(err));
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

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <TextField
          id="fullName"
          label="Full Name"
          maxLength={80}
          autoComplete="name"
          value={form.fullName}
          onChange={(v) => setField('fullName', v)}
          error={fieldErrors.fullName}
        />

        <SchoolFields
          university={form.university}
          department={form.department}
          onUniversityChange={(university) => setField('university', university)}
          onDepartmentChange={(department) => setField('department', department)}
          universityError={fieldErrors.university}
          departmentError={fieldErrors.department}
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
