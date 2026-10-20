import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import AuthStep from '@/components/auth/AuthStep';
import SlowHint from '@/components/auth/SlowHint';
import useFinishAuth from '@/components/auth/useFinishAuth';
import Alert from '@/components/common/Alert';
import SchoolFields from '@/components/common/SchoolFields';
import UserAvatar from '@/components/users/UserAvatar';
import { useCompleteGoogleSignupMutation, type GoogleSignupProfile } from '@/services/authApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { compactErrors, serverFieldErrors, validateRequired } from '@/lib/validation';

type Field = 'university' | 'department';

// "Continue with Google" ile ilk kez gelen kullanıcı (mobildeki gibi): ad, e-posta ve fotoğraf Google'dan geldi,
// sadece okul bilgisi sorulur. Şifre yoktur; isterse sonra Ayarlar'dan belirler.
// Hesap açılınca normal kayıttaki gibi karşılama adımları (/welcome) gelir.
export default function GoogleSignupPage() {
  const location = useLocation();
  const state = location.state as { signupToken?: string; profile?: GoogleSignupProfile } | null;
  const finishAuth = useFinishAuth();
  const [completeSignup, { isLoading }] = useCompleteGoogleSignupMutation();
  const [form, setForm] = useState({ university: '', department: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState('');

  // Sayfa yenilenirse (state kaybolur) Google adımı baştan yapılır.
  if (!state?.signupToken || !state.profile) return <Navigate to="/register" replace />;
  const { signupToken, profile } = state;
  const fullName = profile.fullName || profile.email.split('@')[0];

  const setField = (field: Field, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const errors = compactErrors({
      university: validateRequired(form.university, 'University'),
      department: validateRequired(form.department, 'Department'),
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    try {
      const { data } = await completeSignup({
        signupToken,
        fullName,
        university: form.university.trim(),
        department: form.department.trim(),
      }).unwrap();
      finishAuth(data, '/welcome');
    } catch (err) {
      const fields = serverFieldErrors(err);
      if (fields.university || fields.department) setFieldErrors(fields);
      else setError(Object.values(fields)[0] ?? getErrorMessage(err));
    }
  };

  return (
    <AuthStep
      title="Where do you study?"
      subtitle="Your university and department help classmates find your notes. You can change these later."
      footer={
        <p className="text-center text-sm text-gray-500 mt-6">
          Not you?{' '}
          <Link to="/register" replace className="text-navy-600 hover:text-navy-700 font-semibold">
            Use another email
          </Link>
        </p>
      }
    >
      {/* Google'dan gelen hesap (mobildeki gibi kart) */}
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-gray-200 p-3">
        <UserAvatar user={{ fullName, avatarUrl: profile.avatarUrl }} size="md" />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-gray-900">{fullName}</p>
          <p className="truncate text-[13px] text-gray-500">{profile.email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <SchoolFields
          showCountry
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
      <SlowHint loading={isLoading} />
    </AuthStep>
  );
}
