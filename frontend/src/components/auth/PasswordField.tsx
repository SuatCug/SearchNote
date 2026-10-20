import { useState, type ChangeEventHandler, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import FieldError from '@/components/common/FieldError';

interface PasswordFieldProps {
  id: string;
  label: ReactNode;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  hint?: ReactNode;
  autoFocus?: boolean;
  // Doğrulama hatası (alanın altında kırmızı; varken hint gizlenir — mobildeki gibi)
  error?: string;
}

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
  hint,
  autoFocus,
  error,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="form-input pr-11"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-400 hover:text-gray-600"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error ? <FieldError id={errorId}>{error}</FieldError> : hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
