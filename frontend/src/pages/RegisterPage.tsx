import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthStep from '@/components/auth/AuthStep';
import PasswordField from '@/components/auth/PasswordField';
import CodeForm, { CODE_LENGTH } from '@/components/auth/CodeForm';
import GoogleButton, { OrDivider } from '@/components/auth/GoogleButton';
import SlowHint from '@/components/auth/SlowHint';
import useFinishAuth from '@/components/auth/useFinishAuth';
import Alert from '@/components/common/Alert';
import SchoolFields from '@/components/common/SchoolFields';
import TextField from '@/components/common/TextField';
import { useCompleteSignupMutation, useSendSignupCodeMutation, useVerifySignupCodeMutation } from '@/services/authApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { EDU_EMAIL_REGEX, EMAIL_PLACEHOLDER, REQUIRE_EDU_EMAIL } from '@/lib/constants';
import {
  compactErrors,
  MIN_PASSWORD_LENGTH,
  serverFieldErrors,
  validateEmail,
  validateNewPassword,
  validateRequired,
} from '@/lib/validation';

// Mobil uygulamayla aynı kayıt akışı (Instagram/TikTok gibi adım adım, her ekranda tek soru):
// e-posta → kod → ad → şifre → okul. E-posta kodla doğrulanır, hesap en son adımda oluşturulur
// (doğrulanmamış hesap hiç açılmaz). Sonra karşılama adımları (/welcome: fotoğraf, takip önerileri) gelir.
// Adım tarayıcı geçmişinde (location.state.step) tutulur: tarayıcının geri tuşu da bir önceki adıma döner.
type Step = 'email' | 'code' | 'name' | 'password' | 'school';
type Field = 'email' | 'fullName' | 'password' | 'university' | 'department';

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const finishAuth = useFinishAuth();
  const [sendCode, { isLoading: sending }] = useSendSignupCodeMutation();
  const [verifyCode] = useVerifySignupCodeMutation();
  const [completeSignup, { isLoading: completing }] = useCompleteSignupMutation();

  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resendIn, setResendIn] = useState(60);
  const [signupToken, setSignupToken] = useState('');
  const [form, setForm] = useState({ fullName: '', password: '', university: '', department: '' });
  // Alan hataları alanın altında, diğer sunucu hataları formun altında (mobil uygulamayla aynı kurallar ve mesajlar)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState('');

  // Sayfa yenilenirse (bellekteki e-posta / kod kaybolur) ilk adımdan başlanır.
  const state = location.state as { step?: Step; from?: string } | null;
  const requested = state?.step ?? 'email';
  const step: Step =
    requested === 'code' && maskedEmail ? 'code' : requested !== 'email' && requested !== 'code' && signupToken ? requested : 'email';

  // İleri: yeni geçmiş kaydı (geri tuşu bir önceki adıma döner). replace: kod ekranı geçmişten silinsin
  // (mobildeki gibi isim ekranından geri gelince doğrudan e-posta adımı açılır).
  const goTo = (next: Step, replace = false) => {
    setError('');
    setFieldErrors({});
    navigate('.', { state: { ...state, step: next }, replace });
  };
  const goBack = () => {
    setError('');
    setFieldErrors({});
    navigate(-1);
  };

  const clearField = (field: Field) => setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  const setField = (field: Exclude<Field, 'email'>, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    clearField(field);
  };

  const handleEmail = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const clean = email.trim().toLowerCase();
    const invalid =
      validateEmail(email) ??
      (REQUIRE_EDU_EMAIL && !EDU_EMAIL_REGEX.test(clean) ? 'Only institutional .edu.tr email addresses can register.' : undefined);
    setFieldErrors({ email: invalid });
    if (invalid) return;
    try {
      const { data } = await sendCode(clean).unwrap();
      setEmail(clean);
      setMaskedEmail(data.maskedEmail);
      setResendIn(data.resendIn);
      setSignupToken(''); // e-posta değiştiyse eski doğrulama geçersiz
      goTo('code');
    } catch (err) {
      // Kayıtlı e-posta, .edu.tr şartı gibi hatalar kutunun altında görünsün (mobildeki gibi 409 / 422)
      const status = (err as { status?: unknown }).status;
      if (status === 409 || status === 422) setFieldErrors({ email: getErrorMessage(err) });
      else setError(getErrorMessage(err));
    }
  };

  const handleName = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const invalid = validateRequired(form.fullName, 'Full name');
    setFieldErrors({ fullName: invalid });
    if (!invalid) goTo('password');
  };

  const handlePassword = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const invalid = validateNewPassword(form.password);
    setFieldErrors({ password: invalid });
    if (!invalid) goTo('school');
  };

  const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
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
        fullName: form.fullName.trim(),
        password: form.password,
        university: form.university.trim(),
        department: form.department.trim(),
      }).unwrap();
      // Yeni hesap: önce karşılama adımları (fotoğraf, sınıf arkadaşlarını takip et)
      finishAuth(data, '/welcome');
    } catch (err) {
      const fields = serverFieldErrors(err);
      // Ad / şifre hatası önceki adımlarda kaldı: mesaj formun altında gösterilir
      if (fields.university || fields.department) setFieldErrors(fields);
      else setError(Object.values(fields)[0] ?? getErrorMessage(err));
    }
  };

  const footer = (
    <p className="text-center text-sm text-gray-500 mt-6">
      Already have an account?{' '}
      <Link to="/login" className="text-navy-600 hover:text-navy-700 font-semibold">
        Log In
      </Link>
    </p>
  );
  const nextButton = (label = 'Next', busy = false, busyLabel = label) => (
    <button type="submit" disabled={busy} className="btn-primary w-full py-2.5 text-[15px]">
      {busy ? busyLabel : label}
    </button>
  );

  if (step === 'code') {
    return (
      <AuthStep
        onBack={goBack}
        title="Enter the confirmation code"
        subtitle={
          <>
            To confirm your account, enter the {CODE_LENGTH}-digit code we sent to{' '}
            <span className="font-semibold text-gray-800">{maskedEmail}</span>.
          </>
        }
        footer={footer}
      >
        <CodeForm
          resendIn={resendIn}
          submitLabel="Next"
          onVerify={async (code) => {
            const { data } = await verifyCode({ email, code }).unwrap();
            setSignupToken(data.signupToken);
            goTo('name', true);
          }}
          onResend={async () => (await sendCode(email).unwrap()).data.resendIn}
        />
        <p className="text-center text-sm mt-4">
          <button type="button" onClick={goBack} className="font-semibold text-navy-600 hover:text-navy-700">
            Change email
          </button>
        </p>
      </AuthStep>
    );
  }

  if (step === 'name') {
    return (
      <AuthStep onBack={goBack} title="What's your name?" subtitle="This is how classmates will see you on SearchNote." footer={footer}>
        <form onSubmit={handleName} noValidate className="space-y-4">
          <TextField
            id="fullName"
            label="Full Name"
            maxLength={80}
            autoFocus
            autoComplete="name"
            value={form.fullName}
            onChange={(v) => setField('fullName', v)}
            placeholder="Jane Doe"
            error={fieldErrors.fullName}
          />
          {nextButton()}
        </form>
      </AuthStep>
    );
  }

  if (step === 'password') {
    return (
      <AuthStep
        onBack={goBack}
        title="Create a password"
        subtitle={`Create a password with at least ${MIN_PASSWORD_LENGTH} characters. Use a mix of letters and numbers that would be hard to guess.`}
        footer={footer}
      >
        <form onSubmit={handlePassword} noValidate className="space-y-4">
          {/* Tarayıcı şifre yöneticisi kaydederken hangi hesap olduğunu bilsin */}
          <input type="email" name="email" value={email} autoComplete="username" readOnly hidden />
          <PasswordField
            id="password"
            label="Password"
            value={form.password}
            onChange={(e) => setField('password', e.target.value)}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            autoFocus
            error={fieldErrors.password}
          />
          {nextButton()}
        </form>
      </AuthStep>
    );
  }

  if (step === 'school') {
    return (
      <AuthStep
        onBack={goBack}
        title="Where do you study?"
        subtitle="Your university and department help classmates find your notes. You can change these later."
        footer={footer}
      >
        <form onSubmit={handleSignUp} noValidate className="space-y-4">
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
          {nextButton('Sign Up', completing, 'Creating your account...')}
        </form>
        <SlowHint loading={completing} />
      </AuthStep>
    );
  }

  return (
    <AuthStep
      title="What's your email?"
      subtitle={`Enter the email where you can be reached. We'll send you a code to confirm it. No one will see this on your profile.${
        REQUIRE_EDU_EMAIL ? ' Only .edu.tr addresses are accepted.' : ''
      }`}
      footer={footer}
    >
      <form onSubmit={handleEmail} noValidate className="space-y-4">
        <TextField
          id="email"
          label={REQUIRE_EDU_EMAIL ? 'School Email' : 'Email'}
          type="email"
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(v) => {
            setEmail(v);
            clearField('email');
          }}
          placeholder={EMAIL_PLACEHOLDER}
          error={fieldErrors.email}
        />
        <Alert>{error}</Alert>
        {nextButton('Next', sending, 'Sending code...')}
      </form>
      <SlowHint loading={sending} />

      <div className="mt-5 space-y-5">
        <OrDivider />
        <GoogleButton onError={setError} />
      </div>
    </AuthStep>
  );
}
