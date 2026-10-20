import type { ReactNode } from 'react';
import AuthLayout from './AuthLayout';
import BackButton from './BackButton';

// Adım adım kayıt / karşılama ekranlarının ortak iskeleti (mobildeki AuthStep gibi): her ekranda tek soru.
// Üstte geri butonu (onBack verilirse), büyük başlık + açıklama, form, en altta footer.
export default function AuthStep({
  title,
  subtitle,
  onBack,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <AuthLayout>
      {onBack && <BackButton onClick={onBack} />}
      <h1 className="text-3xl font-bold text-gray-900 text-center">{title}</h1>
      {subtitle && <p className="text-sm text-gray-500 mt-2 text-center">{subtitle}</p>}
      <div className="mt-6">{children}</div>
      {footer}
    </AuthLayout>
  );
}
