import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '@/components/auth/AuthLayout';
import BackButton from '@/components/auth/BackButton';
import PasswordField from '@/components/auth/PasswordField';
import CodeForm, { CODE_LENGTH } from '@/components/auth/CodeForm';
import GoogleButton, { OrDivider } from '@/components/auth/GoogleButton';
import useFinishAuth from '@/components/auth/useFinishAuth';
import Alert from '@/components/common/Alert';
import SchoolFields from '@/components/common/SchoolFields';
import { useCompleteSignupMutation, useSendSignupCodeMutation, useVerifySignupCodeMutation } from '@/services/authApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { EDU_EMAIL_REGEX, EMAIL_PLACEHOLDER, REQUIRE_EDU_EMAIL } from '@/lib/constants';

// Mobil uygulamayla aynı kayıt akışı: önce e-posta kodla doğrulanır, hesap en son adımda oluşturulur
// (böylece doğrulanmamış hesap hiç açılmaz). Adımlar: e-posta → kod → ad, şifre ve okul.
type Step = 'email' | 'code' | 'details';

export default function RegisterPage() {
  const finishAuth = useFinishAuth();
  const [sendCode, { isLoading: sending }] = useSendSignupCodeMutation();
  const [verifyCode] = useVerifySignupCodeMutation();
  const [completeSignup, { isLoading: completing }] = useCompleteSignupMutation();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resendIn, setResendIn] = useState(60);
  const [signupToken, setSignupToken] = useState('');
  const [form, setForm] = useState({ fullName: '', password: '', university: '', department: '' });
  const [error, setError] = useState('');

  const goTo = (next: Step) => {
    setError('');
    setStep(next);
  };

  const emailInvalid = REQUIRE_EDU_EMAIL && email.includes('@') && !EDU_EMAIL_REGEX.test(email.trim());

  const handleEmail = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const clean = email.trim().toLowerCase();
    if (REQUIRE_EDU_EMAIL && !EDU_EMAIL_REGEX.test(clean)) {
      setError('You can only sign up with a .edu.tr school email address.');
      return;
    }
    try {
      const { data } = await sendCode(clean).unwrap();
      setEmail(clean);
      setMaskedEmail(data.maskedEmail);
      setResendIn(data.resendIn);
      goTo('code');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDetails = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await completeSignup({
        signupToken,
        fullName: form.fullName.trim(),
        password: form.password,
        university: form.university.trim(),
        department: form.department.trim(),
      }).unwrap();
      finishAuth(data, '/');
    } catch (err) {
      setError(getErrorMessage(err));
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

  if (step === 'code') {
    return (
      <AuthLayout>
        <BackButton onClick={() => goTo('email')} />
        <h1 className="text-3xl font-bold text-gray-900 text-center">Check your email</h1>
        <p className="text-sm text-gray-500 mt-2 text-center">
          To confirm your account, enter the {CODE_LENGTH}-digit code we sent to{' '}
          <span className="font-semibold text-gray-800">{maskedEmail}</span>.
        </p>
        <div className="mt-6">
          <CodeForm
            resendIn={resendIn}
            onVerify={async (code) => {
              const { data } = await verifyCode({ email, code }).unwrap();
              setSignupToken(data.signupToken);
              goTo('details');
            }}
            onResend={async () => (await sendCode(email).unwrap()).data.resendIn}
          />
        </div>
        <p className="text-center text-sm mt-4">
          <button type="button" onClick={() => goTo('email')} className="font-semibold text-gray-500 hover:text-gray-700">
            Change email
          </button>
        </p>
        {footer}
      </AuthLayout>
    );
  }

  if (step === 'details') {
    return (
      <AuthLayout>
        <h1 className="text-3xl font-bold text-gray-900 text-center">Almost there</h1>
        <p className="text-sm text-gray-500 mt-2 text-center">
          <span className="font-semibold text-gray-800">{email}</span> is confirmed. Tell classmates who you are.
        </p>

        <form onSubmit={handleDetails} className="mt-6 space-y-4">
          <div>
            <label htmlFor="fullName" className="form-label">
              Full Name
            </label>
            <input
              id="fullName"
              required
              maxLength={80}
              autoFocus
              autoComplete="name"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="Jane Doe"
              className="form-input"
            />
            <p className="mt-1 text-xs text-gray-400">This is how classmates will see you on SearchNote.</p>
          </div>

          <PasswordField
            id="password"
            label="Password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            hint="Use a mix of letters and numbers that would be hard to guess."
          />

          <SchoolFields
            university={form.university}
            department={form.department}
            onUniversityChange={(university) => setForm((f) => ({ ...f, university }))}
            onDepartmentChange={(department) => setForm((f) => ({ ...f, department }))}
          />

          <Alert>{error}</Alert>

          <button type="submit" disabled={completing} className="btn-primary w-full py-2.5 text-[15px]">
            {completing ? 'Creating your account...' : 'Sign Up'}
          </button>
        </form>
        {footer}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="text-3xl font-bold text-gray-900 text-center">Sign Up</h1>
      <p className="text-sm text-gray-500 mt-2 text-center">
        {REQUIRE_EDU_EMAIL ? 'Create a free account with your school email.' : 'Create a free account.'}
      </p>

      <form onSubmit={handleEmail} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="form-label">
            {REQUIRE_EDU_EMAIL ? 'School Email' : 'Email'}
          </label>
          <input
            id="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={EMAIL_PLACEHOLDER}
            aria-invalid={emailInvalid}
            className={`form-input ${emailInvalid ? 'border-rose-300 focus:ring-rose-400' : ''}`}
          />
          <p className={`mt-1 text-xs ${emailInvalid ? 'text-rose-500' : 'text-gray-400'}`}>
            {REQUIRE_EDU_EMAIL && 'Only .edu.tr addresses are accepted. '}
            We'll send you a code to confirm it. No one will see it on your profile.
          </p>
        </div>

        <Alert>{error}</Alert>

        <button type="submit" disabled={sending} className="btn-primary w-full py-2.5 text-[15px]">
          {sending ? 'Sending code...' : 'Next'}
        </button>
      </form>

      <div className="mt-5 space-y-5">
        <OrDivider />
        <GoogleButton onError={setError} />
      </div>
      {footer}
    </AuthLayout>
  );
}

