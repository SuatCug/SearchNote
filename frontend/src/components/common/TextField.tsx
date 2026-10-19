import type { InputHTMLAttributes, ReactNode } from 'react';
import FieldError from './FieldError';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'onChange' | 'value'> {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean; // etiketin yanında "(optional)"
  hint?: ReactNode; // alanın altında gri açıklama (hata varken gizlenir)
  error?: string;
}

// Etiket + metin kutusu + altında ipucu ya da hata (mobildeki TextField ile aynı düzen).
export default function TextField({ id, label, value, onChange, optional, hint, error, className = '', ...rest }: TextFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className={className}>
      <label htmlFor={id} className="form-label">
        {label} {optional && <span className="text-gray-400 font-normal">(optional)</span>}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="form-input"
        {...rest}
      />
      {error ? <FieldError id={errorId}>{error}</FieldError> : hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
