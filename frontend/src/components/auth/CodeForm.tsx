import { useEffect, useState, type FormEvent } from 'react';
import Alert from '@/components/common/Alert';
import { getErrorMessage } from '@/lib/getErrorMessage';

export const CODE_LENGTH = 6;

// E-postaya gelen 6 haneli kodu girme formu (kayıt, şifre sıfırlama ve hesap silme ortak kullanır).
// Kod tamamlanınca otomatik doğrulanır; "Get a new code" bekleme süresi bitince açılır.
// onVerify / onResend hata fırlatırsa mesajı formda gösterilir.
interface CodeFormProps {
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<number>; // yeni bekleme süresi (sn)
  resendIn: number;
  submitLabel?: string;
  submitClassName?: string;
}

export default function CodeForm({
  onVerify,
  onResend,
  resendIn,
  submitLabel = 'Continue',
  submitClassName = 'btn-primary w-full py-2.5 text-[15px]',
}: CodeFormProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendAt, setResendAt] = useState(() => Date.now() + resendIn * 1000);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (resendAt <= Date.now()) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  const verify = async (value: string) => {
    if (value.length !== CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code.`);
      return;
    }
    setError('');
    setInfo('');
    setVerifying(true);
    try {
      await onVerify(value);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setInfo('');
    setResending(true);
    try {
      const wait = await onResend();
      setResendAt(Date.now() + wait * 1000);
      setNow(Date.now());
      setCode('');
      setInfo('We sent you a new code.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    verify(code);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="code" className="form-label">
          Confirmation code
        </label>
        <input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={CODE_LENGTH}
          value={code}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH);
            setCode(digits);
            setError('');
            if (digits.length === CODE_LENGTH && !verifying) verify(digits);
          }}
          placeholder="••••••"
          className="form-input text-center text-2xl font-semibold tracking-[0.5em] tabular-nums"
        />
      </div>

      <Alert>{error}</Alert>
      <Alert variant="success">{info}</Alert>

      <button type="submit" disabled={verifying} className={submitClassName}>
        {verifying ? 'Checking...' : submitLabel}
      </button>

      <p className="text-center text-sm text-gray-500">
        {secondsLeft > 0 ? (
          `You can request a new code in ${secondsLeft}s`
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="font-semibold text-navy-600 hover:text-navy-700 disabled:opacity-60"
          >
            {resending ? 'Sending...' : 'Get a new code'}
          </button>
        )}
      </p>
    </form>
  );
}
